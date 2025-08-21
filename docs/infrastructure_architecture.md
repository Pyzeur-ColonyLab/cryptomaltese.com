# CryptoMaltese Infrastructure Architecture

## Overview

The CryptoMaltese Incident Reporter is a distributed system consisting of three main components that work together to provide cryptocurrency incident reporting with advanced transaction flow graph analysis:

1. **Node.js Server** - Combined API and frontend serving
2. **Python Graph Service** - Specialized transaction flow analysis
3. **PostgreSQL Database** - Centralized data persistence

Additionally, the system integrates with the external Etherscan API for blockchain data retrieval.

## System Architecture

```
┌─────────────────────────────────┐    ┌─────────────────┐
│                                 │    │                 │
│   Node.js Server                │    │  Python Graph   │
│   (API + Frontend)              │    │   Service       │
│                                 │    │                 │
│   • Express.js API endpoints    │    │   Port: 8000    │
│   • Static frontend serving     │    │                 │
│   • Port: 3000                  │    │                 │
│                                 │    │                 │
└─────────────────────────────────┘    └─────────────────┘
         │                                       │
         │ Browser requests (API + static)       │ HTTP REST API
         │                                       │
         └───────────────────┬───────────────────┘
                             │
                             │ Database Queries
                             │
                    ┌─────────────────┐
                    │                 │
                    │   PostgreSQL    │
                    │   Database      │
                    │                 │
                    │   Port: 5432    │
                    │                 │
                    └─────────────────┘
                             │
                             │ External API Calls
                             │
                    ┌─────────────────┐
                    │                 │
                    │   Etherscan     │
                    │   API           │
                    │                 │
                    │   HTTPS         │
                    │                 │
                    └─────────────────┘
```

## Component Details

### 1. Node.js Server (API + Frontend)
- **Technology**: Node.js, Express.js, Sequelize ORM, React components
- **Port**: 3000
- **Purpose**: 
  - RESTful API endpoints for incident management
  - User authentication and session management
  - Static frontend serving (HTML, CSS, JS)
  - Proxy for graph service communication
- **Dependencies**: PostgreSQL Database, Python Graph Service

### 2. Python Graph Service
- **Technology**: Python 3.10+, FastAPI, NetworkX, asyncpg
- **Port**: 8000
- **Purpose**: Transaction flow graph analysis and mapping
- **Dependencies**: PostgreSQL Database, Etherscan API

### 3. PostgreSQL Database
- **Technology**: PostgreSQL 14+
- **Port**: 5432
- **Purpose**: Data persistence for incidents, users, graph data
- **Dependencies**: None (base service)

### 4. Etherscan API
- **Technology**: External REST API
- **Purpose**: Ethereum blockchain transaction data
- **Dependencies**: None (external service)

## Service Interactions

### Primary Flow: Incident Processing with Graph Analysis

1. **User Submits Incident** (Frontend → Node.js API)
   ```
   POST /api/incidents
   Content-Type: application/json
   {
     "walletAddress": "0x...",
     "hackTransactionHash": "0x...",
     "description": "...",
     ...
   }
   ```

2. **Incident Storage** (Node.js API → PostgreSQL)
   - Validates and stores incident data
   - Returns incident with unique ID

3. **Graph Analysis Trigger** (Frontend → Node.js API → Python Graph Service)
   ```
   POST /api/incidents/{id}/graph
   ↓
   POST http://localhost:8000/process_incident/{id}
   ```

4. **Graph Processing** (Python Graph Service)
   - Retrieves incident data from PostgreSQL
   - Performs recursive transaction analysis via Etherscan API
   - Stores graph nodes and edges in PostgreSQL
   - Updates job status throughout process

5. **Status Monitoring** (Frontend → Node.js API → Python Graph Service)
   ```
   GET /api/incidents/{id}/graph/status
   ↓
   GET http://localhost:8000/jobs/{job_id}
   ```

6. **Results Retrieval** (Frontend → Node.js API → PostgreSQL)
   - Once completed, fetches graph data directly from database
   - Returns formatted results for visualization

## Database Schema

### Core Tables
- **incidents**: User-reported incident data
- **users**: User authentication and profiles (if implemented)

### Graph Analysis Tables
- **incident_graphs**: Job tracking and metadata
- **graph_nodes**: Transaction addresses with classification
- **graph_edges**: Transaction relationships and flow data

### Key Relationships
```sql
incidents (1) ←→ (1) incident_graphs
incident_graphs (1) ←→ (many) graph_nodes
graph_nodes (many) ←→ (many) graph_edges
```

## Setup Requirements

### 1. PostgreSQL Database Setup

**Installation**:
```bash
# macOS with Homebrew
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql-14
sudo systemctl start postgresql
```

**Database Creation**:
```bash
# Create database
createdb cryptomaltese_incidents

# Run migrations
cd /path/to/cryptomaltese.com
npm run migrate
```

**Required Tables**: 
- Must run all migrations (001, 002, 003) for full functionality
- Graph tables (003) are essential for graph service operation

### 2. Node.js API Server Setup

**Prerequisites**:
- Node.js 18+ 
- npm or yarn
- PostgreSQL connection

**Installation**:
```bash
cd /path/to/cryptomaltese.com
npm install
```

**Environment Variables** (`.env`):
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://username@localhost:5432/cryptomaltese_incidents
ETHERSCAN_API_KEY=your_etherscan_api_key
GRAPH_SERVICE_URL=http://localhost:8000
```

**Startup**:
```bash
npm start
# or for development
npm run dev
```

### 3. Python Graph Service Setup

**Prerequisites**:
- Python 3.10+
- PostgreSQL connection
- Etherscan API key

**Installation**:
```bash
cd graph_service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Environment Variables** (`graph_service/.env`):
```env
DEBUG=true
DATABASE_URL=postgresql://username@localhost:5432/cryptomaltese_incidents
ETHERSCAN_API_KEY=your_etherscan_api_key
PORT=8000
# ... (see full .env.template for all options)
```

