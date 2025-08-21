# Graph Service Setup Guide

This guide explains how to set up and run the Graph Mapping Service alongside the main Node.js application.

## Architecture Overview

The Graph Mapping Service is a Python microservice that analyzes cryptocurrency transaction flows to build comprehensive graphs of fund movements. It works alongside the main Node.js application:

```
┌─────────────────┐    HTTP REST    ┌─────────────────┐
│   Node.js API   │ ────────────────▶ │  Python Graph  │
│   (Port 3000)   │                  │  Service        │
│                 │                  │   (Port 8000)   │
└─────────────────┘                  └─────────────────┘
         │                                     │
         └─────────────── PostgreSQL ──────────┘
                       (Shared Database)
```

## Prerequisites

1. **Node.js application** running (see main README)
2. **Python 3.9+** installed
3. **PostgreSQL** database with migrations applied
4. **Etherscan API key** (same as used by Node.js app)

## Quick Start

### 1. Set Up Python Environment

```bash
cd graph_service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

The Python service uses the same environment variables as the Node.js application. Make sure your `.env` file in the root directory contains:

```env
# Database (shared with Node.js)
DATABASE_URL=postgresql://user:password@localhost:5432/cryptomaltese

# Etherscan API (shared with Node.js)
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Graph Service specific (optional)
GRAPH_SERVICE_URL=http://localhost:8000
GRAPH_SERVICE_TIMEOUT_MS=35000
MAX_NODES_PER_GRAPH=500
MAX_API_CALLS_PER_INCIDENT=25
PROCESSING_TIMEOUT_SECONDS=30
```

### 3. Run the Graph Service

**Important**: Always run the graph service in a separate terminal as requested.

```bash
# In a new terminal window
cd /path/to/cryptomaltese.com/graph_service
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

You should see output similar to:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 4. Verify Setup

1. **Check Graph Service Health**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check Node.js Integration**:
   ```bash
   curl http://localhost:3000/api/incidents/graph/health
   ```

## Development Workflow

### Running Both Services

1. **Terminal 1** - Main Node.js application:
   ```bash
   npm run dev
   ```

2. **Terminal 2** - Graph service:
   ```bash
   cd graph_service
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

### Making Changes

- **Node.js changes**: Automatic restart with `nodemon`
- **Python changes**: Automatic restart with `--reload` flag
- **Database changes**: Run `npm run migrate` to apply new migrations

## API Usage

### Start Graph Processing

```bash
# Start graph analysis for an incident
curl -X POST http://localhost:3000/api/incidents/{incident-id}/graph \
  -H "Content-Type: application/json" \
  -d '{"options": {"max_depth": 8}}'

# Response (202 Accepted):
{
  "status": "accepted",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Graph processing started",
  "estimated_completion": "2024-01-01T12:00:30Z"
}
```

### Check Processing Status

```bash
# Get current status
curl http://localhost:3000/api/incidents/{incident-id}/graph

# Response - Processing:
{
  "status": "running",
  "progress": {
    "percentage": 65,
    "current_step": "recursive_traversal",
    "api_calls_used": 8
  }
}

# Response - Completed:
{
  "status": "completed",
  "results": {
    "total_nodes": 18,
    "total_edges": 22,
    "max_depth": 6,
    "endpoint_summary": {"CEX": 3, "DEX": 1},
    "top_paths": [...]
  },
  "graphData": {
    "nodes": [...],
    "edges": [...]
  }
}
```

## Configuration Options

### Processing Limits

These can be adjusted via environment variables:

```env
# Maximum nodes in a single graph
MAX_NODES_PER_GRAPH=500

# Maximum Etherscan API calls per incident
MAX_API_CALLS_PER_INCIDENT=25

# Processing timeout (seconds)
PROCESSING_TIMEOUT_SECONDS=30

# Maximum traversal depth
MAX_DEPTH=8

# Minimum transaction value to process (ETH)
MIN_TRANSACTION_VALUE_ETH=0.05
```

### Classification Thresholds

```env
# High-frequency service detection (tx/day)
HIGH_FREQUENCY_TX_THRESHOLD=100

# Address consolidation threshold
REUSE_THRESHOLD=3

# Value percentage thresholds by hack size
MIN_PERCENTAGE_SMALL_HACK=1.0    # <10 ETH
MIN_PERCENTAGE_MEDIUM_HACK=0.5   # 10-100 ETH
MIN_PERCENTAGE_LARGE_HACK=0.1    # >100 ETH
```

## Monitoring & Troubleshooting

### Service Health

```bash
# Graph service health
curl http://localhost:8000/health

# Integration health  
curl http://localhost:3000/api/incidents/graph/health

# Detailed statistics
curl http://localhost:8000/stats
```

### Common Issues

**1. Service Won't Start**
- Check Python version: `python --version` (needs 3.9+)
- Verify virtual environment: `which python`
- Check dependencies: `pip list`

**2. Database Connection Errors**
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL is running
- Ensure migrations are applied: `npm run migrate`

**3. Etherscan API Issues**
- Verify `ETHERSCAN_API_KEY` in `.env`
- Check API key quotas at etherscan.io
- Monitor rate limiting in logs

**4. Processing Timeouts**
- Increase `PROCESSING_TIMEOUT_SECONDS`
- Reduce `MAX_API_CALLS_PER_INCIDENT`
- Check network connectivity

### Logs

The service uses structured JSON logging. Key log sources:

- **Startup/shutdown**: Service lifecycle events
- **Job processing**: Graph construction progress
- **API calls**: Etherscan API interactions
- **Database**: Query performance and errors

Example log entry:
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "event": "Graph processing completed",
  "incident_id": "123e4567-e89b-12d3-a456-426614174000",
  "processing_time": 28.5,
  "nodes": 18,
  "edges": 22
}
```

## API Documentation

When the graph service is running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **Alternative docs**: http://localhost:8000/redoc
- **OpenAPI schema**: http://localhost:8000/openapi.json

## Development Tips

1. **Use different terminals** for Node.js and Python services
2. **Check logs** in both terminals for debugging
3. **Monitor API quotas** to avoid Etherscan rate limits
4. **Test with small incidents** first to verify setup
5. **Use health endpoints** to verify service connectivity

## Next Steps

Once setup is complete:
1. Create an incident via the main API
2. Start graph processing for that incident
3. Monitor progress via the status endpoint
4. View results in the completed response

For advanced configuration and deployment options, see the production deployment guide.
