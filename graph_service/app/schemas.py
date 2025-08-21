"""Pydantic schemas for API request and response validation."""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class GraphProcessingOptions(BaseModel):
    """Options for graph processing."""
    max_depth: Optional[int] = Field(default=8, ge=1, le=10)
    max_api_calls: Optional[int] = Field(default=25, ge=1, le=50)
    timeout_seconds: Optional[int] = Field(default=30, ge=10, le=120)


class ProcessIncidentRequest(BaseModel):
    """Request to process incident graph."""
    options: Optional[GraphProcessingOptions] = None


class JobStatus(str, Enum):
    """Job processing status."""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    TIMEOUT = "timeout"
    ERROR = "error"


class ProgressInfo(BaseModel):
    """Progress information for running jobs."""
    percentage: int = Field(ge=0, le=100)
    current_step: str
    nodes_processed: int
    edges_created: int
    api_calls_used: int
    api_calls_remaining: int


class ErrorInfo(BaseModel):
    """Error information for failed jobs."""
    error_code: str
    message: str
    details: Optional[str] = None


class TopPath(BaseModel):
    """Information about a significant transaction path."""
    path_id: int
    value_eth: str
    value_percentage: float
    hop_count: int
    final_endpoint_type: str
    final_endpoint_confidence: int


class GraphResults(BaseModel):
    """Results from completed graph processing."""
    total_nodes: int
    total_edges: int
    max_depth: int
    total_value_traced: str
    processing_time_seconds: int
    endpoint_summary: Dict[str, int]
    top_paths: List[TopPath] = Field(default_factory=list)


class PartialResults(BaseModel):
    """Partial results from incomplete processing."""
    total_nodes: int
    total_edges: int
    max_depth: int


class ProcessIncidentResponse(BaseModel):
    """Response from processing incident request."""
    status: str = "accepted"
    job_id: str
    incident_id: str
    message: str
    created_at: datetime
    estimated_completion: datetime


class JobStatusResponse(BaseModel):
    """Response from job status request."""
    status: JobStatus
    job_id: str
    incident_id: str
    
    # For running jobs
    progress: Optional[ProgressInfo] = None
    started_at: datetime
    estimated_completion: Optional[datetime] = None
    
    # For completed jobs
    results: Optional[GraphResults] = None
    completed_at: Optional[datetime] = None
    
    # For failed jobs
    error: Optional[ErrorInfo] = None
    failed_at: Optional[datetime] = None
    
    # For timeout jobs
    timeout_at: Optional[datetime] = None
    message: Optional[str] = None
    
    # Partial results (for timeout/error cases)
    partial_results: Optional[PartialResults] = None

    model_config = ConfigDict(use_enum_values=True)


class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = "error"
    error_code: str
    message: str
    details: Optional[str] = None


class ConflictResponse(BaseModel):
    """Response for conflict situations."""
    status: str = "conflict"
    error_code: str
    message: str
    existing_job_id: str


class DatabaseHealthInfo(BaseModel):
    """Database health information."""
    status: str
    connection_pool: Optional[Dict[str, int]] = None
    error: Optional[str] = None


class ExternalAPIHealthInfo(BaseModel):
    """External API health information."""
    status: str
    last_check: datetime


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    service: str = "graph-mapping-service"
    version: str = "1.0.0"
    timestamp: datetime
    uptime_seconds: int
    database: DatabaseHealthInfo
    external_apis: Dict[str, ExternalAPIHealthInfo]


# Transaction related schemas for internal use
class TransactionData(BaseModel):
    """Internal representation of transaction data."""
    block_number: int
    timestamp: Optional[datetime]
    from_address: str
    to_address: str
    value: str
    gas: Optional[int]
    gas_used: Optional[int] 
    gas_price: Optional[int]
    transaction_hash: str


class NodeData(BaseModel):
    """Internal representation of graph node data."""
    address: str
    entity_type: str = "Unknown"
    confidence_score: float = 0.0
    depth_from_hack: int = 0
    balance_eth: str = "0"
    transaction_count: int = 0
    endpoint_type: str = "Unknown"
    termination_reason: Optional[str] = None
    manual_exploration_ready: bool = False
    attributes: Dict[str, Any] = Field(default_factory=dict)


class EdgeData(BaseModel):
    """Internal representation of graph edge data."""
    from_address: str
    to_address: str
    transaction_hash: str
    value_eth: str
    priority_score: int = 0
    block_number: Optional[int] = None
    timestamp: Optional[datetime] = None
    gas_used: Optional[int] = None
    gas_price: Optional[int] = None
    filter_reason: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
