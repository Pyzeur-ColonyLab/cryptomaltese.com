# Production Deployment Guide

This guide covers deploying the CryptoMaltese system in production environments, including both the Node.js API and Python Graph Service.

## 🏗️ Infrastructure Requirements

### Database Instance (PostgreSQL)
- **Recommended**: PostgreSQL 15+
- **CPU**: 2-4 vCPUs
- **RAM**: 4-8 GB
- **Storage**: 100-500 GB SSD (depending on expected volume)
- **Network**: Private network access to application servers

### Node.js API Instance
- **CPU**: 2-4 vCPUs  
- **RAM**: 2-4 GB
- **Storage**: 20-50 GB SSD
- **Network**: Public internet access, private network to database
- **Load Balancer**: Recommended for high availability

### Python Graph Service Instance
- **CPU**: 4-8 vCPUs (graph processing is CPU intensive)
- **RAM**: 8-16 GB (for NetworkX graph operations)
- **Storage**: 50-100 GB SSD
- **Network**: Private network access to database and Node.js API
- **Note**: Can scale horizontally with multiple instances

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended for staging/small production)

#### Prerequisites
- Docker and Docker Compose installed
- Domain name and SSL certificate
- Etherscan API key

#### Setup Steps

1. **Clone and prepare repository**
   ```bash
   git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
   cd cryptomaltese.com
   ```

2. **Create production environment file**
   ```bash
   cp .env.template .env.production
   ```

3. **Configure environment variables**
   ```env
   # .env.production
   
   # Required
   ETHERSCAN_API_KEY=your_actual_etherscan_api_key
   JWT_SECRET=your_strong_jwt_secret_here
   SESSION_SECRET=your_strong_session_secret_here
   
   # Database (managed by Docker Compose)
   DATABASE_URL=postgresql://cryptomaltese_user:cryptomaltese_password@database:5432/cryptomaltese
   
   # Optional optimizations
   NODE_ENV=production
   CACHE_TTL_SECONDS=600
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # Graph service configuration
   MAX_NODES_PER_GRAPH=500
   MAX_API_CALLS_PER_INCIDENT=25
   PROCESSING_TIMEOUT_SECONDS=30
   ```

4. **Deploy the stack**
   ```bash
   # Start core services (database + API)
   docker-compose --env-file .env.production up -d database api
   
   # Wait for services to be healthy
   docker-compose ps
   
   # Optional: Start graph service in another terminal
   docker-compose --env-file .env.production --profile graph up graphservice
   ```

5. **Verify deployment**
   ```bash
   # Test API health
   curl http://localhost:3000/health
   
   # Test graph service health (if running)
   curl http://localhost:8000/health
   ```

### Option 2: Cloud Native Deployment

#### AWS Deployment

**Database Setup (RDS)**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier cryptomaltese-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 100 \
  --storage-type gp2 \
  --db-name cryptomaltese \
  --master-username cryptomaltese_user \
  --master-user-password "YourStrongPassword" \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --backup-retention-period 7 \
  --storage-encrypted
```

**API Service (ECS/Fargate)**
```bash
# Build and push Node.js image
docker build -t cryptomaltese-api .
docker tag cryptomaltese-api:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/cryptomaltese-api:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/cryptomaltese-api:latest

# Deploy via ECS with task definition
```

**Graph Service (ECS/Fargate)**
```bash
# Build and push Python image
docker build -t cryptomaltese-graph ./graph_service
docker tag cryptomaltese-graph:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/cryptomaltese-graph:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/cryptomaltese-graph:latest
```

#### DigitalOcean Deployment

**Database Setup (Managed Database)**
- Create PostgreSQL cluster via DigitalOcean console
- Size: 2 GB RAM, 1 vCPU minimum
- Enable automatic backups

**API Service (App Platform)**
```yaml
# .do/app.yaml
name: cryptomaltese-api
services:
- name: api
  source_dir: /
  github:
    repo: Pyzeur-ColonyLab/cryptomaltese.com
    branch: main
  run_command: npm start
  instance_count: 2
  instance_size_slug: basic-xxs
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    type: SECRET
  - key: ETHERSCAN_API_KEY
    type: SECRET
```

**Graph Service (Droplet)**
```bash
# Create droplet
doctl compute droplet create cryptomaltese-graph \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc1

