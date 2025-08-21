# CryptoMaltese Incident Reporter

A comprehensive cryptocurrency wallet incident reporting system with automated blockchain data retrieval and advanced transaction flow graph analysis. Users can report wallet compromises and automatically generate detailed transaction flow graphs showing fund movements and endpoint classifications.

## 🛡️ Features

### Core Functionality
- **Incident Reporting**: Simple form interface for reporting wallet compromises
- **Automatic Data Retrieval**: Fetches blockchain transaction data from Etherscan API
- **Real-time Validation**: Client and server-side validation for Ethereum addresses and transaction hashes
- **Responsive Design**: Mobile-first responsive interface with accessibility features

### Advanced Graph Analysis 🆕
- **Transaction Flow Graphs**: Automated construction of fund movement visualization
- **Smart Address Classification**: AI-powered identification of exchanges, mixers, and endpoints
- **Recursive Transaction Tracing**: Multi-hop fund tracking with intelligent filtering
- **Risk Assessment**: Confidence scoring for endpoint classifications
- **Path Analysis**: Identification of critical fund flow paths and percentages

### Security & Performance
- **Security Hardened**: Rate limiting, input sanitization, and XSS protection
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Performance Optimized**: Caching, compression, and optimized database queries
- **Microservice Architecture**: Scalable Python service for graph processing

## 🏗️ Architecture

### Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Node.js 16+, Express.js 4
- **Database**: PostgreSQL 13+
- **External APIs**: Etherscan API for blockchain data
- **Security**: Helmet.js, CORS, Rate Limiting
- **Validation**: Joi for schema validation

### Project Structure

```
cryptomaltese.com/
├── client/                 # Frontend static files
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   ├── js/
│   │   ├── validation.js  # Client-side validation
│   │   ├── api.js         # API client
│   │   ├── ui.js          # UI utilities
│   │   └── app.js         # Main application logic
│   ├── index.html         # Main application page
│   └── 404.html           # Error page
├── server/                # Backend application
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # External services
│   ├── middlewares/      # Custom middleware
│   └── app.js            # Express application
├── config/               # Configuration files
├── migrations/           # Database migrations
├── tests/               # Test files
└── docs/               # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- PostgreSQL 13.0 or higher
- npm 8.0.0 or higher
- Etherscan API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cryptomaltese.com.git
   cd cryptomaltese.com
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

4. **Configure environment variables**
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/cryptomaltese_incidents

   # External Services
   ETHERSCAN_API_KEY=your_etherscan_api_key_here

   # Security (generate strong secrets)
   JWT_SECRET=your_jwt_secret_here
   SESSION_SECRET=your_session_secret_here
   ```

5. **Set up database**
   ```bash
   # Create database
   createdb cryptomaltese_incidents

   # Run migrations
   npm run migrate
   ```

6. **Start the main application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

7. **Set up Graph Service (Simplified Local Setup)** 🆕
   
   For advanced transaction flow analysis, the Python graph service now runs locally without Docker:
   
   ```bash
   # Set up Python environment
   cd graph_service
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Initialize database (first time only)
   cd ../
   python scripts/init_db.py
   
   # Start graph service (in a separate terminal)
   ./scripts/run_local.sh
   ```
   
   **Important**: Always run the graph service in a separate terminal window as shown above.
   
   See [Local Quick-Start](#-local-quick-start-for-graph-service) section for detailed setup.

The main application will be available at `http://localhost:3000`
The graph service (if enabled) will be available at `http://localhost:8000`

## 🚀 Local Quick-Start for Graph Service

The Graph Service provides advanced transaction flow analysis and mapping. Here's how to get it running locally:

### Prerequisites

- **Python 3.9+** with pip
- **PostgreSQL 13+** running locally
- **Etherscan API key**

### Setup Steps

1. **Create Local Environment Configuration**
   ```bash
   cp .env.template .env.local
   # Edit .env.local with your local settings
   ```
   
   Update `.env.local` with your local configuration:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://postgres:password@localhost:5432/cryptomaltese_incidents
   
   # Etherscan API
   ETHERSCAN_API_KEY=your_etherscan_api_key_here
   
   # Development Settings
   DEBUG=true
   LOG_LEVEL=INFO
   ```

2. **Set up Python Virtual Environment**
   ```bash
   cd graph_service
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Initialize Database** (First time only)
   ```bash
   cd ..  # Back to project root
   python scripts/init_db.py
   ```
   
   This will:
   - Create all required database tables
   - Set up indexes for performance
   - Insert sample test data
   
4. **Start the Graph Service**
   ```bash
   # Always run in a separate terminal!
   ./scripts/run_local.sh
   ```
   
   **Important**: The script must be run in a **separate terminal window** to avoid blocking your main development workflow.

5. **Verify the Service**
   ```bash
   # In another terminal, test the health endpoint
   curl http://localhost:8000/health
   ```
   
   You should see a response like:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-08-21T19:46:00Z",
     "uptime_seconds": 30,
     "database": {
       "status": "connected"
     },
     "external_apis": {
       "etherscan": {
         "status": "available"
       }
     }
   }
   ```

### Local Development Workflow

1. **Terminal 1**: Main Node.js application
   ```bash
   npm run dev  # Runs on http://localhost:3000
   ```

2. **Terminal 2**: Python Graph Service
   ```bash
   ./scripts/run_local.sh  # Runs on http://localhost:8000
   ```

### API Endpoints

- **Health Check**: `GET http://localhost:8000/health`
- **API Documentation**: `http://localhost:8000/docs` (Swagger UI)
- **Process Incident**: `POST http://localhost:8000/process_incident/{incident_id}`
- **Job Status**: `GET http://localhost:8000/jobs/{job_id}`
- **Service Stats**: `GET http://localhost:8000/stats`

