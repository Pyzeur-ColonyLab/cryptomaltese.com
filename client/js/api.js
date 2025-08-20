/**
 * API client for incident reporting
 */

class IncidentAPI {
    constructor() {
        this.baseURL = window.location.origin
        this.apiURL = `${this.baseURL}/api`
    }

    /**
     * Submit a new incident report
     * @param {Object} incidentData - The incident data to submit
     * @returns {Promise<Object>} API response
     */
    async submitIncident(incidentData) {
        try {
            const response = await fetch(`${this.apiURL}/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(incidentData)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new APIError(data.message || 'Failed to submit incident', response.status, data)
            }

            return data
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            
            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new APIError('Network error. Please check your connection and try again.', 0)
            }
            
            throw new APIError('An unexpected error occurred. Please try again.', 0)
        }
    }

    /**
     * Get incident by ID
     * @param {string} incidentId - The incident ID
     * @returns {Promise<Object>} API response
     */
    async getIncident(incidentId) {
        try {
            const response = await fetch(`${this.apiURL}/incidents/${incidentId}`)
            const data = await response.json()

            if (!response.ok) {
                throw new APIError(data.message || 'Failed to fetch incident', response.status, data)
            }

            return data
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            throw new APIError('Failed to fetch incident details', 0)
        }
    }

    /**
     * Get incidents by wallet address
     * @param {string} walletAddress - The wallet address
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise<Object>} API response
     */
    async getIncidentsByWallet(walletAddress, options = {}) {
        try {
            const params = new URLSearchParams()
            if (options.limit) params.append('limit', options.limit)
            if (options.offset) params.append('offset', options.offset)

            const queryString = params.toString()
            const url = `${this.apiURL}/incidents/wallet/${walletAddress}${queryString ? '?' + queryString : ''}`

            const response = await fetch(url)
            const data = await response.json()

            if (!response.ok) {
                throw new APIError(data.message || 'Failed to fetch incidents', response.status, data)
            }

            return data
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            throw new APIError('Failed to fetch wallet incidents', 0)
        }
    }

    /**
     * Get all incidents with pagination
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise<Object>} API response
     */
    async getIncidents(options = {}) {
        try {
            const params = new URLSearchParams()
            if (options.limit) params.append('limit', options.limit)
            if (options.offset) params.append('offset', options.offset)

            const queryString = params.toString()
            const url = `${this.apiURL}/incidents${queryString ? '?' + queryString : ''}`

            const response = await fetch(url)
            const data = await response.json()

            if (!response.ok) {
                throw new APIError(data.message || 'Failed to fetch incidents', response.status, data)
            }

            return data
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            throw new APIError('Failed to fetch incidents', 0)
        }
    }

    /**
     * Check API health
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`)
            const data = await response.json()

            if (!response.ok) {
                throw new APIError('API health check failed', response.status, data)
            }

            return data
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            throw new APIError('Failed to check API health', 0)
        }
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status, data = null) {
        super(message)
        this.name = 'APIError'
        this.status = status
        this.data = data
    }

    /**
     * Check if error is a validation error
     * @returns {boolean}
     */
    isValidationError() {
        return this.status === 400 && this.data && this.data.errors
    }

    /**
     * Check if error is a duplicate error
     * @returns {boolean}
     */
    isDuplicateError() {
        return this.status === 409
    }

    /**
     * Check if error is a not found error
     * @returns {boolean}
     */
    isNotFoundError() {
        return this.status === 404
    }

    /**
     * Check if error is a rate limit error
     * @returns {boolean}
     */
    isRateLimitError() {
        return this.status === 429
    }

    /**
     * Check if error is a server error
     * @returns {boolean}
     */
    isServerError() {
        return this.status >= 500
    }

    /**
     * Check if error is a network error
     * @returns {boolean}
     */
    isNetworkError() {
        return this.status === 0
    }

    /**
     * Get user-friendly error message
     * @returns {string}
     */
    getUserMessage() {
        if (this.isNetworkError()) {
            return 'Unable to connect to the server. Please check your internet connection.'
        }

        if (this.isRateLimitError()) {
            return 'Too many requests. Please wait a moment before trying again.'
        }

        if (this.isServerError()) {
            return 'Server error. Please try again later.'
        }

        if (this.isDuplicateError()) {
            return 'This transaction has already been reported.'
        }

        if (this.isNotFoundError()) {
            return 'The requested resource was not found.'
        }

        return this.message || 'An unexpected error occurred.'
    }

    /**
     * Get validation errors if available
     * @returns {Object|null}
     */
    getValidationErrors() {
        if (this.isValidationError() && this.data.errors) {
            return this.data.errors
        }
        return null
    }
}

/**
 * Response helper functions
 */
const ResponseHelper = {
    /**
     * Handle API response with proper error handling
     * @param {Promise} apiPromise - The API promise
     * @returns {Promise<Object>} Processed response
     */
    async handleResponse(apiPromise) {
        try {
            return await apiPromise
        } catch (error) {
            if (error instanceof APIError) {
                throw error
            }
            throw new APIError('An unexpected error occurred', 0)
        }
    },

    /**
     * Extract incident data from response
     * @param {Object} response - API response
     * @returns {Object} Incident data
     */
    extractIncidentData(response) {
        if (response.status === 'success' && response.data) {
            return response.data
        }
        throw new Error('Invalid response format')
    },

    /**
     * Format error for display
     * @param {Error} error - The error to format
     * @returns {Object} Formatted error
     */
    formatError(error) {
        if (error instanceof APIError) {
            return {
                title: this.getErrorTitle(error),
                message: error.getUserMessage(),
                type: this.getErrorType(error),
                details: error.data
            }
        }

        return {
            title: 'Error',
            message: error.message || 'An unexpected error occurred',
            type: 'error',
            details: null
        }
    },

    /**
     * Get error title based on error type
     * @param {APIError} error - The API error
     * @returns {string} Error title
     */
    getErrorTitle(error) {
        if (error.isValidationError()) return 'Validation Error'
        if (error.isDuplicateError()) return 'Duplicate Report'
        if (error.isNotFoundError()) return 'Not Found'
        if (error.isRateLimitError()) return 'Rate Limit Exceeded'
        if (error.isServerError()) return 'Server Error'
        if (error.isNetworkError()) return 'Network Error'
        return 'Error'
    },

    /**
     * Get error type for UI styling
     * @param {APIError} error - The API error
     * @returns {string} Error type
     */
    getErrorType(error) {
        if (error.isValidationError()) return 'warning'
        if (error.isDuplicateError()) return 'info'
        if (error.isRateLimitError()) return 'warning'
        return 'error'
    }
}

// Create global API instance
window.incidentAPI = new IncidentAPI()
window.APIError = APIError
window.ResponseHelper = ResponseHelper
