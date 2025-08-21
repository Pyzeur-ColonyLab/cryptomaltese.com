"""Job orchestration system for managing async graph processing tasks."""

import asyncio
import time
import structlog
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
from uuid import uuid4

from .config import settings
from .db import db_manager, IncidentRepository, GraphRepository
from .services.graph import GraphMappingService
from .services.etherscan import EtherscanService
from .services.classification import AddressClassifier

logger = structlog.get_logger()


class JobManager:
    """Manages async job processing for graph mapping."""
    
    def __init__(self):
        # In-memory job tracking (would use Redis/queue in production)
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.job_tasks: Dict[str, asyncio.Task] = {}
        
        # Service instances
        self.incident_repo = IncidentRepository(db_manager)
        self.graph_repo = GraphRepository(db_manager)
        self.etherscan_service = EtherscanService()
        self.classifier = AddressClassifier()
        
        # Rate limiting
        self.last_job_start: Optional[float] = None
        self.min_job_interval = 1.0  # Minimum seconds between jobs
    
    async def initialize(self):
        """Initialize services."""
        await self.etherscan_service.initialize()
        logger.info("Job manager initialized")
    
    async def shutdown(self):
        """Clean shutdown - cancel running jobs."""
        logger.info("Shutting down job manager")
        
        # Cancel all running tasks
        for job_id, task in self.job_tasks.items():
            if not task.done():
                logger.info("Cancelling job", job_id=job_id)
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        await self.etherscan_service.close()
        logger.info("Job manager shutdown complete")
    
    async def start_job(self, incident_id: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Start a new graph processing job.
        
        Args:
            incident_id: UUID of incident to process
            options: Optional processing options
            
        Returns:
            Job creation response
        """
        # Check if job already exists for this incident
        existing_status = await self.graph_repo.get_graph_status(incident_id)
        if existing_status and existing_status["status"] in ["pending", "running"]:
            return {
                "status": "conflict",
                "error_code": "ALREADY_PROCESSING",
                "message": "Graph processing already in progress for this incident",
                "existing_job_id": incident_id  # Using incident_id as job_id for simplicity
            }
        
        # Rate limiting check
        if self.last_job_start:
            time_since_last = time.time() - self.last_job_start
            if time_since_last < self.min_job_interval:
                await asyncio.sleep(self.min_job_interval - time_since_last)
        
        # Verify incident exists
        incident = await self.incident_repo.get_incident_by_id(incident_id)
        if not incident:
            return {
                "status": "error",
                "error_code": "INCIDENT_NOT_FOUND",
                "message": f"Incident with ID {incident_id} not found"
            }
        
        # Create job record
        job_id = incident_id  # Using incident_id as job_id for simplicity
        created_at = datetime.now()
        estimated_completion = created_at + timedelta(seconds=30)
        
        self.active_jobs[job_id] = {
            "job_id": job_id,
            "incident_id": incident_id,
            "status": "pending",
            "created_at": created_at,
            "estimated_completion": estimated_completion,
            "options": options or {}
        }
        
        # Create incident graph record in database
        await self.graph_repo.create_incident_graph(incident_id)
        
        # Start async processing task
        graph_service = GraphMappingService(
            self.incident_repo,
            self.graph_repo, 
            self.etherscan_service,
            self.classifier
        )
        
        task = asyncio.create_task(self._process_job(job_id, graph_service))
        self.job_tasks[job_id] = task
        
        self.last_job_start = time.time()
        
        logger.info("Started graph processing job", 
                   job_id=job_id, 
                   incident_id=incident_id)
        
        return {
            "status": "accepted",
            "job_id": job_id,
            "incident_id": incident_id,
            "message": "Graph processing started",
            "created_at": created_at,
            "estimated_completion": estimated_completion
        }
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of a job.
        
        Args:
            job_id: Job ID to query
            
        Returns:
            Job status information or None if not found
        """
        # Check in-memory first
        if job_id in self.active_jobs:
            job_info = self.active_jobs[job_id]
            
            # Get latest status from database
            graph_status = await self.graph_repo.get_graph_status(job_id)
            if graph_status:
                return self._build_status_response(job_info, graph_status)
        
        # Check database for completed/failed jobs
        graph_status = await self.graph_repo.get_graph_status(job_id)
        if graph_status:
            # Create minimal job info for completed jobs
            job_info = {
                "job_id": job_id,
                "incident_id": job_id,  # Same as job_id in our case
                "created_at": graph_status["created_at"]
            }
            return self._build_status_response(job_info, graph_status)
        
        return None
    
    def _build_status_response(self, job_info: Dict[str, Any], graph_status: Dict[str, Any]) -> Dict[str, Any]:
        """Build job status response from job info and graph status."""
        response = {
            "status": graph_status["status"],
            "job_id": job_info["job_id"],
            "incident_id": job_info["incident_id"],
            "started_at": job_info["created_at"]
        }
        
        # Add status-specific fields
        if graph_status["status"] == "running":
            if graph_status["progress_percentage"]:
                # Calculate estimated remaining time
                progress = graph_status["progress_percentage"]
                if progress > 5:  # Avoid division by very small numbers
                    elapsed = (datetime.now() - job_info["created_at"]).total_seconds()
                    estimated_total = elapsed * 100 / progress
                    remaining = max(0, estimated_total - elapsed)
                    estimated_completion = datetime.now() + timedelta(seconds=remaining)
                else:
                    estimated_completion = job_info.get("estimated_completion")
                
                # Calculate API calls remaining
                api_calls_used = graph_status.get("api_calls_used", 0)
                api_calls_remaining = max(0, settings.max_api_calls_per_incident - api_calls_used)
                
                response.update({
                    "progress": {
                        "percentage": graph_status["progress_percentage"],
                        "current_step": graph_status.get("current_step", "initializing"),
                        "nodes_processed": 0,  # Would need to track this
                        "edges_created": 0,    # Would need to track this
                        "api_calls_used": api_calls_used,
                        "api_calls_remaining": api_calls_remaining
                    },
                    "estimated_completion": estimated_completion
                })
        
        elif graph_status["status"] == "completed":
            # Build results from graph metadata
            response.update({
                "results": {
                    "total_nodes": graph_status.get("total_nodes", 0),
                    "total_edges": graph_status.get("total_edges", 0),
                    "max_depth": graph_status.get("max_depth", 0),
                    "total_value_traced": str(graph_status.get("total_value_traced", "0")),
                    "processing_time_seconds": graph_status.get("processing_time_seconds", 0),
                    "endpoint_summary": graph_status.get("endpoint_summary", {}),
                    "top_paths": graph_status.get("top_paths", [])
                },
                "completed_at": graph_status["updated_at"]
            })
        
        elif graph_status["status"] == "error":
            response.update({
                "error": {
                    "error_code": graph_status.get("error_code", "UNKNOWN_ERROR"),
                    "message": graph_status.get("error_message", "Unknown error occurred"),
                    "details": None
                },
                "failed_at": graph_status["updated_at"]
            })
            
            # Add partial results if available
            if graph_status.get("partial_results"):
                response["partial_results"] = graph_status["partial_results"]
        
        elif graph_status["status"] == "timeout":
            response.update({
                "message": graph_status.get("error_message", "Processing timeout"),
                "timeout_at": graph_status["updated_at"]
            })
            
            # Add partial results if available
            if graph_status.get("partial_results"):
                response["partial_results"] = graph_status["partial_results"]
        
        return response
    
    async def _process_job(self, job_id: str, graph_service: GraphMappingService):
        """
        Process a graph mapping job asynchronously.
        
        Args:
            job_id: Job ID
            graph_service: Graph mapping service instance
        """
        try:
            logger.info("Processing job started", job_id=job_id)
            
            # Update status to running
            await self.graph_repo.update_graph_status(
                job_id, "running", progress=5, current_step="initialization"
            )
            
            # Process the incident
            result = await graph_service.process_incident(job_id)
            
            # Clean up completed job
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            if job_id in self.job_tasks:
                del self.job_tasks[job_id]
            
            logger.info("Processing job completed", 
                       job_id=job_id,
                       status=result.get("status"),
                       nodes=result.get("total_nodes", 0),
                       edges=result.get("total_edges", 0))
        
        except asyncio.CancelledError:
            logger.info("Processing job cancelled", job_id=job_id)
            
            # Update status to cancelled/error
            await self.graph_repo.update_graph_status(
                job_id, "error", 
                error_message="Job was cancelled",
                error_code="JOB_CANCELLED"
            )
            
            # Clean up
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            if job_id in self.job_tasks:
                del self.job_tasks[job_id]
        
        except Exception as e:
            logger.error("Processing job failed", job_id=job_id, error=str(e))
            
            # Error should already be handled by graph_service, but ensure cleanup
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            if job_id in self.job_tasks:
                del self.job_tasks[job_id]
    
    def get_job_stats(self) -> Dict[str, Any]:
        """Get statistics about job processing."""
        active_count = len(self.active_jobs)
        task_count = len(self.job_tasks)
        
        # Count by status
        status_counts = {}
        for job in self.active_jobs.values():
            status = job["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "active_jobs": active_count,
            "active_tasks": task_count,
            "status_breakdown": status_counts,
            "last_job_start": self.last_job_start,
            "rate_limit_interval": self.min_job_interval
        }


# Global job manager instance
job_manager = JobManager()
