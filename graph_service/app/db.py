"""Database connection and utilities for the Graph Mapping Service."""

import asyncpg
import structlog
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from .config import settings

logger = structlog.get_logger()


class DatabaseManager:
    """Manages database connections and operations."""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        
    async def initialize(self):
        """Initialize database connection pool."""
        try:
            config = settings.get_database_config()
            self.pool = await asyncpg.create_pool(**config)
            logger.info("Database connection pool initialized", pool_size=config['max_size'])
        except Exception as e:
            logger.error("Failed to initialize database pool", error=str(e))
            raise
    
    async def close(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection from pool."""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
            
        async with self.pool.acquire() as connection:
            yield connection
    
    async def health_check(self) -> Dict[str, Any]:
        """Check database connectivity and pool status."""
        if not self.pool:
            return {"status": "disconnected", "error": "Pool not initialized"}
        
        try:
            async with self.get_connection() as conn:
                await conn.fetchval("SELECT 1")
                
            pool_stats = {
                "active": len(self.pool._holders) - len(self.pool._queue._queue),
                "idle": len(self.pool._queue._queue), 
                "max": self.pool._maxsize
            }
            
            return {
                "status": "connected",
                "connection_pool": pool_stats
            }
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return {"status": "error", "error": str(e)}


class IncidentRepository:
    """Repository for incident-related database operations."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    async def get_incident_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        """Get incident details by ID."""
        async with self.db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM incidents WHERE id = $1",
                incident_id
            )
            return dict(row) if row else None
    
    async def get_incident_transaction_details(self, incident_id: str) -> List[Dict[str, Any]]:
        """Get transaction details for an incident."""
        async with self.db.get_connection() as conn:
            rows = await conn.fetch(
                "SELECT * FROM transaction_details WHERE incident_id = $1",
                incident_id
            )
            return [dict(row) for row in rows]


class GraphRepository:
    """Repository for graph-related database operations."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    async def create_incident_graph(self, incident_id: str) -> None:
        """Create initial incident graph record."""
        async with self.db.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO incident_graphs (incident_id, status)
                VALUES ($1, 'pending')
                ON CONFLICT (incident_id) DO UPDATE SET
                    status = 'pending',
                    progress_percentage = 0,
                    current_step = NULL,
                    error_message = NULL,
                    error_code = NULL,
                    updated_at = CURRENT_TIMESTAMP
                """,
                incident_id
            )
    
    async def update_graph_status(
        self, 
        incident_id: str, 
        status: str,
        progress: Optional[int] = None,
        current_step: Optional[str] = None,
        error_message: Optional[str] = None,
        error_code: Optional[str] = None,
        partial_results: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update incident graph processing status."""
        async with self.db.get_connection() as conn:
            query_parts = ["UPDATE incident_graphs SET status = $2, updated_at = CURRENT_TIMESTAMP"]
            params = [incident_id, status]
            param_count = 2
            
            if progress is not None:
                param_count += 1
                query_parts.append(f"progress_percentage = ${param_count}")
                params.append(progress)
            
            if current_step is not None:
                param_count += 1
                query_parts.append(f"current_step = ${param_count}")
                params.append(current_step)
                
            if error_message is not None:
                param_count += 1
                query_parts.append(f"error_message = ${param_count}")
                params.append(error_message)
                
            if error_code is not None:
                param_count += 1
                query_parts.append(f"error_code = ${param_count}")
                params.append(error_code)
                
            if partial_results is not None:
                param_count += 1
                query_parts.append(f"partial_results = ${param_count}")
                params.append(partial_results)
            
            query = " , ".join(query_parts) + " WHERE incident_id = $1"
            await conn.execute(query, *params)
    
    async def update_graph_results(
        self,
        incident_id: str,
        total_nodes: int,
        total_edges: int,
        max_depth: int,
        total_value_traced: str,
        processing_time: int,
        api_calls_used: int,
        endpoint_summary: Dict[str, int],
        top_paths: List[Dict[str, Any]]
    ) -> None:
        """Update incident graph with final results."""
        async with self.db.get_connection() as conn:
            await conn.execute(
                """
                UPDATE incident_graphs SET
                    status = 'completed',
                    progress_percentage = 100,
                    total_nodes = $2,
                    total_edges = $3,
                    max_depth = $4,
                    total_value_traced = $5,
                    processing_time_seconds = $6,
                    api_calls_used = $7,
                    endpoint_summary = $8,
                    top_paths = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE incident_id = $1
                """,
                incident_id, total_nodes, total_edges, max_depth, 
                total_value_traced, processing_time, api_calls_used,
                endpoint_summary, top_paths
            )
    
    async def get_graph_status(self, incident_id: str) -> Optional[Dict[str, Any]]:
        """Get current graph processing status."""
        async with self.db.get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM incident_graphs WHERE incident_id = $1",
                incident_id
            )
            return dict(row) if row else None
    
    async def insert_graph_node(
        self,
        incident_id: str,
        address: str,
        entity_type: str = "Unknown",
        confidence_score: float = 0.0,
        depth_from_hack: int = 0,
        **kwargs
    ) -> None:
        """Insert a new graph node."""
        async with self.db.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO graph_nodes (
                    incident_id, address, entity_type, confidence_score, 
                    depth_from_hack, balance_eth, transaction_count,
                    first_seen, endpoint_type, termination_reason,
                    manual_exploration_ready, attributes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (incident_id, address) DO UPDATE SET
                    entity_type = EXCLUDED.entity_type,
                    confidence_score = EXCLUDED.confidence_score,
                    balance_eth = EXCLUDED.balance_eth,
                    transaction_count = EXCLUDED.transaction_count,
                    endpoint_type = EXCLUDED.endpoint_type,
                    termination_reason = EXCLUDED.termination_reason,
                    manual_exploration_ready = EXCLUDED.manual_exploration_ready,
                    attributes = EXCLUDED.attributes
                """,
                incident_id, address, entity_type, confidence_score, depth_from_hack,
                kwargs.get('balance_eth', 0), kwargs.get('transaction_count', 0),
                kwargs.get('first_seen'), kwargs.get('endpoint_type', 'Unknown'),
                kwargs.get('termination_reason'), kwargs.get('manual_exploration_ready', False),
                kwargs.get('attributes', {})
            )
    
    async def insert_graph_edge(
        self,
        incident_id: str,
        from_address: str,
        to_address: str,
        transaction_hash: str,
        value_eth: str,
        **kwargs
    ) -> None:
        """Insert a new graph edge."""
        async with self.db.get_connection() as conn:
            await conn.execute(
                """
                INSERT INTO graph_edges (
                    incident_id, from_address, to_address, transaction_hash,
                    value_eth, value_usd, priority_score, block_number,
                    timestamp, gas_used, gas_price, filter_reason, attributes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (incident_id, from_address, to_address, transaction_hash) DO NOTHING
                """,
                incident_id, from_address, to_address, transaction_hash, value_eth,
                kwargs.get('value_usd'), kwargs.get('priority_score', 0), 
                kwargs.get('block_number'), kwargs.get('timestamp'),
                kwargs.get('gas_used'), kwargs.get('gas_price'),
                kwargs.get('filter_reason'), kwargs.get('attributes', {})
            )


# Global database manager instance
db_manager = DatabaseManager()