### Configuration

The service reads configuration from `.env.local` (priority) or `.env` (fallback). Key settings:

- `DATABASE_URL`: PostgreSQL connection string
- `ETHERSCAN_API_KEY`: Your Etherscan API key
- `DEBUG`: Enable debug mode (true/false)
- `MAX_NODES_PER_GRAPH`: Maximum nodes per graph (default: 500)
- `MAX_API_CALLS_PER_INCIDENT`: API call limit (default: 25)
- `PROCESSING_TIMEOUT_SECONDS`: Processing timeout (default: 30)

### Troubleshooting

#### Service Won't Start
```bash
# Check if virtual environment is activated
source graph_service/venv/bin/activate

# Verify dependencies are installed
pip list | grep uvicorn

# Check if port 8000 is available
lsof -ti:8000
```

#### Database Connection Issues
```bash
# Test database connection
psql postgresql://postgres:password@localhost:5432/cryptomaltese_incidents -c "SELECT 1;"

# Re-run database initialization
python scripts/init_db.py
```

#### Etherscan API Issues
- Verify your API key is valid at [etherscan.io/apis](https://etherscan.io/apis)
- Check rate limits (max 5 calls/second for free tier)
- Test API directly: `curl "https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=YOUR_KEY"`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `NODE_ENV` | Environment | development | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `ETHERSCAN_API_KEY` | Etherscan API key | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | No |
| `SESSION_SECRET` | Session secret | - | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |
| `CACHE_TTL_SECONDS` | Cache TTL | 600 | No |
| `ETHERSCAN_TIMEOUT_MS` | API timeout | 30000 | No |
| `ETHERSCAN_RETRY_ATTEMPTS` | Retry attempts | 3 | No |

### Getting an Etherscan API Key

1. Visit [Etherscan.io](https://etherscan.io/)
2. Create an account
3. Navigate to API-Keys section
4. Create a new API key
5. Copy the key to your `.env` file

## 📊 Database Schema

### Tables

#### `incidents`
- `id` (UUID, Primary Key) - Unique incident identifier
- `wallet_address` (VARCHAR) - Compromised wallet address
- `transaction_hash` (VARCHAR, Unique) - Related transaction hash
- `description` (TEXT) - Incident description
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

#### `transaction_details`
- `id` (SERIAL, Primary Key) - Detail record ID
- `incident_id` (UUID, Foreign Key) - Reference to incident
- `block_number` (BIGINT) - Block number
- `timestamp_unix` (BIGINT) - Unix timestamp
- `from_address` (VARCHAR) - Source address
- `to_address` (VARCHAR) - Destination address
- `value` (VARCHAR) - Transaction value
- `contract_address` (VARCHAR) - Contract address (if applicable)
- `input` (TEXT) - Transaction input data
- `type` (VARCHAR) - Transaction type
- `gas` (BIGINT) - Gas limit
- `gas_used` (BIGINT) - Gas used
- `is_error` (BOOLEAN) - Error flag
- `error_code` (VARCHAR) - Error code
- `etherscan_status` (VARCHAR) - API response status
- `etherscan_message` (TEXT) - API response message
- `raw_json` (JSONB) - Complete API response
- `created_at` (TIMESTAMP) - Creation timestamp

## 🔌 API Documentation

### Endpoints

#### `POST /api/incidents`
Create a new incident report.

**Request Body:**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "transactionHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
  "description": "Wallet was compromised through phishing attack..."
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Incident reported successfully",
  "data": {
    "incidentId": "550e8400-e29b-41d4-a716-446655440000",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "transactionHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "description": "Wallet was compromised through phishing attack...",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "transactionCount": 3,
    "etherscanStatus": "1",
    "etherscanMessage": "OK"
  }
}
```

#### `GET /api/incidents/:id`
Get incident by ID.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "incident": { ... },
    "transactionDetails": [ ... ]
  }
}
```

#### `GET /api/incidents`
Get all incidents with pagination.

**Query Parameters:**
- `limit` (number, max 100): Number of results per page
- `offset` (number): Number of results to skip

#### `GET /health`
Health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345,
  "environment": "development"
}
```

### Error Responses

All error responses follow this format:
```json
{
  "status": "fail|error",
  "message": "Error description",
  "errors": [ ... ] // For validation errors
}
```

**Status Codes:**
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate transaction)
- `429` - Too Many Requests
- `500` - Internal Server Error
- `502` - Bad Gateway (Etherscan API error)

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Open Cypress test runner
npm run test:e2e:open
```

