const config = require('../../config')

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

const handleValidationError = (err) => {
  if (err.details) {
    // Joi validation error
    const errors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }))
    return new AppError(`Validation failed: ${errors.map(e => e.message).join(', ')}`, 400)
  }
  return new AppError('Validation failed', 400)
}

const handleDatabaseError = (err) => {
  console.error('Database error:', err)
  
  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    if (err.constraint?.includes('transaction_hash')) {
      return new AppError('This transaction has already been reported', 409)
    }
    return new AppError('Duplicate entry detected', 409)
  }
  
  // PostgreSQL foreign key constraint violation
  if (err.code === '23503') {
    return new AppError('Referenced record not found', 400)
  }
  
  // PostgreSQL check constraint violation
  if (err.code === '23514') {
    return new AppError('Data validation failed', 400)
  }
  
  // PostgreSQL connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return new AppError('Database connection failed', 503)
  }
  
  return new AppError('Database operation failed', 500)
}

const handleEtherscanError = (err) => {
  if (err.response) {
    // Etherscan API responded with an error
    const status = err.response.status
    const data = err.response.data
    
    if (status === 429) {
      return new AppError('Blockchain data service rate limit exceeded, please try again later', 429)
    }
    
    if (status >= 500) {
      return new AppError('Blockchain data service is temporarily unavailable', 502)
    }
    
    if (data?.message) {
      return new AppError(`Blockchain data error: ${data.message}`, 502)
    }
  }
  
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return new AppError('Blockchain data service request timed out', 504)
  }
  
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return new AppError('Unable to connect to blockchain data service', 502)
  }
  
  return new AppError('Failed to retrieve blockchain data', 502)
}

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  })
}

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    })
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err)
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    })
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500
  err.status = err.status || 'error'

  if (config.nodeEnv === 'development') {
    sendErrorDev(err, res)
  } else {
    let error = { ...err }
    error.message = err.message

    // Handle specific error types
    if (err.name === 'ValidationError' || err.isJoi) {
      error = handleValidationError(err)
    } else if (err.code?.startsWith('23') || err.name === 'PostgresError') {
      error = handleDatabaseError(err)
    } else if (err.isAxiosError || err.name === 'EtherscanError') {
      error = handleEtherscanError(err)
    } else if (err.name === 'CastError') {
      error = new AppError('Invalid data format', 400)
    } else if (err.name === 'JsonWebTokenError') {
      error = new AppError('Invalid token', 401)
    } else if (err.name === 'TokenExpiredError') {
      error = new AppError('Token expired', 401)
    }

    sendErrorProd(error, res)
  }
}

module.exports = errorHandler
module.exports.AppError = AppError
