# Graph Service Testing Guide

This guide walks you through testing the Python Graph Mapping Service both standalone and integrated with the Node.js API.

## Prerequisites

1. **Get Etherscan API Key** (free):
   - Visit: https://etherscan.io/apis
   - Sign up and get your API key
   - Add it to your `.env` file

2. **Set up environment**:
   ```bash
   # Copy test environment
   cp .env.test .env
   
   # Edit .env and add your Etherscan API key
   nano .env
   ```

## Testing Options

### Option 1: Quick Test (Graph Service Only)

Start just the database and graph service:

```bash
# 1. Start database
docker-compose up -d database

# 2. Wait for database to be ready
docker-compose logs -f database
# Wait until you see "database system is ready to accept connections"

# 3. Start graph service
docker-compose --profile graph up -d graphservice

# 4. Check logs
docker-compose logs -f graphservice

# 5. Run tests
python3 test_graph_service.py
```

### Option 2: Full Integration Test

Start the complete system:

```bash
# 1. Start all services
docker-compose --profile graph up -d

# 2. Check all services are healthy
docker-compose ps

# 3. Run comprehensive tests
python3 test_graph_service.py
```

### Option 3: Manual API Testing

Use curl to test individual endpoints:

```bash
# 1. Health check
curl http://localhost:8000/health | jq

# 2. Stats
curl http://localhost:8000/stats | jq

# 3. Process incident (replace UUID with actual incident ID)
curl -X POST http://localhost:8000/process_incident/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{"options": {"max_depth": 3, "min_value_eth": 0.1}}' | jq

# 4. Check job status (replace with actual job ID)
curl http://localhost:8000/jobs/job-id-here | jq
```

## Expected Test Results

### Healthy Service
```json
{
  "status": "healthy",
  "database": {"status": "connected"},
  "external_apis": {
    "etherscan": {"status": "available"}
  },
  "uptime_seconds": 123
}
```

### Successful Job Start
```json
{
  "status": "accepted",
  "job_id": "job_12345",
  "message": "Graph processing started",
  "estimated_duration_minutes": 2
}
```

### Job Completion
```json
{
  "status": "completed",
  "progress": {
    "nodes_processed": 15,
    "edges_created": 23,
    "endpoints_found": 3,
    "total_value_traced_eth": "8.5"
  }
}
```

## Common Issues & Solutions

### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps database

# Check database logs
docker-compose logs database

# Restart database if needed
docker-compose restart database
```

### 2. Etherscan API Issues
```bash
# Check your API key in .env
cat .env | grep ETHERSCAN

# Test API key manually
curl "https://api.etherscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&tag=latest&apikey=YOUR-API-KEY"
```

### 3. Service Won't Start
```bash
# Check Python dependencies
docker-compose logs graphservice

# Rebuild if needed
docker-compose build graphservice
docker-compose up -d graphservice
```

### 4. No Test Data
```bash
# Check if incidents table exists
docker-compose exec database psql -U cryptomaltese_user -d cryptomaltese -c "\dt"

# Create sample incident manually if needed
docker-compose exec database psql -U cryptomaltese_user -d cryptomaltese -c "
INSERT INTO incidents (id, title, description, hack_transaction_hash, victim_address, hacker_address, amount_stolen_eth, block_number, status, created_at, updated_at) 
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Test Incident', 'Test description', '0x2b023d65485c4bb68d781960c2196588d03b871dc9eb1b1a6cd9f2b7e37d0b5', '0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2', '0x59ABf3837Fa962d6853b4Cc0a19513AA031fd32b', 10.5, 15853820, 'active', NOW(), NOW());
"
```

## Performance Testing

For load testing:

```bash
# Install httpx if needed
pip3 install httpx

# Run multiple concurrent tests
for i in {1..5}; do
  python3 test_graph_service.py &
done
wait

# Monitor resource usage
docker stats cryptomaltese-graph
```

## Debugging

Enable debug logging:

```bash
# Add to .env
LOG_LEVEL=DEBUG

# Restart service
docker-compose restart graphservice

# Follow detailed logs
docker-compose logs -f graphservice
```

## Next Steps

Once testing is successful:
1. Deploy to your chosen cloud instance
2. Update environment variables for production
3. Set up monitoring and alerting
4. Configure automated backups
