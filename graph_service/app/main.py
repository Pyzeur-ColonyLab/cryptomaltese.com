"""Main FastAPI application for the Graph Mapping Service."""

import structlog
import time
import json
from contextlib import asynccontextmanager
from typing import Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from .config import settings
from .db import db_manager
from .jobs import job_manager
from .schemas import (
    ProcessIncidentRequest,
    ProcessIncidentResponse,
    JobStatusResponse,
    HealthCheckResponse,
    ErrorResponse,
    ConflictResponse
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Track service uptime
service_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - startup and shutdown."""
    # Startup
    logger.info("Starting Graph Mapping Service", version=settings.app_version)
    
    try:
        # Initialize database
        await db_manager.initialize()
        
        # Initialize job manager
        await job_manager.initialize()
        
        logger.info("Graph Mapping Service started successfully")
        yield
        
    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    
    finally:
        # Shutdown
        logger.info("Shutting down Graph Mapping Service")
        
        try:
            await job_manager.shutdown()
            await db_manager.close()
            logger.info("Graph Mapping Service shutdown complete")
        except Exception as e:
            logger.error("Error during shutdown", error=str(e))


# Create FastAPI app
app = FastAPI(
    title="Graph Mapping Service",
    description="Transaction flow graph mapping service for cryptocurrency incident analysis",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*"]
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error("Unhandled exception", 
                 path=str(request.url.path),
                 method=request.method,
                 error=str(exc),
                 error_type=type(exc).__name__)
    
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": "An internal error occurred"
        }
    )


# Health check endpoint
@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Check service health status."""
    uptime_seconds = int(time.time() - service_start_time)
    
    # Check database health
    db_health = await db_manager.health_check()
    
    # Check external API health  
    etherscan_health = await job_manager.etherscan_service.health_check()
    
    # Determine overall status
    overall_status = "healthy"
    if db_health["status"] != "connected":
        overall_status = "unhealthy"
    elif etherscan_health["status"] != "available":
        overall_status = "degraded"
    
    return HealthCheckResponse(
        status=overall_status,
        timestamp=datetime.now(),
        uptime_seconds=uptime_seconds,
        database=db_health,
        external_apis={"etherscan": etherscan_health}
    )


# Process incident endpoint
@app.post("/process_incident/{incident_id}")
async def process_incident(
    incident_id: str,
    request: ProcessIncidentRequest = ProcessIncidentRequest()
):
    """Start graph processing for an incident."""
    logger.info("Processing incident request", incident_id=incident_id)
    
    try:
        # Validate UUID format (basic check)
        if len(incident_id) != 36 or incident_id.count('-') != 4:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "error_code": "INVALID_INCIDENT_ID",
                    "message": "Invalid incident ID format"
                }
            )
        
        # Start job
        result = await job_manager.start_job(
            incident_id,
            options=request.options.model_dump() if request.options else None
        )
        
        # Handle different response types - use jsonable_encoder for proper serialization
        if result["status"] == "accepted":
            return JSONResponse(
                status_code=202,
                content=jsonable_encoder(result)
            )
        elif result["status"] == "conflict":
            return JSONResponse(
                status_code=409,
                content=jsonable_encoder(result)
            )
        elif result["status"] == "error":
            if result["error_code"] == "INCIDENT_NOT_FOUND":
                return JSONResponse(
                    status_code=404,
                    content=jsonable_encoder(result)
                )
            else:
                return JSONResponse(
                    status_code=400,
                    content=jsonable_encoder(result)
                )
        else:
            # Unexpected status
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "error_code": "UNEXPECTED_RESPONSE",
                    "message": "Unexpected response from job manager"
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing incident", 
                    incident_id=incident_id, 
                    error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "error_code": "PROCESSING_ERROR",
                "message": "Failed to start processing"
            }
        )


# Get job status endpoint
@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a processing job."""
    logger.debug("Getting job status", job_id=job_id)
    
    try:
        # Validate UUID format (basic check)
        if len(job_id) != 36 or job_id.count('-') != 4:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "error_code": "INVALID_JOB_ID",
                    "message": "Invalid job ID format"
                }
            )
        
        # Get job status
        result = await job_manager.get_job_status(job_id)
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "error_code": "JOB_NOT_FOUND",
                    "message": f"Job with ID {job_id} not found"
                }
            )
        
        return JSONResponse(
            status_code=200,
            content=jsonable_encoder(result)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting job status", 
                    job_id=job_id, 
                    error=str(e))
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "error_code": "STATUS_ERROR",
                "message": "Failed to get job status"
            }
        )


# Service statistics endpoint (for monitoring)
@app.get("/stats")
async def get_service_stats():
    """Get service statistics for monitoring."""
    uptime_seconds = int(time.time() - service_start_time)
    
    # Get job manager stats
    job_stats = job_manager.get_job_stats()
    
    # Get Etherscan cache stats
    etherscan_stats = job_manager.etherscan_service.get_cache_stats()
    
    # Get classifier stats
    classifier_stats = job_manager.classifier.get_classification_stats()
    
    return {
        "service": {
            "name": settings.app_name,
            "version": settings.app_version,
            "uptime_seconds": uptime_seconds,
            "debug_mode": settings.debug
        },
        "jobs": job_stats,
        "etherscan_cache": etherscan_stats,
        "classifier": classifier_stats,
        "limits": settings.get_processing_limits()
    }


# Root endpoint
@app.get("/")
async def root():
    """Service information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/health"
    }


# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    """Log all HTTP requests."""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Log request details
    process_time = time.time() - start_time
    logger.info("HTTP request",
               method=request.method,
               path=str(request.url.path),
               query_params=str(request.query_params),
               status_code=response.status_code,
               process_time=round(process_time, 3))
    
    return response


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
