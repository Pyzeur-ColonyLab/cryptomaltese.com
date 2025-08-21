"""Configuration settings for the Graph Mapping Service."""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Service Configuration
    app_name: str = "Graph Mapping Service"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Database Configuration
    database_url: str
    database_pool_min_size: int = 5
    database_pool_max_size: int = 10
    database_timeout: int = 30
    
    # Etherscan API Configuration
    etherscan_api_key: str
    etherscan_base_url: str = "https://api.etherscan.io/api"
    etherscan_timeout: int = 30
    etherscan_retry_attempts: int = 3
    etherscan_retry_delay: float = 1.0
    
    # Graph Processing Configuration
    max_nodes_per_graph: int = 500
    max_api_calls_per_incident: int = 25
    max_transactions_per_node: int = 5
    processing_timeout_seconds: int = 30
    max_depth: int = 8
    
    # Cache Configuration
    cache_ttl_seconds: int = 600  # 10 minutes
    
    # Minimum values for transaction filtering
    min_transaction_value_eth: float = 0.05
    min_percentage_small_hack: float = 1.0    # <10 ETH
    min_percentage_medium_hack: float = 0.5   # 10-100 ETH  
    min_percentage_large_hack: float = 0.1    # >100 ETH
    
    # Time-based filtering (hours)
    high_priority_hours: int = 6
    medium_priority_hours: int = 72
    low_priority_days: int = 30
    
    # Service termination thresholds
    high_frequency_tx_threshold: int = 100  # transactions per day
    max_outgoing_tx_threshold: int = 200
    reuse_threshold: int = 3  # address seen 3+ times
    
    # Node.js Service Integration
    node_service_url: Optional[str] = "http://localhost:3000"
    allowed_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        case_sensitive = False
        
    def get_database_config(self) -> dict:
        """Get database connection configuration."""
        return {
            "dsn": self.database_url,
            "min_size": self.database_pool_min_size,
            "max_size": self.database_pool_max_size,
            "command_timeout": self.database_timeout
        }
    
    def get_etherscan_config(self) -> dict:
        """Get Etherscan API configuration."""
        return {
            "api_key": self.etherscan_api_key,
            "base_url": self.etherscan_base_url,
            "timeout": self.etherscan_timeout,
            "retry_attempts": self.etherscan_retry_attempts,
            "retry_delay": self.etherscan_retry_delay
        }
    
    def get_processing_limits(self) -> dict:
        """Get processing constraint configuration.""" 
        return {
            "max_nodes": self.max_nodes_per_graph,
            "max_api_calls": self.max_api_calls_per_incident,
            "max_transactions_per_node": self.max_transactions_per_node,
            "timeout_seconds": self.processing_timeout_seconds,
            "max_depth": self.max_depth
        }


# Global settings instance
settings = Settings()