# Deploy via SSH
ssh root@droplet-ip "git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git"
# ... setup steps
```

### Option 3: Manual VPS Deployment

#### Server Requirements
- **OS**: Ubuntu 22.04 LTS or similar
- **Services**: Docker, Docker Compose, or native Python/Node.js
- **Network**: Public IP, firewall configured
- **SSL**: Let's Encrypt certificate

#### Setup Steps

1. **Server preparation**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy application**
   ```bash
   # Clone repository
   git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
   cd cryptomaltese.com
   
   # Setup environment
   cp .env.template .env.production
   # Edit .env.production with your values
   
   # Deploy
   docker-compose --env-file .env.production up -d
   ```

3. **Setup reverse proxy (nginx)**
   ```nginx
   # /etc/nginx/sites-available/cryptomaltese
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       # Graph service (optional, for direct access)
       location /graph/ {
           proxy_pass http://localhost:8000/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. **SSL Setup with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 🗄️ Database Migration

### For Existing Database Instance

If you have an existing CryptoMaltese database, run this migration:

```sql
-- Connect to your existing database
psql "postgresql://username:password@your-db-host:5432/your-db-name"

-- Run the graph tables migration
\i migrations/003_graph_tables.sql

-- Verify tables were created
\dt graph_*
\dt incident_graphs

-- Check indexes
\di graph_*
```

### For New Database Instance

```bash
# Create new database
createdb cryptomaltese

# Run all migrations in order
psql cryptomaltese < migrations/001_create_tables.sql
psql cryptomaltese < migrations/002_add_main_transaction_fields.sql  
psql cryptomaltese < migrations/003_graph_tables.sql

# Or use the Node.js migration runner
DATABASE_URL="postgresql://user:pass@host:5432/cryptomaltese" npm run migrate
```

### Database Scaling Considerations

**Small Scale (< 1000 incidents/month)**
- Single PostgreSQL instance
- 2-4 GB RAM, 2 vCPUs
- Standard SSD storage

**Medium Scale (1000-10,000 incidents/month)**  
- PostgreSQL with read replicas
- 8-16 GB RAM, 4-8 vCPUs
- High-performance SSD

**Large Scale (> 10,000 incidents/month)**
- PostgreSQL cluster or managed service
- Connection pooling (PgBouncer)
- Separate analytics database for graph data

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Core Configuration
DATABASE_URL=postgresql://user:password@host:port/database
ETHERSCAN_API_KEY=your_etherscan_api_key

# Security (generate strong values)
JWT_SECRET=your_256_bit_secret_here
SESSION_SECRET=your_256_bit_session_secret_here

# Graph Service Connection
GRAPH_SERVICE_URL=http://graph-service-host:8000
```

### Optional Configuration

```env
# Performance Tuning
CACHE_TTL_SECONDS=600
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ETHERSCAN_TIMEOUT_MS=30000
ETHERSCAN_RETRY_ATTEMPTS=3

# Graph Processing Limits
MAX_NODES_PER_GRAPH=500
MAX_API_CALLS_PER_INCIDENT=25
PROCESSING_TIMEOUT_SECONDS=30
MAX_DEPTH=8

# Logging
LOG_LEVEL=INFO
```

## 🔍 Health Monitoring

### Health Check Endpoints

```bash
# Node.js API
curl https://your-domain.com/health

# Python Graph Service  
curl https://your-domain.com:8000/health

# Database connectivity
curl https://your-domain.com/api/incidents/graph/health
```

### Expected Health Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Monitoring Checklist

- [ ] API response times < 500ms (95th percentile)
- [ ] Database connection pool utilization < 80%
- [ ] Graph processing success rate > 95%
- [ ] Etherscan API rate limit compliance
- [ ] Disk space usage < 85%
- [ ] Memory usage < 90%

## 🚨 Troubleshooting

### Common Deployment Issues

**1. Database Connection Failed**
```bash
# Test connection manually
psql "postgresql://user:password@host:port/database"

# Check network connectivity
telnet db-host 5432

# Verify credentials and database exists
```

**2. Graph Service Won't Start**
```bash
# Check Python dependencies
docker-compose logs graphservice

# Verify database migration
docker-compose exec database psql -U cryptomaltese_user -d cryptomaltese -c "\dt graph_*"

# Test Etherscan API
curl "https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=YOUR_KEY"
```

**3. Service Communication Issues**
```bash
# Test internal network
docker-compose exec api curl http://graphservice:8000/health

# Check service discovery
docker-compose exec api nslookup graphservice
```

**4. Performance Issues**
```bash
# Monitor resource usage
docker stats

# Check logs for bottlenecks
docker-compose logs --tail=100 graphservice

# Monitor database performance
docker-compose exec database pg_stat_statements
```

## 📊 Production Scaling

### Horizontal Scaling

**Node.js API (Stateless)**
- Run multiple instances behind load balancer
- Use session store (Redis) if sessions needed
- Scale based on CPU/memory usage

**Python Graph Service**
- Multiple instances can process different incidents
- Implement job queue (Redis/RabbitMQ) for better distribution
- Scale based on queue depth and processing time

**Database**
- Read replicas for analytics queries
- Connection pooling (PgBouncer)
- Partitioning for large datasets

### Load Balancer Configuration (nginx)

```nginx
upstream api_servers {
    server api1:3000;
    server api2:3000;
    server api3:3000;
}

upstream graph_servers {
    server graph1:8000;
    server graph2:8000;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /graph/ {
        proxy_pass http://graph_servers/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;  # Longer timeout for graph processing
    }
}
```

## 🔐 Security Configuration

### Environment Secrets Management

**AWS Secrets Manager**
```bash
# Store secrets
aws secretsmanager create-secret \
  --name "cryptomaltese/production" \
  --description "CryptoMaltese production secrets" \
  --secret-string '{"DATABASE_URL":"postgresql://...","ETHERSCAN_API_KEY":"...","JWT_SECRET":"..."}'

# Retrieve in application
aws secretsmanager get-secret-value --secret-id "cryptomaltese/production"
```

**Docker Secrets**
```yaml
# docker-compose.prod.yml
secrets:
  database_url:
    external: true
  etherscan_api_key:
    external: true
  jwt_secret:
    external: true

services:
  api:
    secrets:
      - database_url
      - etherscan_api_key
      - jwt_secret
```

### Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 3000/tcp   # Block direct API access
ufw deny 8000/tcp   # Block direct graph service access
ufw enable
```

### SSL/TLS Configuration

```bash
# Let's Encrypt with automatic renewal
certbot --nginx -d your-domain.com
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 📈 Monitoring & Logging

### Log Aggregation

**Docker Compose Logging**
```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  graphservice:
    logging:
      driver: "json-file" 
      options:
        max-size: "10m"
        max-file: "3"
```

**Centralized Logging (ELK Stack)**
```yaml
# Add to docker-compose.yml
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    
  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
  
  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
```

### Application Monitoring

**Health Check Script**
```bash
#!/bin/bash
# health-monitor.sh

API_URL="https://your-domain.com"
GRAPH_URL="https://your-domain.com:8000"

# Check API health
if ! curl -sf "$API_URL/health" > /dev/null; then
    echo "API health check failed" | logger -t cryptomaltese
    # Send alert (email, Slack, etc.)
fi

# Check graph service health
if ! curl -sf "$GRAPH_URL/health" > /dev/null; then
    echo "Graph service health check failed" | logger -t cryptomaltese
    # Send alert
fi
```

**Cron Job Setup**
```bash
# Add to crontab
*/5 * * * * /path/to/health-monitor.sh
```

## 💾 Backup Strategy

### Database Backup

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/cryptomaltese"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_URL="postgresql://user:password@host:port/database"

# Create backup
pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/cryptomaltese_$TIMESTAMP.sql.gz"

# Retain only last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
aws s3 cp "$BACKUP_DIR/cryptomaltese_$TIMESTAMP.sql.gz" s3://your-backup-bucket/
```

### Application State Backup

```bash
# Backup configuration
tar -czf app-config-backup.tar.gz .env.production docker-compose.yml

# Backup logs (last 7 days)
docker-compose logs --since 168h > logs-backup.txt
```

## 🔄 Deployment Automation

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Build and push API image
      run: |
        docker build -t cryptomaltese-api .
        docker tag cryptomaltese-api ${{ secrets.REGISTRY_URL }}/cryptomaltese-api:${{ github.sha }}
        docker push ${{ secrets.REGISTRY_URL }}/cryptomaltese-api:${{ github.sha }}
    
    - name: Build and push Graph service image
      run: |
        docker build -t cryptomaltese-graph ./graph_service
        docker tag cryptomaltese-graph ${{ secrets.REGISTRY_URL }}/cryptomaltese-graph:${{ github.sha }}
        docker push ${{ secrets.REGISTRY_URL }}/cryptomaltese-graph:${{ github.sha }}
    
    - name: Deploy to production
      run: |
        ssh ${{ secrets.PRODUCTION_HOST }} "cd /opt/cryptomaltese && docker-compose pull && docker-compose up -d"
```

### Rolling Deployment Script

```bash
#!/bin/bash
# rolling-deploy.sh

set -e

echo "Starting rolling deployment..."

# Pull latest images
docker-compose pull

# Update API service
echo "Updating API service..."
docker-compose up -d --no-deps api

# Wait for health check
sleep 30
if ! curl -sf http://localhost:3000/health; then
    echo "API health check failed, rolling back..."
    docker-compose rollback api
    exit 1
fi

# Update graph service (if running)
if docker-compose ps graphservice | grep -q "Up"; then
    echo "Updating graph service..."
    docker-compose up -d --no-deps graphservice
    
    sleep 30
    if ! curl -sf http://localhost:8000/health; then
        echo "Graph service health check failed, rolling back..."
        docker-compose rollback graphservice
        exit 1
    fi
fi

echo "Deployment completed successfully!"
```

## 🎯 Quick Deployment Commands

### Start Core System
```bash
# Clone repository
git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
cd cryptomaltese.com

# Configure environment
cp .env.template .env.production
# Edit .env.production with your values

# Start database and API
docker-compose --env-file .env.production up -d database api

# Verify deployment
curl http://localhost:3000/health
```

### Add Graph Service (Optional)
```bash
# In a new terminal (as per your preference)
docker-compose --env-file .env.production --profile graph up graphservice

# Or without Docker
cd graph_service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
DATABASE_URL="postgresql://..." ETHERSCAN_API_KEY="..." uvicorn app.main:app --port 8000
```

### Migration Commands
```bash
# For existing database
psql "your-database-url" < migrations/003_graph_tables.sql

# For new deployment
docker-compose exec database psql -U cryptomaltese_user -d cryptomaltese -f /docker-entrypoint-initdb.d/migrations/003_graph_tables.sql
```

This deployment guide provides everything needed for production deployment, from small VPS setups to enterprise cloud deployments. The system is designed to be scalable and maintainable with proper monitoring and backup strategies.
