#!/usr/bin/env python3
"""
Test script for the Graph Mapping Service.
Tests both direct service functionality and API endpoints.
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any

# Test configuration
GRAPH_SERVICE_URL = "http://localhost:8000"
NODE_API_URL = "http://localhost:3000"

# Sample test data - real Ethereum incident for testing
SAMPLE_INCIDENT = {
    "id": str(uuid.uuid4()),
    "title": "Test Incident - FTX Hack Simulation",
    "description": "Test incident using known transaction patterns",
    "hack_transaction_hash": "0x2b023d65485c4bb68d781960c2196588d03b871dc9eb1b1a6cd9f2b7e37d0b5",  # Real FTX hack tx
    "victim_address": "0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2",  # FTX hot wallet
    "hacker_address": "0x59ABf3837Fa962d6853b4Cc0a19513AA031fd32b",  # FTX exploiter
    "amount_stolen_eth": "10.5",
    "block_number": 15853820,
    "status": "active"
}

class GraphServiceTester:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.http_client.aclose()

    async def test_health_check(self) -> Dict[str, Any]:
        """Test the health check endpoint."""
        print("🏥 Testing health check...")
        
        try:
            response = await self.http_client.get(f"{GRAPH_SERVICE_URL}/health")
            result = response.json()
            
            print(f"✅ Health Status: {result.get('status')}")
            print(f"   Database: {result.get('database', {}).get('status')}")
            print(f"   Etherscan: {result.get('external_apis', {}).get('etherscan', {}).get('status')}")
            print(f"   Uptime: {result.get('uptime_seconds')}s")
            
            return result
            
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return {"status": "error", "error": str(e)}

    async def test_stats_endpoint(self) -> Dict[str, Any]:
        """Test the stats endpoint."""
        print("\n📊 Testing stats endpoint...")
        
        try:
            response = await self.http_client.get(f"{GRAPH_SERVICE_URL}/stats")
            result = response.json()
            
            print(f"✅ Stats retrieved:")
            print(f"   Active jobs: {result.get('active_jobs', 0)}")
            print(f"   Completed jobs: {result.get('completed_jobs', 0)}")
            print(f"   Total incidents processed: {result.get('total_incidents_processed', 0)}")
            
            return result
            
        except Exception as e:
            print(f"❌ Stats check failed: {e}")
            return {"status": "error", "error": str(e)}

    async def create_test_incident(self) -> str:
        """Create a test incident in the database via Node.js API."""
        print("\n🔨 Creating test incident...")
        
        try:
            # Use the Node.js API to create incident
            response = await self.http_client.post(
                f"{NODE_API_URL}/api/incidents",
                json=SAMPLE_INCIDENT
            )
            
            if response.status_code == 201:
                incident_data = response.json()
                incident_id = incident_data.get("id", SAMPLE_INCIDENT["id"])
                print(f"✅ Test incident created: {incident_id}")
                return incident_id
            else:
                print(f"❌ Failed to create incident: {response.status_code}")
                print(f"   Response: {response.text}")
                return SAMPLE_INCIDENT["id"]  # Fallback to our UUID
                
        except Exception as e:
            print(f"⚠️ Node.js API not available, using direct incident ID: {e}")
            return SAMPLE_INCIDENT["id"]

    async def test_process_incident(self, incident_id: str) -> Dict[str, Any]:
        """Test processing an incident."""
        print(f"\n🔄 Testing incident processing for {incident_id}...")
        
        try:
            # Start processing
            response = await self.http_client.post(
                f"{GRAPH_SERVICE_URL}/process_incident/{incident_id}",
                json={
                    "options": {
                        "max_depth": 3,  # Reduced for testing
                        "min_value_eth": 0.01,  # Lower threshold for testing
                        "priority_threshold": 0.3
                    }
                }
            )
            
            if response.status_code == 202:
                result = response.json()
                job_id = result.get("job_id")
                print(f"✅ Processing started, job ID: {job_id}")
                return result
            elif response.status_code == 409:
                result = response.json()
                job_id = result.get("job_id")
                print(f"⚠️ Job already exists: {job_id}")
                return result
            else:
                print(f"❌ Failed to start processing: {response.status_code}")
                print(f"   Response: {response.text}")
                return {"status": "error", "response": response.text}
                
        except Exception as e:
            print(f"❌ Process incident failed: {e}")
            return {"status": "error", "error": str(e)}

    async def test_job_status(self, job_id: str) -> Dict[str, Any]:
        """Test job status monitoring."""
        print(f"\n👀 Monitoring job status for {job_id}...")
        
        max_polls = 20  # Maximum polling attempts
        poll_count = 0
        
        while poll_count < max_polls:
            try:
                response = await self.http_client.get(f"{GRAPH_SERVICE_URL}/jobs/{job_id}")
                result = response.json()
                
                status = result.get("status")
                progress = result.get("progress", {})
                
                print(f"   Status: {status} | Nodes: {progress.get('nodes_processed', 0)} | Edges: {progress.get('edges_created', 0)}")
                
                if status in ["completed", "failed"]:
                    if status == "completed":
                        print(f"✅ Job completed successfully!")
                        print(f"   Final stats: {json.dumps(progress, indent=2)}")
                    else:
                        print(f"❌ Job failed: {result.get('error')}")
                    return result
                
                poll_count += 1
                await asyncio.sleep(2)  # Wait 2 seconds between polls
                
            except Exception as e:
                print(f"❌ Status check failed: {e}")
                return {"status": "error", "error": str(e)}
        
        print("⏰ Polling timeout reached")
        return {"status": "timeout"}

    async def test_integration_flow(self):
        """Test the complete integration flow via Node.js API."""
        print("\n🔗 Testing full integration flow...")
        
        try:
            # 1. Create incident via Node.js
            incident_id = await self.create_test_incident()
            
            # 2. Start graph processing via Node.js proxy
            response = await self.http_client.post(
                f"{NODE_API_URL}/api/incidents/{incident_id}/graph",
                json={"max_depth": 2, "min_value_eth": 0.05}
            )
            
            if response.status_code == 202:
                result = response.json()
                job_id = result.get("job_id")
                print(f"✅ Integration flow started, job ID: {job_id}")
                
                # 3. Monitor via Node.js proxy
                max_polls = 10
                for i in range(max_polls):
                    status_response = await self.http_client.get(
                        f"{NODE_API_URL}/api/incidents/{incident_id}/graph"
                    )
                    
                    if status_response.status_code == 200:
                        status_result = status_response.json()
                        status = status_result.get("status")
                        print(f"   Integration status: {status}")
                        
                        if status in ["completed", "failed"]:
                            return status_result
                    
                    await asyncio.sleep(3)
                
                return {"status": "timeout"}
            else:
                print(f"❌ Integration flow failed: {response.status_code}")
                return {"status": "error"}
                
        except Exception as e:
            print(f"❌ Integration test failed: {e}")
            return {"status": "error", "error": str(e)}

async def main():
    """Run all tests."""
    print("🚀 Starting Graph Service Tests")
    print("=" * 50)
    
    async with GraphServiceTester() as tester:
        # Test 1: Health Check
        health_result = await tester.test_health_check()
        
        if health_result.get("status") != "healthy":
            print("\n❌ Service not healthy, stopping tests")
            return
        
        # Test 2: Stats
        await tester.test_stats_endpoint()
        
        # Test 3: Create test incident
        incident_id = await tester.create_test_incident()
        
        # Test 4: Direct graph service processing
        process_result = await tester.test_process_incident(incident_id)
        
        if process_result.get("job_id"):
            # Test 5: Monitor job status
            await tester.test_job_status(process_result["job_id"])
        
        # Test 6: Full integration flow (if Node.js is running)
        print("\n" + "=" * 50)
        await tester.test_integration_flow()
    
    print("\n🎉 Testing complete!")

if __name__ == "__main__":
    asyncio.run(main())
