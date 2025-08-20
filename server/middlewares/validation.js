const Joi = require('joi')

// Ethereum address validation pattern
const ethereumAddressPattern = /^0x[a-fA-F0-9]{40}$/

// Transaction hash validation pattern  
const transactionHashPattern = /^0x[a-fA-F0-9]{64}$/

// Validation schemas
const schemas = {
  createIncident: Joi.object({
    walletAddress: Joi.string()
      .pattern(ethereumAddressPattern)
      .required()
      .messages({
        'string.pattern.base': 'Wallet address must be a valid Ethereum address (0x followed by 40 hex characters)',
        'any.required': 'Wallet address is required'
      }),
    
    transactionHash: Joi.string()
      .pattern(transactionHashPattern)
      .required()
      .messages({
        'string.pattern.base': 'Transaction hash must be a valid format (0x followed by 64 hex characters)',
        'any.required': 'Transaction hash is required'
      }),
    
    description: Joi.string()
      .trim()
      .min(10)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Description must be at least 10 characters long',
        'string.max': 'Description cannot exceed 1000 characters',
        'any.required': 'Description is required'
      })
  }),

  getIncidentsByWallet: Joi.object({
    walletAddress: Joi.string()
      .pattern(ethereumAddressPattern)
      .required()
      .messages({
        'string.pattern.base': 'Wallet address must be a valid Ethereum address',
        'any.required': 'Wallet address is required'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.min': 'Offset must be 0 or greater'
      })
  }),

  incidentId: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid incident ID format',
        'any.required': 'Incident ID is required'
      })
  })
}

// Middleware function to validate request data
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[property]
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Include all errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert strings to numbers when appropriate
    })

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }))

      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: errorDetails
      })
    }

    // Replace the original data with validated/sanitized data
    req[property] = value
    next()
  }
}

// Specific validation middleware functions
const validateCreateIncident = validate(schemas.createIncident, 'body')
const validateGetIncidentsByWallet = validate(schemas.getIncidentsByWallet, 'query')
const validateIncidentId = validate(schemas.incidentId, 'params')

// Helper function to check if string is valid Ethereum address
const isValidEthereumAddress = (address) => {
  return ethereumAddressPattern.test(address)
}

// Helper function to check if string is valid transaction hash
const isValidTransactionHash = (hash) => {
  return transactionHashPattern.test(hash)
}

module.exports = {
  schemas,
  validate,
  validateCreateIncident,
  validateGetIncidentsByWallet,
  validateIncidentId,
  isValidEthereumAddress,
  isValidTransactionHash
}
