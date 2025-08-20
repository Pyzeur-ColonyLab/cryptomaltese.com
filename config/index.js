require('dotenv').config()

const requiredEnvVars = [
  'DATABASE_URL',
  'ETHERSCAN_API_KEY'
]

// Validate required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`)
  console.error('Please copy .env.template to .env and fill in the required values')
  process.exit(1)
}

const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // External APIs
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    baseUrl: 'https://api.etherscan.io/api',
    timeout: parseInt(process.env.ETHERSCAN_TIMEOUT_MS) || 30000,
    retryAttempts: parseInt(process.env.ETHERSCAN_RETRY_ATTEMPTS) || 3
  },
  
  // Security
  secrets: {
    jwt: process.env.JWT_SECRET || 'fallback-jwt-secret-dev-only',
    session: process.env.SESSION_SECRET || 'fallback-session-secret-dev-only'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // Cache
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS) || 600 // 10 minutes
  }
}

module.exports = config
