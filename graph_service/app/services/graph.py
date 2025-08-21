"""
Core Graph Mapping Service implementing the algorithm from docs/graph_mapping_spec.md
"""

import asyncio
import time
import networkx as nx
import structlog
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Tuple, Optional, Set, Any
from collections import defaultdict

from ..config import settings
from ..db import IncidentRepository, GraphRepository
from ..schemas import NodeData, EdgeData, TransactionData
from .etherscan import EtherscanService, EtherscanError, EtherscanRateLimitError
from .classification import AddressClassifier

logger = structlog.get_logger()


class GraphProcessingError(Exception):
    """Custom exception for graph processing errors."""
    pass


class GraphTimeoutError(GraphProcessingError):
    """Exception for processing timeouts."""
    pass


class GraphMappingService:
    """
    Main service for building transaction flow graphs from incidents.
    Implements the algorithm specified in graph_mapping_spec.md
    """
    
    def __init__(
        self, 
        incident_repo: IncidentRepository,
        graph_repo: GraphRepository,
        etherscan_service: EtherscanService,
        classifier: AddressClassifier
    ):
        self.incident_repo = incident_repo
        self.graph_repo = graph_repo
        self.etherscan = etherscan_service
        self.classifier = classifier
        
        # Processing state
        self.graph: Optional[nx.DiGraph] = None
        self.incident_id: Optional[str] = None
        self.processing_start_time: Optional[float] = None
        self.api_calls_used = 0
        self.nodes_processed = 0
        self.edges_created = 0
        
        # Processing limits from config
        self.limits = settings.get_processing_limits()
        
        # Address tracking
        self.address_visit_count: Dict[str, int] = defaultdict(int)
        self.processed_nodes: Set[str] = set()
        self.pending_nodes: List[Tuple[str, int]] = []  # (address, depth)
        
    async def process_incident(self, incident_id: str) -> Dict[str, Any]:
        """
        Main entry point for processing an incident graph.
        
        Args:
            incident_id: UUID of the incident to process
            
        Returns:
            Dictionary with processing results and statistics
        """
        self.incident_id = incident_id
        self.processing_start_time = time.time()
        
        logger.info("Starting graph processing", incident_id=incident_id)
        
        try:
            # Step 1: Initialize graph from incident data
            await self._initialize_graph()
            
            # Step 2: Recursive transaction traversal
            await self._recursive_traversal()
            
            # Step 3: Graph optimization and post-processing
            await self._optimize_graph()
            
            # Step 4: Calculate final statistics and save results
            results = await self._finalize_results()
            
            processing_time = time.time() - self.processing_start_time
            logger.info("Graph processing completed", 
                       incident_id=incident_id,
                       processing_time=processing_time,
                       nodes=results["total_nodes"],
                       edges=results["total_edges"],
                       api_calls=self.api_calls_used)
            
            return results
            
        except asyncio.TimeoutError:
            logger.warning("Graph processing timeout", 
                          incident_id=incident_id,
                          timeout_seconds=self.limits["timeout_seconds"])
            return await self._handle_timeout()
            
        except (EtherscanError, EtherscanRateLimitError) as e:
            logger.error("Etherscan API error during processing",
                        incident_id=incident_id,
                        error=str(e),
                        api_calls_used=self.api_calls_used)
            return await self._handle_etherscan_error(e)
            
        except Exception as e:
            logger.error("Unexpected error during processing",
                        incident_id=incident_id,
                        error=str(e),
                        error_type=type(e).__name__)
            return await self._handle_general_error(e)
    
    async def _initialize_graph(self):
        """Step 1: Initialize NetworkX graph from incident data."""
        logger.debug("Initializing graph", incident_id=self.incident_id)
        
        # Get incident details
        incident = await self.incident_repo.get_incident_by_id(self.incident_id)
        if not incident:
            raise GraphProcessingError(f"Incident {self.incident_id} not found")
        
        # Get associated transaction details  
        tx_details = await self.incident_repo.get_incident_transaction_details(self.incident_id)
        if not tx_details:
            raise GraphProcessingError(f"No transaction details found for incident {self.incident_id}")
        
        # Initialize NetworkX directed graph
        self.graph = nx.DiGraph()
        
        # Extract victim and hacker addresses from incident and transaction data
        victim_address = incident["wallet_address"].lower()
        hack_tx = tx_details[0]  # Assuming first transaction is the hack
        hacker_address = hack_tx["to_address"].lower()
        
        logger.debug("Creating initial nodes",
                    victim_address=victim_address,
                    hacker_address=hacker_address,
                    hack_tx_hash=hack_tx.get("transaction_hash", "unknown"))
        
        # Create Node 0: victim wallet address (depth 0)
        await self._add_graph_node(
            victim_address, 
            depth=0,
            entity_type="victim_wallet",
            confidence_score=100.0
        )
        
        # Create Node 1: hacker wallet address (depth 1) 
        await self._add_graph_node(
            hacker_address,
            depth=1, 
            entity_type="hacker_wallet",
            confidence_score=95.0
        )
        
        # Add edge: victim → hacker (labeled with hack transaction hash)
        hack_value = hack_tx.get("value", "0")
        await self._add_graph_edge(
            victim_address,
            hacker_address, 
            hack_tx.get("transaction_hash", ""),
            hack_value,
            priority_score=100,
            filter_reason="initial_hack_transaction"
        )
        
        # Add hacker address to pending processing queue
        self.pending_nodes.append((hacker_address, 1))
        
        logger.debug("Graph initialized successfully", 
                    nodes=self.graph.number_of_nodes(),
                    edges=self.graph.number_of_edges())
    
    async def _recursive_traversal(self):
        """Step 2: Recursive transaction traversal with filtering."""
        logger.debug("Starting recursive traversal", 
                    pending_nodes=len(self.pending_nodes))
        
        while (self.pending_nodes and 
               self.api_calls_used < self.limits["max_api_calls"] and
               self.graph.number_of_nodes() < self.limits["max_nodes"]):
            
            # Check timeout
            if time.time() - self.processing_start_time > self.limits["timeout_seconds"]:
                raise asyncio.TimeoutError("Processing timeout reached")
            
            # Process next node
            current_address, current_depth = self.pending_nodes.pop(0)
            
            # Skip if already processed or depth limit reached
            if (current_address in self.processed_nodes or 
                current_depth >= self.limits["max_depth"]):
                continue
                
            await self._process_node(current_address, current_depth)
            self.processed_nodes.add(current_address)
            self.nodes_processed += 1
            
            # Update progress
            progress = min(95, (self.nodes_processed / 20) * 100)  # Approximate progress
            await self.graph_repo.update_graph_status(
                self.incident_id, 
                "running",
                progress=int(progress),
                current_step="recursive_traversal"
            )
        
        logger.debug("Recursive traversal completed",
                    nodes_processed=self.nodes_processed,
                    api_calls_used=self.api_calls_used,
                    final_nodes=self.graph.number_of_nodes())
    
    async def _process_node(self, address: str, depth: int):
        """Process a single node - fetch transactions and apply filtering."""
        logger.debug("Processing node", address=address, depth=depth)
        
        # Track address visits
        self.address_visit_count[address] += 1
        
        try:
            # Query Etherscan for transactions from this address
            start_block = 0
            if address in self.graph.nodes:
                start_block = self.graph.nodes[address].get("first_seen", 0)
            
            transactions = await self.etherscan.get_account_transactions(
                address=address,
                start_block=start_block,
                offset=50,  # Get more to apply filters effectively
                sort="asc"
            )
            self.api_calls_used += 1
            
            # Apply transaction filtering pipeline
            filtered_transactions = await self._apply_filtering_pipeline(
                transactions, address, depth
            )
            
            # Process top priority transactions (max 5)
            for tx_data in filtered_transactions[:self.limits["max_transactions_per_node"]]:
                await self._process_transaction(tx_data, address, depth)
            
            # Check termination conditions for this node
            await self._check_termination_conditions(address, len(transactions), len(filtered_transactions))
            
        except (EtherscanError, EtherscanRateLimitError) as e:
            logger.warning("Failed to process node due to API error",
                          address=address, error=str(e))
            # Continue processing other nodes
    
    async def _apply_filtering_pipeline(
        self, 
        transactions: List[Dict[str, Any]], 
        current_address: str,
        depth: int
    ) -> List[TransactionData]:
        """Apply the three-tier filtering pipeline from the specification."""
        
        if not transactions:
            return []
        
        # Get hack transaction value for percentage calculations
        hack_value = await self._get_total_stolen_amount()
        
        normalized_transactions = []
        for tx in transactions:
            try:
                normalized = self.etherscan.normalize_transaction(tx)
                normalized_transactions.append(normalized)
            except Exception as e:
                logger.warning("Failed to normalize transaction", error=str(e))
                continue
        
        # PRIMARY FILTERS
        primary_filtered = []
        for tx in normalized_transactions:
            # Only outgoing transactions
            if tx.from_address.lower() != current_address.lower():
                continue
                
            # Minimum value filter
            value_eth = float(tx.value) / 1e18  # Convert wei to ETH
            if value_eth < settings.min_transaction_value_eth:
                continue
                
            # Percentage threshold (dynamic based on hack size)
            if hack_value > 0:
                percentage = (value_eth / hack_value) * 100
                min_percentage = self._get_min_percentage_threshold(hack_value)
                if percentage < min_percentage:
                    continue
            
            # Time-based priority (simplified - would need transaction timestamps)
            # For now, prioritize recent transactions
            
            primary_filtered.append(tx)
        
        # SECONDARY FILTERS  
        secondary_filtered = []
        for tx in primary_filtered:
            # Check if destination is high-frequency (would need additional API calls)
            # For now, skip this check to stay within API limits
            
            # Round number priority - prioritize clean amounts
            value_eth = float(tx.value) / 1e18
            priority_score = self._calculate_priority_score(tx, value_eth)
            
            # Address reuse management
            times_seen = self.address_visit_count.get(tx.to_address.lower(), 0)
            if times_seen >= settings.reuse_threshold:
                priority_score += 20  # Boost for consolidation points
            
            # Store priority score for sorting
            tx.priority_score = priority_score
            secondary_filtered.append(tx)
        
        # TERTIARY FILTERS (fine-tuning)
        # Sort by priority score
        secondary_filtered.sort(key=lambda t: getattr(t, 'priority_score', 0), reverse=True)
        
        logger.debug("Filtering pipeline results",
                    address=current_address,
                    original_count=len(transactions),
                    primary_filtered=len(primary_filtered), 
                    secondary_filtered=len(secondary_filtered))
        
        return secondary_filtered
    
    def _get_min_percentage_threshold(self, hack_value_eth: float) -> float:
        """Get minimum percentage threshold based on hack size."""
        if hack_value_eth > 100:
            return settings.min_percentage_large_hack
        elif hack_value_eth > 10:
            return settings.min_percentage_medium_hack
        else:
            return settings.min_percentage_small_hack
    
    def _calculate_priority_score(self, tx: TransactionData, value_eth: float) -> int:
        """Calculate priority score for transaction selection."""
        score = 0
        
        # Value-based scoring
        if value_eth > 10:
            score += 50
        elif value_eth > 1:
            score += 30
        elif value_eth > 0.1:
            score += 20
        else:
            score += 10
        
        # Round number bonus (fewer than 3 decimal places)
        if value_eth == int(value_eth) or (value_eth * 1000) == int(value_eth * 1000):
            score += 10
        
        # Gas price priority (above average indicates urgency)
        if tx.gas_price and tx.gas_price > 20000000000:  # > 20 gwei
            score += 15
        
        return min(score, 100)
    
    async def _process_transaction(self, tx: TransactionData, from_address: str, depth: int):
        """Process a single filtered transaction."""
        to_address = tx.to_address.lower()
        
        # Skip if destination already exists with sufficient data
        if to_address in self.graph.nodes and self.graph.nodes[to_address].get("processed", False):
            return
        
        # Create destination node if it doesn't exist
        if to_address not in self.graph.nodes:
            await self._add_graph_node(to_address, depth=depth + 1)
            
            # Add to pending processing if not too deep
            if depth + 1 < self.limits["max_depth"]:
                self.pending_nodes.append((to_address, depth + 1))
        
        # Add edge for this transaction
        value_eth = str(float(tx.value) / 1e18)
        await self._add_graph_edge(
            from_address,
            to_address,
            tx.transaction_hash,
            value_eth,
            priority_score=getattr(tx, 'priority_score', 0),
            block_number=tx.block_number,
            timestamp=tx.timestamp,
            gas_used=tx.gas_used,
            gas_price=tx.gas_price,
            filter_reason="filtered_transaction"
        )
        
        self.edges_created += 1
    
    async def _check_termination_conditions(
        self, 
        address: str, 
        total_tx_count: int, 
        filtered_tx_count: int
    ):
        """Check if exploration should terminate at this address."""
        
        # Classify the address
        entity_type, confidence, details = await self.classifier.classify_address(
            address,
            transaction_count=total_tx_count,
            times_seen_in_graph=self.address_visit_count[address]
        )
        
        # Update node with classification
        if address in self.graph.nodes:
            self.graph.nodes[address].update({
                "entity_type": entity_type,
                "confidence_score": confidence,
                "transaction_count": total_tx_count,
                "classification_details": details
            })
        
        # Check termination conditions
        should_terminate, reason = self.classifier.should_terminate_exploration(
            address, entity_type, confidence, total_tx_count, filtered_tx_count
        )
        
        if should_terminate:
            logger.debug("Terminating exploration",
                        address=address,
                        reason=reason,
                        entity_type=entity_type,
                        confidence=confidence)
            
            # Mark node as terminated and update in database
            if address in self.graph.nodes:
                self.graph.nodes[address].update({
                    "termination_reason": reason,
                    "manual_exploration_ready": confidence < 80
                })
            
            # Remove from pending if still there
            self.pending_nodes = [(addr, d) for addr, d in self.pending_nodes if addr != address]
    
    async def _optimize_graph(self):
        """Step 3: Graph optimization and post-processing."""
        logger.debug("Starting graph optimization")
        
        # Dead end removal
        await self._remove_dead_ends()
        
        # Entity consolidation
        await self._consolidate_entities()
        
        # Flow analysis
        await self._analyze_flows()
        
        logger.debug("Graph optimization completed",
                    final_nodes=self.graph.number_of_nodes(),
                    final_edges=self.graph.number_of_edges())
    
    async def _remove_dead_ends(self):
        """Remove nodes with zero outgoing edges unless they're endpoints."""
        nodes_to_remove = []
        
        for node in self.graph.nodes():
            out_degree = self.graph.out_degree(node)
            node_data = self.graph.nodes[node]
            
            # Keep nodes that are marked as endpoints or have termination reasons
            if (out_degree == 0 and 
                not node_data.get("termination_reason") and
                node_data.get("entity_type") not in ["CEX", "DEX", "Mixer"]):
                nodes_to_remove.append(node)
        
        for node in nodes_to_remove:
            self.graph.remove_node(node)
        
        logger.debug("Removed dead ends", count=len(nodes_to_remove))
    
    async def _consolidate_entities(self):
        """Consolidate addresses belonging to the same entity."""
        # Group nodes by entity name/type
        entity_groups = defaultdict(list)
        
        for node in self.graph.nodes():
            node_data = self.graph.nodes[node]
            entity_key = node_data.get("classification_details")
            if entity_key and entity_key not in ["Unknown", None]:
                entity_groups[entity_key].append(node)
        
        # Consolidate groups with multiple addresses
        for entity_name, addresses in entity_groups.items():
            if len(addresses) > 1:
                logger.debug("Consolidating entity", entity=entity_name, addresses=addresses)
                await self._consolidate_address_group(addresses, entity_name)
    
    async def _consolidate_address_group(self, addresses: List[str], entity_name: str):
        """Consolidate a group of addresses into a master node."""
        if len(addresses) < 2:
            return
        
        master_address = addresses[0]  # Use first as master
        other_addresses = addresses[1:]
        
        # Update master node
        master_data = self.graph.nodes[master_address]
        master_data["consolidated_addresses"] = other_addresses
        master_data["entity_type"] = master_data.get("entity_type", "Unknown")
        
        # Merge edges and remove other nodes
        for addr in other_addresses:
            # Redirect incoming edges to master
            for pred in list(self.graph.predecessors(addr)):
                if pred != master_address:  # Avoid self-loops
                    edge_data = self.graph.edges[pred, addr]
                    self.graph.add_edge(pred, master_address, **edge_data)
            
            # Redirect outgoing edges from master  
            for succ in list(self.graph.successors(addr)):
                if succ != master_address:  # Avoid self-loops
                    edge_data = self.graph.edges[addr, succ]
                    self.graph.add_edge(master_address, succ, **edge_data)
            
            # Remove the consolidated node
            self.graph.remove_node(addr)
    
    async def _analyze_flows(self):
        """Analyze transaction flows and calculate percentages."""
        total_stolen = await self._get_total_stolen_amount()
        
        if total_stolen <= 0:
            return
        
        # Calculate flow percentages for each path
        for edge in self.graph.edges(data=True):
            from_addr, to_addr, edge_data = edge
            value_eth = float(edge_data.get("value_eth", 0))
            flow_percentage = (value_eth / total_stolen) * 100
            edge_data["flow_percentage"] = flow_percentage
            
            # Mark path importance
            if flow_percentage > 10:
                edge_data["importance"] = "critical"
            elif flow_percentage > 2:
                edge_data["importance"] = "significant"  
            else:
                edge_data["importance"] = "minor"
    
    async def _finalize_results(self) -> Dict[str, Any]:
        """Calculate final statistics and save results."""
        processing_time = int(time.time() - self.processing_start_time)
        
        # Calculate statistics
        total_nodes = self.graph.number_of_nodes()
        total_edges = self.graph.number_of_edges()
        max_depth = max([self.graph.nodes[n].get("depth_from_hack", 0) for n in self.graph.nodes()], default=0)
        
        # Calculate total value traced
        total_value = sum([
            float(edge_data.get("value_eth", 0))
            for _, _, edge_data in self.graph.edges(data=True)
        ])
        
        # Endpoint summary
        endpoint_summary = defaultdict(int)
        for node in self.graph.nodes():
            entity_type = self.graph.nodes[node].get("entity_type", "Unknown")
            endpoint_summary[entity_type] += 1
        
        # Generate top paths
        top_paths = await self._generate_top_paths()
        
        # Save results to database
        await self.graph_repo.update_graph_results(
            self.incident_id,
            total_nodes=total_nodes,
            total_edges=total_edges,
            max_depth=max_depth,
            total_value_traced=str(total_value),
            processing_time=processing_time,
            api_calls_used=self.api_calls_used,
            endpoint_summary=dict(endpoint_summary),
            top_paths=top_paths
        )
        
        # Save all nodes and edges to database
        await self._persist_graph_to_database()
        
        return {
            "status": "completed",
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "max_depth": max_depth,
            "total_value_traced": str(total_value),
            "processing_time_seconds": processing_time,
            "api_calls_used": self.api_calls_used,
            "endpoint_summary": dict(endpoint_summary),
            "top_paths": top_paths
        }
    
    async def _generate_top_paths(self) -> List[Dict[str, Any]]:
        """Generate list of top transaction paths by value."""
        paths = []
        
        # Simple implementation: find high-value direct paths
        for edge in self.graph.edges(data=True):
            from_addr, to_addr, edge_data = edge
            value_eth = float(edge_data.get("value_eth", 0))
            
            if value_eth > 0.1:  # Only significant values
                from_type = self.graph.nodes[from_addr].get("entity_type", "Unknown") 
                to_type = self.graph.nodes[to_addr].get("entity_type", "Unknown")
                
                path = {
                    "path_id": len(paths) + 1,
                    "value_eth": str(value_eth),
                    "value_percentage": edge_data.get("flow_percentage", 0),
                    "hop_count": 1,  # Direct path
                    "final_endpoint_type": to_type,
                    "final_endpoint_confidence": self.graph.nodes[to_addr].get("confidence_score", 0)
                }
                paths.append(path)
        
        # Sort by value and return top 10
        paths.sort(key=lambda p: float(p["value_eth"]), reverse=True)
        return paths[:10]
    
    async def _persist_graph_to_database(self):
        """Save all graph nodes and edges to database."""
        logger.debug("Persisting graph to database")
        
        # Save nodes
        for node_address in self.graph.nodes():
            node_data = self.graph.nodes[node_address]
            
            await self.graph_repo.insert_graph_node(
                self.incident_id,
                node_address,
                entity_type=node_data.get("entity_type", "Unknown"),
                confidence_score=node_data.get("confidence_score", 0.0),
                depth_from_hack=node_data.get("depth_from_hack", 0),
                balance_eth=node_data.get("balance_eth", 0),
                transaction_count=node_data.get("transaction_count", 0),
                first_seen=node_data.get("first_seen"),
                endpoint_type=node_data.get("endpoint_type", "Unknown"),
                termination_reason=node_data.get("termination_reason"),
                manual_exploration_ready=node_data.get("manual_exploration_ready", False),
                attributes=node_data.get("attributes", {})
            )
        
        # Save edges
        for from_addr, to_addr, edge_data in self.graph.edges(data=True):
            await self.graph_repo.insert_graph_edge(
                self.incident_id,
                from_addr,
                to_addr,
                edge_data.get("transaction_hash", ""),
                edge_data.get("value_eth", "0"),
                priority_score=edge_data.get("priority_score", 0),
                block_number=edge_data.get("block_number"),
                timestamp=edge_data.get("timestamp"), 
                gas_used=edge_data.get("gas_used"),
                gas_price=edge_data.get("gas_price"),
                filter_reason=edge_data.get("filter_reason"),
                attributes=edge_data.get("attributes", {})
            )
        
        logger.debug("Graph persisted to database successfully")
    
    async def _get_total_stolen_amount(self) -> float:
        """Get the total stolen amount from the incident."""
        # For now, return a placeholder - would need to calculate from transaction details
        return 100.0  # ETH
    
    async def _add_graph_node(self, address: str, depth: int = 0, **kwargs):
        """Add a node to the graph with given attributes."""
        self.graph.add_node(address, depth_from_hack=depth, **kwargs)
        
    async def _add_graph_edge(self, from_addr: str, to_addr: str, tx_hash: str, value: str, **kwargs):
        """Add an edge to the graph with transaction data."""
        self.graph.add_edge(from_addr, to_addr, 
                          transaction_hash=tx_hash,
                          value_eth=value,
                          **kwargs)
    
    # Error handling methods
    async def _handle_timeout(self) -> Dict[str, Any]:
        """Handle processing timeout."""
        processing_time = int(time.time() - self.processing_start_time)
        
        partial_results = {
            "total_nodes": self.graph.number_of_nodes() if self.graph else 0,
            "total_edges": self.graph.number_of_edges() if self.graph else 0,
            "max_depth": 0
        }
        
        await self.graph_repo.update_graph_status(
            self.incident_id,
            "timeout",
            progress=95,
            error_message="Processing timeout after 30 seconds",
            error_code="PROCESSING_TIMEOUT",
            partial_results=partial_results
        )
        
        return {
            "status": "timeout",
            "message": "Processing timeout after 30 seconds", 
            "processing_time_seconds": processing_time,
            "api_calls_used": self.api_calls_used,
            "partial_results": partial_results
        }
    
    async def _handle_etherscan_error(self, error: Exception) -> Dict[str, Any]:
        """Handle Etherscan API errors."""
        processing_time = int(time.time() - self.processing_start_time) 
        
        error_code = "ETHERSCAN_API_ERROR"
        if isinstance(error, EtherscanRateLimitError):
            error_code = "ETHERSCAN_API_LIMIT"
        
        partial_results = {
            "total_nodes": self.graph.number_of_nodes() if self.graph else 0,
            "total_edges": self.graph.number_of_edges() if self.graph else 0,
            "max_depth": 0
        }
        
        await self.graph_repo.update_graph_status(
            self.incident_id,
            "error",
            error_message=str(error),
            error_code=error_code,
            partial_results=partial_results
        )
        
        return {
            "status": "error",
            "error_code": error_code,
            "message": str(error),
            "processing_time_seconds": processing_time,
            "api_calls_used": self.api_calls_used,
            "partial_results": partial_results
        }
    
    async def _handle_general_error(self, error: Exception) -> Dict[str, Any]:
        """Handle general processing errors."""
        processing_time = int(time.time() - self.processing_start_time)
        
        await self.graph_repo.update_graph_status(
            self.incident_id,
            "error",
            error_message=str(error),
            error_code="INTERNAL_ERROR"
        )
        
        return {
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": str(error),
            "processing_time_seconds": processing_time,
            "api_calls_used": self.api_calls_used
        }
