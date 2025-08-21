# 🚀 CryptoMaltese Deployment Quick Reference

## Instance Specifications

### Database Instance (PostgreSQL 15+)
```
CPU: 4 vCPUs
RAM: 8 GB  
Storage: 100 GB SSD
Network: Private subnet
Backup: 7-day retention
```

### Node.js API Instance
```
CPU: 2-4 vCPUs
RAM: 4 GB
Storage: 50 GB SSD
Network: Public + Private
Load Balancer: Recommended
```

### Python Graph Service Instance  
```
CPU: 4-8 vCPUs (graph processing intensive)
RAM: 8-16 GB (NetworkX operations)
Storage: 50 GB SSD
Network: Private subnet only
Auto-scaling: Horizontal scaling supported
```

## Required Migration

### For Existing Database
```sql
-- Connect to your existing CryptoMaltese database
psql "postgresql://username:password@your-db-host:5432/your-db-name"

-- Run graph tables migration
\i migrations/003_graph_tables.sql

-- Verify installation
\dt graph_*
\dt incident_graphs
```

### For New Database
```bash
# Apply all migrations
DATABASE_URL="postgresql://user:pass@host:5432/cryptomaltese" npm run migrate
```

## Environment Variables Required

### Core Configuration
```env
DATABASE_URL=postgresql://user:password@host:port/database
ETHERSCAN_API_KEY=your_etherscan_api_key
JWT_SECRET=your_256_bit_secret  # openssl rand -base64 32
SESSION_SECRET=your_256_bit_secret
```

### Service Connection
```env
GRAPH_SERVICE_URL=http://graph-service-host:8000
```

## Deployment Commands

### Option 1: Docker Compose (Recommended)
```bash
# 1. Clone and configure
git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
cd cryptomaltese.com
cp .env.production.template .env.production
# Edit .env.production with your values

# 2. Start core services
docker-compose --env-file .env.production up -d database api

# 3. Start graph service (in another terminal)
docker-compose --env-file .env.production --profile graph up graphservice

# 4. Verify deployment
curl http://localhost:3000/health
curl http://localhost:8000/health
```

### Option 2: Manual VPS Deployment
```bash
# 1. Prepare server (Ubuntu 22.04)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Deploy API
git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
cd cryptomaltese.com
cp .env.production.template .env.production
# Edit .env.production
docker-compose --env-file .env.production up -d database api

# 3. Deploy Graph Service
cd graph_service
chmod +x deploy.sh
./deploy.sh
# Follow script instructions for environment setup
sudo systemctl start cryptomaltese-graph
```

### Option 3: Separate Instances

**API Instance Setup**
```bash
# Clone repository
git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
cd cryptomaltese.com

# Configure environment 
cp .env.production.template .env.production
# Set DATABASE_URL to your managed database
# Set GRAPH_SERVICE_URL to your graph service instance

# Deploy with Docker
docker build -t cryptomaltese-api .
docker run -d --name cryptomaltese-api \
  --env-file .env.production \
  -p 3000:3000 \
  cryptomaltese-api
```

**Graph Service Instance Setup**
```bash
# Clone repository
git clone https://github.com/Pyzeur-ColonyLab/cryptomaltese.com.git
cd cryptomaltese.com/graph_service

# Deploy with script
chmod +x deploy.sh
./deploy.sh

# Configure environment
sudo nano /opt/cryptomaltese/.env
# Add DATABASE_URL and ETHERSCAN_API_KEY

# Start service
sudo systemctl start cryptomaltese-graph
sudo systemctl enable cryptomaltese-graph
```

## Service Connections

### Network Configuration
```
API Service → Database: Port 5432 (private)
API Service → Graph Service: Port 8000 (private)
Graph Service → Database: Port 5432 (private)
Load Balancer → API Service: Port 3000 (private)
Internet → Load Balancer: Port 80/443 (public)
```

### Health Check URLs
```bash
# API Service Health
curl https://your-domain.com/health

# Graph Service Health (internal)
curl http://graph-service-host:8000/health

# Integration Health
curl https://your-domain.com/api/incidents/graph/health
```

## API Integration

### Start Graph Processing
```bash
curl -X POST https://your-domain.com/api/incidents/{incident-id}/graph \
  -H "Content-Type: application/json" \
  -d '{"options": {"max_depth": 8}}'
```

### Check Processing Status
```bash
curl https://your-domain.com/api/incidents/{incident-id}/graph
```

## Monitoring Commands

### Service Status
```bash
# Docker deployment
docker-compose ps
docker-compose logs --tail=50 api
docker-compose logs --tail=50 graphservice

# Manual deployment  
sudo systemctl status cryptomaltese-graph
sudo journalctl -u cryptomaltese-graph -f

# Resource usage
docker stats  # or htop for manual deployment
```

### Database Health
```bash
# Connection test
psql "postgresql://user:password@host:port/database" -c "SELECT 1;"

# Graph tables verification
psql "your-database-url" -c "\dt graph_*"
psql "your-database-url" -c "SELECT COUNT(*) FROM incident_graphs;"
```

## Emergency Procedures

### Restart Services
```bash
# Docker deployment
docker-compose restart api
docker-compose restart graphservice

# Manual deployment
sudo systemctl restart cryptomaltese-graph
```

### View Logs
```bash
# Docker logs
docker-compose logs --tail=100 -f api
docker-compose logs --tail=100 -f graphservice

# System logs
sudo journalctl -u cryptomaltese-graph --since "1 hour ago"
```

### Rollback Deployment
```bash
# Docker rollback
docker-compose down
git checkout previous-stable-commit
docker-compose --env-file .env.production up -d

# Manual rollback
sudo systemctl stop cryptomaltese-graph
# Deploy previous version
sudo systemctl start cryptomaltese-graph
```

## Cost Estimates

### Small Scale (< 1000 incidents/month)
- **VPS**: $20-40/month (2-4 GB RAM)
- **Database**: $15-25/month (managed)
- **Total**: ~$35-65/month

### Medium Scale (1000-10,000 incidents/month)
- **API Load Balancer**: $10/month
- **API Instances (2x)**: $40-60/month  
- **Graph Service**: $40-80/month
- **Database**: $50-100/month
- **Total**: ~$140-250/month

### Large Scale (> 10,000 incidents/month)
- **Multi-region deployment**: $300-500/month
- **High-performance database**: $200-400/month
- **CDN**: $20-50/month
- **Monitoring**: $50-100/month
- **Total**: ~$570-1050/month

This quick reference provides all the essential information for deploying the CryptoMaltese system in production environments.
