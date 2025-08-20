const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const path = require('path')

const config = require('../config')
const incidentRoutes = require('./routes/incidents')
const errorHandler = require('./middlewares/errorHandler')

const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? ['https://cryptomaltese.com', 'https://www.cryptomaltese.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))

// Compression middleware
app.use(compression())

// Request logging
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'))

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files
app.use(express.static(path.join(__dirname, '../client')))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  })
})

// API routes
app.use('/api/incidents', incidentRoutes)

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'))
})

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  })
})

// 404 handler for everything else
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../client/404.html'))
})

// Global error handler
app.use(errorHandler)

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  const db = require('./models/database')
  db.close().then(() => {
    console.log('Database connections closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  const db = require('./models/database')
  db.close().then(() => {
    console.log('Database connections closed')
    process.exit(0)
  })
})

// Start server
const PORT = config.port
const server = app.listen(PORT, () => {
  console.log(`🚀 Incident Reporter server running on port ${PORT}`)
  console.log(`🌍 Environment: ${config.nodeEnv}`)
  console.log(`🔗 Local: http://localhost:${PORT}`)
})

module.exports = { app, server }
