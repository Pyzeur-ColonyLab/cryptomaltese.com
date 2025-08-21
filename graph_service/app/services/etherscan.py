"""Etherscan API client service."""

import asyncio
import httpx
import structlog
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from tenacity import (
    retry, 
    stop_after_attempt, 
    wait_exponential,
    retry_if_exception_type
)

from ..config import settings
from ..schemas import TransactionData

logger = structlog.get_logger()


class EtherscanError(Exception):
    """Custom exception for Etherscan API errors."""
    pass


class EtherscanRateLimitError(EtherscanError):
    """Exception for rate limit errors.""" 
    pass


class EtherscanService:
    """Async Etherscan API client with caching and rate limiting."""
    
    def __init__(self):
        self.config = settings.get_etherscan_config()
        self.client: Optional[httpx.AsyncClient] = None
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = settings.cache_ttl_seconds
        
    async def initialize(self):
        """Initialize HTTP client."""
        self.client = httpx.AsyncClient(
            base_url=self.config["base_url"],
            timeout=self.config["timeout"],
            headers={"User-Agent": "GraphMappingService/1.0"}
        )
        logger.info("Etherscan service initialized")
    
    async def close(self):
        """Close HTTP client."""
        if self.client:
            await self.client.aclose()
            logger.info("Etherscan service closed")
    
    def _get_cache_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate cache key for request."""
        param_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()) if k != "apikey")
        return f"{endpoint}:{param_str}"
    
    def _is_cache_valid(self, cache_entry: Dict[str, Any]) -> bool:
        """Check if cache entry is still valid."""
        if "timestamp" not in cache_entry:
            return False
        cache_time = cache_entry["timestamp"]
        return datetime.now() - cache_time < timedelta(seconds=self.cache_ttl)
    
    def _cache_response(self, cache_key: str, response: Dict[str, Any]):
        """Cache API response."""
        self.cache[cache_key] = {
            "data": response,
            "timestamp": datetime.now()
        }
    
    def _get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response if valid."""
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if self._is_cache_valid(entry):
                logger.debug("Cache hit", cache_key=cache_key)
                return entry["data"]
            else:
                # Remove expired entry
                del self.cache[cache_key]
        return None
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, EtherscanError))
    )
    async def _make_request(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to Etherscan API with retries."""
        if not self.client:
            raise RuntimeError("Etherscan client not initialized")
        
        # Add API key
        params["apikey"] = self.config["api_key"]
        
        try:
            response = await self.client.get("", params=params)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for API-level errors
            if isinstance(data, dict):
                if data.get("status") == "0" and data.get("message") != "No transactions found":
                    error_msg = data.get("message", "Unknown API error")
                    if "rate limit" in error_msg.lower():
                        raise EtherscanRateLimitError(error_msg)
                    else:
                        raise EtherscanError(error_msg)
                        
                # Check for JSON-RPC errors
                if "error" in data:
                    error_msg = data["error"].get("message", "Unknown RPC error")
                    raise EtherscanError(error_msg)
            
            return data
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise EtherscanRateLimitError("Rate limit exceeded")
            logger.error("HTTP error from Etherscan", 
                        status_code=e.response.status_code,
                        response=e.response.text)
            raise EtherscanError(f"HTTP {e.response.status_code}: {e.response.text}")
        
        except httpx.RequestError as e:
            logger.error("Network error calling Etherscan", error=str(e))
            raise EtherscanError(f"Network error: {str(e)}")
    
    async def get_account_transactions(
        self,
        address: str,
        start_block: int = 0,
        end_block: int = 99999999,
        page: int = 1,
        offset: int = 50,
        sort: str = "asc"
    ) -> List[Dict[str, Any]]:
        """Get normal transactions for an address."""
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": start_block,
            "endblock": end_block,
            "page": page,
            "offset": offset,
            "sort": sort
        }
        
        cache_key = self._get_cache_key("account_txlist", params)
        
        # Check cache first
        cached_response = self._get_cached_response(cache_key)
        if cached_response:
            return cached_response.get("result", [])
        
        logger.debug("Fetching account transactions", address=address, start_block=start_block)
        
        response = await self._make_request(params)
        self._cache_response(cache_key, response)
        
        return response.get("result", [])
    
    async def get_transaction_by_hash(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """Get transaction details by hash."""
        params = {
            "module": "proxy",
            "action": "eth_getTransactionByHash",
            "txhash": tx_hash
        }
        
        cache_key = self._get_cache_key("tx_by_hash", params)
        
        # Check cache first
        cached_response = self._get_cached_response(cache_key)
        if cached_response:
            return cached_response.get("result")
        
        logger.debug("Fetching transaction by hash", tx_hash=tx_hash)
        
        response = await self._make_request(params)
        self._cache_response(cache_key, response)
        
        return response.get("result")
    
    async def get_transaction_receipt(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """Get transaction receipt by hash."""
        params = {
            "module": "proxy",
            "action": "eth_getTransactionReceipt", 
            "txhash": tx_hash
        }
        
        cache_key = self._get_cache_key("tx_receipt", params)
        
        # Check cache first
        cached_response = self._get_cached_response(cache_key)
        if cached_response:
            return cached_response.get("result")
        
        logger.debug("Fetching transaction receipt", tx_hash=tx_hash)
        
        response = await self._make_request(params)
        self._cache_response(cache_key, response)
        
        return response.get("result")
    
    def normalize_transaction(self, raw_tx: Dict[str, Any]) -> TransactionData:
        """Normalize raw Etherscan transaction data."""
        def hex_to_int(hex_str: str) -> int:
            """Convert hex string to integer."""
            if not hex_str or hex_str in ("0x", "0x0"):
                return 0
            return int(hex_str, 16)
        
        def hex_to_decimal_string(hex_str: str) -> str:
            """Convert hex to decimal string for large numbers."""
            if not hex_str or hex_str in ("0x", "0x0"):
                return "0"
            return str(int(hex_str, 16))
        
        # Handle timestamp conversion
        timestamp = None
        if "timeStamp" in raw_tx:
            try:
                timestamp = datetime.fromtimestamp(int(raw_tx["timeStamp"]))
            except (ValueError, TypeError):
                pass
        
        return TransactionData(
            block_number=hex_to_int(raw_tx.get("blockNumber", "0x0")),
            timestamp=timestamp,
            from_address=raw_tx.get("from", "").lower(),
            to_address=raw_tx.get("to", "").lower() if raw_tx.get("to") else "",
            value=hex_to_decimal_string(raw_tx.get("value", "0x0")),
            gas=hex_to_int(raw_tx.get("gas", "0x0")),
            gas_used=hex_to_int(raw_tx.get("gasUsed", "0x0")),
            gas_price=hex_to_int(raw_tx.get("gasPrice", "0x0")),
            transaction_hash=raw_tx.get("hash", "")
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if Etherscan API is accessible."""
        try:
            # Simple test call to get latest block
            params = {
                "module": "proxy", 
                "action": "eth_blockNumber"
            }
            
            response = await self._make_request(params)
            
            return {
                "status": "available",
                "last_check": datetime.now()
            }
        except Exception as e:
            logger.error("Etherscan health check failed", error=str(e))
            return {
                "status": "unavailable",
                "last_check": datetime.now(),
                "error": str(e)
            }
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        valid_entries = sum(1 for entry in self.cache.values() if self._is_cache_valid(entry))
        
        return {
            "total_entries": len(self.cache),
            "valid_entries": valid_entries,
            "expired_entries": len(self.cache) - valid_entries,
            "ttl_seconds": self.cache_ttl
        }
    
    def clear_cache(self):
        """Clear all cached responses."""
        self.cache.clear()
        logger.info("Etherscan cache cleared")
