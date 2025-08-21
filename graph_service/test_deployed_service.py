#!/usr/bin/env python3
"""
Test script for deployed CryptoMaltese Graph Service
Tests the deployed API endpoints with a specific incident ID
"""

import requests
import json
import time
import sys
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://195.15.241.120:3000"
GRAPH_SERVICE_URL = "http://195.15.241.120:8000"
INCIDENT_ID = "98d6f77b-d575-4015-a0fb-3e395dde6c26"

def test_api_health():
    """Test if the main API is responding"""
    try:
        response = requests.get(f"{API_BASE_URL}/api/health", timeout=10)
        print(f"✅ API Health Check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ API Health Check Failed: {e}")
        return False

def test_graph_service_health():
    """Test if the graph service is responding"""
    try:
        response = requests.get(f"{GRAPH_SERVICE_URL}/health", timeout=10)
        print(f"✅ Graph Service Health Check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Graph Service Health Check Failed: {e}")
        return False

def start_graph_processing(incident_id: str) -> Dict[str, Any]:
    """Start graph processing for the given incident"""
    try:
        payload = {
            "incident_id": incident_id,
            "addresses": ["0x1234567890abcdef1234567890abcdef12345678"],  # Sample address
            "depth": 2,
            "include_metadata": True
        }
        
        response = requests.post(
            f"{API_BASE_URL}/api/incidents/{incident_id}/graph/process",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"🚀 Start Graph Processing: {response.status_code}")
        if response.status_code in [200, 201, 202]:
            result = response.json()
            print(f"   Response: {json.dumps(result, indent=2)}")
            return result
        else:
            print(f"   Error: {response.text}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Start Graph Processing Failed: {e}")
        return {}

def get_graph_status(incident_id: str) -> Dict[str, Any]:
    """Get the current graph processing status"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/incidents/{incident_id}/graph/status",
            timeout=10
        )
        
        print(f"📊 Graph Status Check: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Response: {json.dumps(result, indent=2)}")
            return result
        else:
            print(f"   Error: {response.text}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Graph Status Check Failed: {e}")
        return {}

def get_graph_data(incident_id: str) -> Dict[str, Any]:
    """Get the processed graph data"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/incidents/{incident_id}/graph",
            timeout=15
        )
        
        print(f"📈 Get Graph Data: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Graph has {len(result.get('nodes', []))} nodes and {len(result.get('edges', []))} edges")
            # Print first few nodes and edges for verification
            if result.get('nodes'):
                print(f"   Sample nodes: {result['nodes'][:2]}")
            if result.get('edges'):
                print(f"   Sample edges: {result['edges'][:2]}")
            return result
        else:
            print(f"   Error: {response.text}")
            return {}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Get Graph Data Failed: {e}")
        return {}

def test_direct_graph_service():
    """Test direct communication with graph service"""
    try:
        # Test direct graph service endpoints
        response = requests.get(f"{GRAPH_SERVICE_URL}/", timeout=10)
        print(f"🔧 Direct Graph Service Root: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
            
        # Test graph processing endpoint directly
        payload = {
            "addresses": ["0x1234567890abcdef1234567890abcdef12345678"],
            "depth": 2,
            "include_metadata": True
        }
        
        response = requests.post(
            f"{GRAPH_SERVICE_URL}/graph/process",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"🔧 Direct Graph Processing: {response.status_code}")
        if response.status_code in [200, 201, 202]:
            result = response.json()
            print(f"   Direct processing result: {json.dumps(result, indent=2)}")
        else:
            print(f"   Error: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Direct Graph Service Test Failed: {e}")

def main():
    """Run comprehensive test suite"""
    print("🧪 Testing Deployed CryptoMaltese Graph Service")
    print("=" * 60)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Graph Service URL: {GRAPH_SERVICE_URL}")
    print(f"Test Incident ID: {INCIDENT_ID}")
    print("=" * 60)
    
    # Test 1: Health checks
    print("\n1. Health Checks")
    api_healthy = test_api_health()
    graph_healthy = test_graph_service_health()
    
    if not api_healthy:
        print("⚠️  Main API is not responding. Check deployment.")
        
    if not graph_healthy:
        print("⚠️  Graph service is not responding. Check deployment.")
        
    # Test 2: Direct graph service test
    print("\n2. Direct Graph Service Test")
    test_direct_graph_service()
    
    # Test 3: End-to-end API test
    if api_healthy:
        print("\n3. End-to-End API Test")
        
        # Start processing
        result = start_graph_processing(INCIDENT_ID)
        
        if result:
            # Wait a bit for processing
            print("\n   Waiting 5 seconds for processing...")
            time.sleep(5)
            
            # Check status
            status = get_graph_status(INCIDENT_ID)
            
            # Try to get graph data
            if status.get('status') == 'completed':
                graph_data = get_graph_data(INCIDENT_ID)
            else:
                print("   Graph processing may still be in progress")
                print("   You can check status again later with:")
                print(f"   curl {API_BASE_URL}/api/incidents/{INCIDENT_ID}/graph/status")
    
    print("\n" + "=" * 60)
    print("🏁 Test Complete!")
    print("\nNext steps:")
    print("- Check logs on the server for any errors")
    print("- Verify database connections")
    print("- Test with real Ethereum addresses if needed")

if __name__ == "__main__":
    main()