**Startup**:
```bash
cd graph_service
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Network Configuration

### Port Assignments
- **3000**: Node.js API Server + Frontend
- **5432**: PostgreSQL Database
- **8000**: Python Graph Service

### Service Communication
- **Browser ↔ Node.js Server**: HTTP requests to port 3000 (both API calls and static assets)
- **Node.js Server ↔ Python Graph Service**: HTTP REST on localhost:8000
- **Node.js Server ↔ PostgreSQL**: Direct database connection via Sequelize ORM
- **Python Graph Service ↔ PostgreSQL**: Direct database connection via asyncpg
- **Python Graph Service ↔ Etherscan**: HTTPS to api.etherscan.io

### CORS Configuration
- Node.js API: Configured for frontend origin
- Python Graph Service: Allows Node.js API origin (localhost:3000)

## Deployment Scenarios

### Development (Local)
1. Start PostgreSQL: `brew services start postgresql@14`
2. Run migrations: `npm run migrate`
3. Start Node.js API: `npm run dev` (terminal 1)
4. Start Python Graph Service: `cd graph_service && source venv/bin/activate && uvicorn app.main:app --reload` (terminal 2)
5. Access frontend: http://localhost:3000

### Production (Docker Compose)
```bash
# Single command deployment
docker-compose up -d

# Services started:
# - postgres (port 5432)
# - api (port 3000)
# - graph-service (port 8000)
```

### Production (Separate Servers)

**Database Server**:
- PostgreSQL 14+ with sufficient storage
- Accessible to both API and Graph services
- Recommended: 4+ vCPU, 8+ GB RAM, SSD storage

**API Server**:
- Node.js runtime
- Reverse proxy (nginx) for HTTPS
- Recommended: 2+ vCPU, 4+ GB RAM

**Graph Service Server**:
- Python 3.10+ runtime
- Higher compute requirements for graph processing
- Recommended: 4+ vCPU, 8+ GB RAM

## Security Considerations

### Network Security
- **Internal Communication**: Services communicate via HTTP on localhost
- **External Access**: Only Node.js API should be exposed to internet
- **Database Access**: Restrict PostgreSQL to application servers only

### API Security
- **Authentication**: JWT tokens for user sessions (Node.js API)
- **Rate Limiting**: Configured on Node.js API
- **Input Validation**: Pydantic models in Python, middleware in Node.js

### Environment Security
- **API Keys**: Store in environment variables, never in code
- **Database Credentials**: Use connection strings with appropriate permissions
- **Secrets Management**: Use Docker secrets or cloud secret managers in production

## Monitoring and Health Checks

### Health Endpoints
- **Node.js API**: `GET /api/health`
- **Python Graph Service**: `GET /health`
- **Database**: `pg_isready` command

### Key Metrics to Monitor
- **API Response Times**: Both services
- **Database Connection Pool**: Usage and availability
- **Job Processing**: Queue depth and completion rates
- **Etherscan API**: Rate limit usage and errors
- **Memory Usage**: Especially for graph processing
- **Disk Usage**: Database growth and log files

## Troubleshooting

### Common Issues

**Service Won't Start**:
1. Check port availability: `lsof -i :PORT`
2. Verify environment variables are set
3. Check database connectivity: `pg_isready`
4. Review service logs for specific errors

**Graph Processing Failures**:
1. Check Etherscan API key validity
2. Verify database connectivity from Python service
3. Check incident exists in database
4. Review processing timeout settings

**Database Connection Issues**:
1. Confirm PostgreSQL is running
2. Verify database URL format
3. Check user permissions
4. Ensure database and tables exist

**Cross-Service Communication**:
1. Verify both services are running on correct ports
2. Check CORS configuration
3. Review network connectivity between services
4. Check service URLs in environment variables

### Log Locations
- **Node.js API**: Console output or log files (if configured)
- **Python Graph Service**: Structured JSON logs to stdout
- **PostgreSQL**: Standard PostgreSQL log directory
- **Docker**: `docker-compose logs [service_name]`

## Performance Optimization

### Database Optimization
- **Indexes**: Ensure all required indexes from migration 003 are present
- **Connection Pooling**: Configure appropriate pool sizes
- **Query Optimization**: Monitor slow queries

### Graph Service Optimization
- **API Rate Limiting**: Respect Etherscan limits
- **Caching**: Utilize transaction caching effectively
- **Memory Management**: Monitor NetworkX graph sizes
- **Concurrency**: Limit concurrent graph processing jobs

### API Server Optimization
- **Caching**: Implement response caching where appropriate
- **Rate Limiting**: Protect against abuse
- **Static Assets**: Use nginx for static file serving in production

## Scaling Considerations

### Horizontal Scaling
- **API Server**: Can run multiple instances behind load balancer
- **Graph Service**: Can run multiple instances with job queue distribution
- **Database**: Consider read replicas for heavy read workloads

### Vertical Scaling
- **Database**: Scale CPU and memory for complex queries
- **Graph Service**: Scale memory for large graph processing
- **API Server**: Scale for concurrent user sessions

### Queue Management
- **Current**: In-memory job queue in Python service
- **Future**: Consider Redis or RabbitMQ for distributed job processing

---

This infrastructure supports the full CryptoMaltese incident reporting workflow with robust transaction graph analysis capabilities. Each component is designed to be independently scalable and maintainable while providing seamless integration for end users.
