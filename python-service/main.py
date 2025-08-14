from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
import uuid
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crypto-Sentinel Algorithm Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://nextjs-app:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class AnalysisRequest(BaseModel):
    analysis_id: int
    incident_id: str
    algorithm_config: Dict[str, Any] = {}

class AnalysisResponse(BaseModel):
    service_id: str
    status: str
    message: str

# In-memory storage for demo (replace with database in production)
active_analyses: Dict[str, Dict[str, Any]] = {}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/analyze-fund-flow")
async def analyze_fund_flow(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start a new fund flow analysis"""
    try:
        # Generate unique service ID
        service_id = str(uuid.uuid4())
        
        # Store analysis request
        active_analyses[service_id] = {
            "analysis_id": request.analysis_id,
            "incident_id": request.incident_id,
            "config": request.algorithm_config,
            "status": "running",
            "started_at": datetime.now(),
            "progress": {}
        }
        
        # Start background analysis task
        background_tasks.add_task(
            run_fund_flow_analysis,
            service_id,
            request.analysis_id,
            request.incident_id,
            request.algorithm_config
        )
        
        logger.info(f"Started analysis {request.analysis_id} with service ID {service_id}")
        
        return AnalysisResponse(
            service_id=service_id,
            status="started",
            message="Analysis started successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to start analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_fund_flow_analysis(service_id: str, analysis_id: int, incident_id: str, config: Dict[str, Any]):
    """Run the fund flow analysis algorithm in the background"""
    try:
        logger.info(f"Starting fund flow analysis for incident {incident_id}")
        
        # Simulate analysis progress
        for step in range(1, 6):
            await asyncio.sleep(2)  # Simulate processing time
            
            # Update progress
            progress = {
                "step": step,
                "total_steps": 5,
                "current_operation": f"Processing step {step}",
                "percentage": (step / 5) * 100
            }
            
            active_analyses[service_id]["progress"] = progress
            
            logger.info(f"Analysis {analysis_id} progress: {step}/5")
        
        # Mark as completed
        active_analyses[service_id]["status"] = "completed"
        active_analyses[service_id]["completed_at"] = datetime.now()
        
        logger.info(f"Analysis {analysis_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {e}")
        active_analyses[service_id]["status"] = "failed"
        active_analyses[service_id]["completed_at"] = datetime.now()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 