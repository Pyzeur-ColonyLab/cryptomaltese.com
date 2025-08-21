"""Health check tests for the Graph Mapping Service."""

import asyncio
import httpx
import subprocess
import os
import time
import signal
import pytest
from pathlib import Path


@pytest.mark.asyncio
async def test_health():
    """Test that the service starts up and responds to health checks."""
    # Change to graph service directory
    graph_service_dir = Path(__file__).parent.parent
    os.chdir(graph_service_dir)
    
    # Start uvicorn server in a subprocess
    env = os.environ.copy()
    env["ETHERSCAN_API_KEY"] = "test_key"  # Mock API key for testing
    env["DATABASE_URL"] = "postgresql://postgres:password@localhost:5432/test_db"
    
    proc = subprocess.Popen([
        "uvicorn", "app.main:app", 
        "--port", "8050",  # Use different port to avoid conflicts
        "--host", "127.0.0.1"
    ], env=env)
    
    try:
        # Wait for server to start
        await asyncio.sleep(3)
        
        # Test health endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get("http://127.0.0.1:8050/health", timeout=10.0)
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            
            # Check basic health response structure
            assert "status" in data
            assert "timestamp" in data
            assert "uptime_seconds" in data
            
            # Status should be healthy, unhealthy, or degraded
            assert data["status"] in ["healthy", "unhealthy", "degraded"]
            
            print(f"Health check passed: {data['status']}")
            
    finally:
        # Clean shutdown
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


@pytest.mark.asyncio 
async def test_root_endpoint():
    """Test that the root endpoint returns service information."""
    # Similar setup but testing root endpoint
    graph_service_dir = Path(__file__).parent.parent
    os.chdir(graph_service_dir)
    
    env = os.environ.copy()
    env["ETHERSCAN_API_KEY"] = "test_key"
    env["DATABASE_URL"] = "postgresql://postgres:password@localhost:5432/test_db"
    
    proc = subprocess.Popen([
        "uvicorn", "app.main:app",
        "--port", "8051",  # Different port
        "--host", "127.0.0.1"
    ], env=env)
    
    try:
        await asyncio.sleep(3)
        
        async with httpx.AsyncClient() as client:
            response = await client.get("http://127.0.0.1:8051/", timeout=10.0)
            
            assert response.status_code == 200
            data = response.json()
            
            # Check service info structure
            assert "service" in data
            assert "version" in data
            assert "status" in data
            assert data["service"] == "Graph Mapping Service"
            assert data["status"] == "running"
            
            print(f"Root endpoint test passed: {data}")
            
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def test_import_main_app():
    """Test that the main app can be imported without errors."""
    try:
        from app.main import app
        assert app is not None
        print("App import test passed")
    except ImportError as e:
        pytest.fail(f"Failed to import main app: {e}")


def test_import_all_services():
    """Test that all service modules can be imported."""
    try:
        from app.services import graph, etherscan, classification
        assert graph is not None
        assert etherscan is not None  
        assert classification is not None
        print("Service imports test passed")
    except ImportError as e:
        pytest.fail(f"Failed to import services: {e}")


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])
