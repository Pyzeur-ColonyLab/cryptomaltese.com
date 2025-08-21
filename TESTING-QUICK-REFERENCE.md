# Quick Testing Reference - Server Side

## 🚀 One-Command Testing

```bash
# Complete test suite
./test_server.sh

# Quick health check only
./test_server.sh health

# Database verification
./verify_database.sh
```

## 📋 Step-by-Step Server Testing

### 1. Set Up Environment

```bash
# Copy environment template
cp .env.test .env

# Add your Etherscan API key
nano .env
# Replace: ETHERSCAN_API_KEY=your-etherscan-api-key-here
```

### 2. Start Services

```bash
# Option A: Start everything
docker-compose --profile graph up -d

# Option B: Start database + graph service only
docker-compose up -d database
docker-compose --profile graph up -d graphservice
```

### 3. Verify Services

```bash
# Check container status
docker-compose ps

# Expected output:
# cryptomaltese-db    postgres:15-alpine   Up (healthy)
# cryptomaltese-graph python:3.11-slim     Up (healthy)
```

### 4. Run Tests

```bash
# Full automated test
./test_server.sh

# Or test step by step:
./test_server.sh health      # Health check
./test_server.sh stats       # Service stats  
./test_server.sh process     # Process incident
```

### 5. Verify Results

```bash
# Check database results
./verify_database.sh

# Check service logs
docker-compose logs graphservice

# Monitor resources
docker stats cryptomaltese-graph
```

## 🔧 Manual API Testing

```bash
# 1. Health Check
curl http://localhost:8000/health | jq

# 2. Service Stats
curl http://localhost:8000/stats | jq

# 3. Process Test Incident
curl -X POST http://localhost:8000/process_incident/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"options": {"max_depth": 3, "min_value_eth": 0.01}}' | jq

# 4. Check Job Status (replace JOB_ID)
curl http://localhost:8000/jobs/JOB_ID_HERE | jq
```

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs graphservice

# Rebuild and restart
docker-compose build graphservice
docker-compose up -d graphservice
```

### Database Issues
```bash
# Check database
docker-compose logs database
docker-compose exec database pg_isready -U cryptomaltese_user

# Restart if needed
docker-compose restart database
```

### API Key Issues
```bash
# Test Etherscan API key
curl "https://api.etherscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&tag=latest&apikey=YOUR_API_KEY"
```

## 📊 Expected Results

### Healthy Service Response
```json
{
  "status": "healthy",
  "database": {"status": "connected"},
  "external_apis": {"etherscan": {"status": "available"}},
  "uptime_seconds": 123
}
```

### Successful Job Processing
```json
{
  "status": "accepted", 
  "job_id": "job_abc123",
  "message": "Graph processing started",
  "estimated_duration_minutes": 2
}
```

## 🎯 Performance Monitoring

```bash
# Real-time resource monitoring
watch docker stats cryptomaltese-graph

# Check processing efficiency
./verify_database.sh performance

# View detailed logs
docker-compose logs -f graphservice
```

## 🚀 Production Testing

After local testing works:

```bash
# 1. Deploy to server
scp -r . user@your-server:/path/to/app

# 2. Run on server
ssh user@your-server 'cd /path/to/app && ./test_server.sh'

# 3. Monitor remotely
ssh user@your-server 'cd /path/to/app && docker-compose logs -f graphservice'
```
