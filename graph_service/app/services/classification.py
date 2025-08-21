"""Address classification service for endpoint detection."""

import structlog
from typing import Dict, Tuple, Optional
from datetime import datetime, timedelta

logger = structlog.get_logger()


class AddressClassifier:
    """Classifies addresses to determine endpoint types (CEX/DEX/Mixer/etc)."""
    
    def __init__(self):
        # Known exchange addresses (simplified for MVP)
        self.known_addresses = {
            # Major Centralized Exchanges
            "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": ("CEX", 95, "Binance"),
            "0xd551234ae421e3bcba99a0da6d736074f22192ff": ("CEX", 95, "Binance"),
            "0x564286362092d8e7936f0549571a803b203aaced": ("CEX", 95, "Binance"),
            "0x0681d8db095565fe8a346fa0277bffde9c0edbbf": ("CEX", 95, "Binance"),
            
            "0x32be343b94f860124dc4fee278fdcbd38c102d88": ("CEX", 95, "Poloniex"),
            "0xb794f5ea0ba39494ce839613fffba74279579268": ("CEX", 95, "Poloniex"),
            
            "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": ("CEX", 95, "Kraken"),
            "0xfa52274dd61e1643d2205169732f29114bc240b3": ("CEX", 95, "Kraken"),
            
            "0x1522900b6dafac587d499a862861c0869be6e428": ("CEX", 95, "KuCoin"),
            "0x2b5634c42055806a59e9107ed44d43c426e58258": ("CEX", 95, "KuCoin"),
            
            # Decentralized Exchanges  
            "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": ("DEX", 90, "Uniswap V2 Router"),
            "0xe592427a0aece92de3edee1f18e0157c05861564": ("DEX", 90, "Uniswap V3 Router"),
            "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": ("DEX", 90, "Uniswap Router"),
            
            "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": ("DEX", 90, "SushiSwap Router"),
            "0x1111111254fb6c44bac0bed2854e76f90643097d": ("DEX", 85, "1inch Router"),
            
            # Privacy/Mixers
            "0x8ba1f109551bd432803012645hac136c0cd747ef": ("Mixer", 85, "Tornado Cash"),
            "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936": ("Mixer", 85, "Tornado Cash"),
            
            # Known bridges
            "0x3154cf16ccdb4c6d922629664174b904d80f2c35": ("Bridge", 80, "Base Bridge"),
            "0xa0b86a33e6c68c93d8b48fc5b41bc1ee0ba9f41d": ("Bridge", 80, "Polygon Bridge"),
        }
        
        # Patterns for address classification
        self.address_patterns = {
            "high_frequency": 100,  # transactions per day threshold
            "consolidation": 3      # times seen in graph threshold
        }
    
    async def classify_address(
        self, 
        address: str,
        transaction_count: int = 0,
        daily_tx_count: int = 0,
        times_seen_in_graph: int = 1
    ) -> Tuple[str, float, Optional[str]]:
        """
        Classify an address and return (entity_type, confidence_score, details).
        
        Args:
            address: Ethereum address to classify
            transaction_count: Total transaction count for the address
            daily_tx_count: Transactions in the last 24 hours
            times_seen_in_graph: How many times this address appears in current graph
            
        Returns:
            Tuple of (entity_type, confidence_score, optional_details)
        """
        address_lower = address.lower()
        
        # Check known addresses first (highest confidence)
        if address_lower in self.known_addresses:
            entity_type, confidence, name = self.known_addresses[address_lower]
            logger.debug("Address classified as known entity", 
                        address=address, entity_type=entity_type, name=name)
            return entity_type, confidence, name
        
        # High frequency detection
        if daily_tx_count > self.address_patterns["high_frequency"]:
            logger.debug("Address classified as high frequency service",
                        address=address, daily_tx_count=daily_tx_count)
            return "high_frequency_service", 60.0, f"High frequency: {daily_tx_count} tx/day"
        
        # Consolidation point detection
        if times_seen_in_graph >= self.address_patterns["consolidation"]:
            logger.debug("Address classified as consolidation point",
                        address=address, times_seen=times_seen_in_graph)
            return "consolidation_point", 70.0, f"Seen {times_seen_in_graph} times in graph"
        
        # Heuristic-based classification (lower confidence)
        entity_type, confidence, details = self._classify_by_heuristics(
            address, transaction_count, daily_tx_count
        )
        
        if entity_type != "Unknown":
            logger.debug("Address classified by heuristics",
                        address=address, entity_type=entity_type, confidence=confidence)
            
        return entity_type, confidence, details
    
    def _classify_by_heuristics(
        self, 
        address: str, 
        transaction_count: int, 
        daily_tx_count: int
    ) -> Tuple[str, float, Optional[str]]:
        """Apply heuristic rules for classification."""
        
        # Very high transaction volume suggests exchange
        if transaction_count > 10000:
            if daily_tx_count > 500:
                return "CEX", 40.0, f"High volume: {transaction_count} total, {daily_tx_count}/day"
            else:
                return "potential_endpoint", 30.0, f"High historical volume: {transaction_count}"
        
        # Moderate transaction volume
        if transaction_count > 1000:
            return "potential_endpoint", 25.0, f"Moderate volume: {transaction_count}"
        
        # Low transaction count - likely personal wallet or endpoint
        if transaction_count < 100:
            if daily_tx_count < 5:
                return "potential_endpoint", 20.0, "Low activity wallet"
        
        # Default case
        return "Unknown", 0.0, None
    
    def should_terminate_exploration(
        self, 
        address: str,
        entity_type: str,
        confidence_score: float,
        transaction_count: int = 0,
        outgoing_tx_count: int = 0,
        cumulative_value_percentage: float = 0.0
    ) -> Tuple[bool, str]:
        """
        Determine if graph exploration should terminate at this address.
        
        Returns:
            Tuple of (should_terminate, reason)
        """
        
        # High confidence classification
        if confidence_score > 70.0 and entity_type in ["CEX", "DEX", "Mixer"]:
            return True, "high_confidence_classification"
        
        # High transaction volume (potential major service)
        if outgoing_tx_count > 200:
            return True, "high_transaction_volume"
        
        # Low value flow
        if cumulative_value_percentage < 5.0:
            return True, "insufficient_value_flow"
        
        # High frequency service
        if entity_type == "high_frequency_service":
            return True, "high_frequency_service_detected"
        
        # Don't terminate by default
        return False, ""
    
    def is_consolidation_candidate(
        self, 
        addresses: list[str], 
        entity_names: list[str]
    ) -> bool:
        """
        Check if multiple addresses should be consolidated into one entity.
        
        Args:
            addresses: List of addresses to check
            entity_names: List of corresponding entity names
            
        Returns:
            True if addresses should be consolidated
        """
        if len(addresses) < 2:
            return False
        
        # Simple consolidation: same entity name
        if len(set(entity_names)) == 1 and entity_names[0] is not None:
            return True
        
        # Could add more sophisticated clustering logic here
        # e.g., same first 8 characters, known address lists, etc.
        
        return False
    
    def get_consolidation_master(self, addresses: list[str]) -> str:
        """Get the master address for consolidation (typically the first/oldest)."""
        if not addresses:
            raise ValueError("Cannot consolidate empty address list")
        
        # Simple strategy: use first address as master
        # In production, might want to use the one with highest confidence
        # or most transaction volume
        return addresses[0]
    
    def add_known_address(
        self, 
        address: str, 
        entity_type: str, 
        confidence: float, 
        name: str
    ):
        """Add a new known address to the classification database."""
        self.known_addresses[address.lower()] = (entity_type, confidence, name)
        logger.info("Added known address", 
                   address=address, entity_type=entity_type, name=name)
    
    def get_classification_stats(self) -> Dict[str, any]:
        """Get statistics about the classification system."""
        entity_counts = {}
        for entity_type, _, _ in self.known_addresses.values():
            entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
        
        return {
            "total_known_addresses": len(self.known_addresses),
            "entity_type_counts": entity_counts,
            "classification_patterns": self.address_patterns
        }