### Test Structure

- `tests/unit/` - Unit tests for individual functions
- `tests/integration/` - Integration tests for API endpoints
- `tests/e2e/` - End-to-end tests with Cypress

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set strong secrets for JWT_SECRET and SESSION_SECRET
- [ ] Configure CORS for production domains
- [ ] Set up SSL certificate
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring and logging
- [ ] Run database migrations
- [ ] Configure backup strategy

### Environment-Specific Configurations

#### Development
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/cryptomaltese_dev
```

#### Production
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-host:5432/cryptomaltese_prod
# Use strong, unique secrets
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Cloud Deployment Options

#### Heroku
1. Install Heroku CLI
2. Create Heroku app: `heroku create cryptomaltese`
3. Add PostgreSQL addon: `heroku addons:create heroku-postgresql`
4. Set environment variables: `heroku config:set ETHERSCAN_API_KEY=...`
5. Deploy: `git push heroku main`

#### AWS/DigitalOcean
- Use containers with Docker
- Set up managed PostgreSQL
- Configure load balancer
- Set up auto-scaling

## 🔐 Security Considerations

### Implemented Security Measures

1. **Input Validation**: Joi schema validation on all inputs
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **CORS Protection**: Configured for specific domains
4. **XSS Prevention**: Content Security Policy headers
5. **SQL Injection Prevention**: Parameterized queries
6. **Security Headers**: Helmet.js for security headers
7. **Environment Isolation**: Secrets in environment variables

### Security Best Practices

1. **Regular Updates**: Keep dependencies updated
2. **Monitoring**: Monitor for unusual activity
3. **Backup**: Regular database backups
4. **SSL/TLS**: Use HTTPS in production
5. **Logging**: Log security events
6. **Access Control**: Limit database access

## 📈 Performance Optimization

### Implemented Optimizations

1. **Caching**: Transaction data cached for 10 minutes
2. **Compression**: Gzip compression enabled
3. **Database Indexing**: Optimized indexes on frequent queries
4. **Connection Pooling**: PostgreSQL connection pool
5. **API Retry Logic**: Exponential backoff for Etherscan API
6. **Responsive Design**: Optimized for mobile devices

### Monitoring

- Application uptime
- Database performance
- API response times
- Error rates
- Cache hit rates

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Check connection string format
DATABASE_URL=postgresql://user:password@host:port/database
```

#### Etherscan API Errors
- Verify API key is valid
- Check rate limits (5 calls/second)
- Verify network connectivity

#### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

### Code Style

- Use ESLint configuration
- Follow existing code patterns
- Add tests for new features
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Etherscan.io](https://etherscan.io/) for blockchain data API
- [Express.js](https://expressjs.com/) for web framework
- [PostgreSQL](https://postgresql.org/) for database
- [Inter Font](https://rsms.me/inter/) for typography

## 📞 Support

For support, please create an issue in the GitHub repository or contact the development team.

---

**⚠️ Disclaimer**: This tool is for educational and security research purposes. Always verify transaction data independently and follow proper security practices when handling cryptocurrency wallets.
