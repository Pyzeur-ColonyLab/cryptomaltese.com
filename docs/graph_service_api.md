# Graph Service API Specification

## Overview
REST API specification for communication between the Node.js incident reporting service and the Python graph mapping service.

## Base Configuration
- **Graph Service Base URL**: `http://localhost:8000` (development)
- **Content-Type**: `application/json`
- **Timeout**: 30 seconds for processing requests
- **Retry Strategy**: Exponential backoff, max 3 attempts

## Endpoints

### 1. Process Incident Graph
**POST** `/process_incident/{incident_id}`

Triggers asynchronous graph processing for a given incident.

#### Request
```http
POST /process_incident/123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json

{
  "options": {
    "max_depth": 8,
    "max_api_calls": 25,
    "timeout_seconds": 30
  }
}
```

#### Response - Success (202 Accepted)
```json
{
  "status": "accepted",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Graph processing started",
  "created_at": "2024-01-01T12:00:00Z",
  "estimated_completion": "2024-01-01T12:00:30Z"
}
```

#### Response - Incident Not Found (404)
```json
{
  "status": "error",
  "error_code": "INCIDENT_NOT_FOUND",
  "message": "Incident with ID 123e4567-e89b-12d3-a456-426614174000 not found"
}
```

#### Response - Already Processing (409)
```json
{
  "status": "conflict",
  "error_code": "ALREADY_PROCESSING",
  "message": "Graph processing already in progress for this incident",
  "existing_job_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 2. Get Job Status
**GET** `/jobs/{job_id}`

Retrieves the current status and results of a graph processing job.

#### Response - Processing (200)
```json
{
  "status": "running",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "progress": {
    "percentage": 65,
    "current_step": "recursive_traversal",
    "nodes_processed": 12,
    "edges_created": 15,
    "api_calls_used": 8,
    "api_calls_remaining": 17
  },
  "started_at": "2024-01-01T12:00:00Z",
  "estimated_completion": "2024-01-01T12:00:25Z"
}
```

#### Response - Completed (200)
```json
{
  "status": "completed",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "results": {
    "total_nodes": 18,
    "total_edges": 22,
    "max_depth": 6,
    "total_value_traced": "125.45",
    "processing_time_seconds": 28,
    "endpoint_summary": {
      "CEX": 3,
      "DEX": 1,
      "Mixer": 0,
      "potential_endpoint": 2,
      "non_promising_endpoint": 12
    },
    "top_paths": [
      {
        "path_id": 1,
        "value_eth": "85.20",
        "value_percentage": 68.2,
        "hop_count": 4,
        "final_endpoint_type": "CEX",
        "final_endpoint_confidence": 85
      }
    ]
  },
  "started_at": "2024-01-01T12:00:00Z",
  "completed_at": "2024-01-01T12:00:28Z"
}
```

#### Response - Failed (200)
```json
{
  "status": "error",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "error": {
    "error_code": "ETHERSCAN_API_LIMIT",
    "message": "Etherscan API rate limit exceeded",
    "details": "Received 429 Too Many Requests after 3 retry attempts"
  },
  "partial_results": {
    "total_nodes": 8,
    "total_edges": 10,
    "max_depth": 3
  },
  "started_at": "2024-01-01T12:00:00Z",
  "failed_at": "2024-01-01T12:00:15Z"
}
```

#### Response - Timeout (200)
```json
{
  "status": "timeout",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Processing timeout after 30 seconds",
  "partial_results": {
    "total_nodes": 15,
    "total_edges": 18,
    "max_depth": 5
  },
  "started_at": "2024-01-01T12:00:00Z",
  "timeout_at": "2024-01-01T12:00:30Z"
}
```

### 3. Health Check
**GET** `/health`

Returns service health status.

#### Response (200)
```json
{
  "status": "healthy",
  "service": "graph-mapping-service",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime_seconds": 3600,
  "database": {
    "status": "connected",
    "connection_pool": {
      "active": 2,
      "idle": 8,
      "max": 10
    }
  },
  "external_apis": {
    "etherscan": {
      "status": "available",
      "last_check": "2024-01-01T11:59:30Z"
    }
  }
}
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INCIDENT_NOT_FOUND` | Incident ID does not exist | 404 |
| `ALREADY_PROCESSING` | Graph processing already in progress | 409 |
| `INVALID_INCIDENT_DATA` | Incident missing required data (wallet/transaction) | 400 |
| `ETHERSCAN_API_ERROR` | Etherscan API unavailable or rate limited | 502 |
| `DATABASE_ERROR` | Database connection or query error | 500 |
| `PROCESSING_TIMEOUT` | Job exceeded maximum processing time | 200 (with timeout status) |
| `INTERNAL_ERROR` | Unexpected server error | 500 |

## Integration Notes

### Node.js Client Implementation
```javascript
const graphService = {
  baseUrl: process.env.GRAPH_SERVICE_URL || 'http://localhost:8000',
  timeout: 30000,
  
  async processIncident(incidentId, options = {}) {
    const response = await axios.post(
      `${this.baseUrl}/process_incident/${incidentId}`,
      { options },
      { timeout: this.timeout }
    )
    return response.data
  },
  
  async getJobStatus(jobId) {
    const response = await axios.get(`${this.baseUrl}/jobs/${jobId}`)
    return response.data
  }
}
```

### Retry Strategy
- **Connection errors**: Retry up to 3 times with exponential backoff
- **5xx server errors**: Retry up to 3 times
- **Timeout errors**: No retry (job may still be processing)
- **4xx client errors**: No retry (fix request first)

### Monitoring
- Log all API calls with response times
- Track success/failure rates
- Alert on consecutive failures (>5)
- Monitor processing times vs. timeout limits
