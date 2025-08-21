const axios = require('axios')
const axiosRetry = require('axios-retry')
const config = require('../../config')

// Create axios instance for graph service
const graphClient = axios.create({
  baseURL: config.graphService.url,
  timeout: config.graphService.timeout,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'CryptoMaltese-IncidentReporter/1.0'
  }
})

// Configure retry logic
axiosRetry(graphClient, {
  retries: config.graphService.retryAttempts,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors, 5xx server errors, but not on 4xx client errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           (error.response && error.response.status >= 500) ||
           (error.response && error.response.status === 502) // Bad Gateway
  }
})

class GraphServiceError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message)
    this.name = 'GraphServiceError'
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

class GraphServiceClient {
  /**
   * Start graph processing for an incident
   * @param {string} incidentId - UUID of the incident to process
   * @param {object} options - Optional processing options
   * @returns {Promise<object>} Processing response
   */
  async processIncident(incidentId, options = {}) {
    try {
      console.log(`Starting graph processing for incident: ${incidentId}`)
      
      const response = await graphClient.post(`/process_incident/${incidentId}`, {
        options
      })
      
      console.log(`Graph processing started successfully: ${incidentId}`)
      return response.data
      
    } catch (error) {
      console.error(`Error starting graph processing for incident ${incidentId}:`, error.message)
      
      if (error.response) {
        const { status, data } = error.response
        const errorCode = data?.error_code || 'GRAPH_SERVICE_ERROR'
        const message = data?.message || `Graph service returned ${status}`
        
        throw new GraphServiceError(message, status, errorCode)
      }
      
      throw new GraphServiceError('Failed to connect to graph service', 503, 'GRAPH_SERVICE_UNAVAILABLE')
    }
  }
  
  /**
   * Get the status of a graph processing job
   * @param {string} jobId - Job ID to check status for
   * @returns {Promise<object>} Job status response
   */
  async getJobStatus(jobId) {
    try {
      console.log(`Getting job status for: ${jobId}`)
      
      const response = await graphClient.get(`/jobs/${jobId}`)
      
      return response.data
      
    } catch (error) {
      console.error(`Error getting job status for ${jobId}:`, error.message)
      
      if (error.response) {
        const { status, data } = error.response
        const errorCode = data?.error_code || 'GRAPH_SERVICE_ERROR'
        const message = data?.message || `Graph service returned ${status}`
        
        throw new GraphServiceError(message, status, errorCode)
      }
      
      throw new GraphServiceError('Failed to connect to graph service', 503, 'GRAPH_SERVICE_UNAVAILABLE')
    }
  }
  
  /**
   * Check if graph service is healthy
   * @returns {Promise<object>} Health check response
   */
  async healthCheck() {
    try {
      const response = await graphClient.get('/health', {
        timeout: 5000 // Shorter timeout for health checks
      })
      
      return {
        status: 'healthy',
        details: response.data
      }
      
    } catch (error) {
      console.error('Graph service health check failed:', error.message)
      
      return {
        status: 'unhealthy',
        error: error.message,
        details: error.response?.data || null
      }
    }
  }
  
  /**
   * Get graph service statistics
   * @returns {Promise<object>} Service statistics
   */
  async getStats() {
    try {
      const response = await graphClient.get('/stats', {
        timeout: 10000
      })
      
      return response.data
      
    } catch (error) {
      console.error('Error getting graph service stats:', error.message)
      throw new GraphServiceError('Failed to get graph service statistics', 503, 'STATS_UNAVAILABLE')
    }
  }
  
  /**
   * Check if the graph service is available
   * @returns {Promise<boolean>} True if service is reachable
   */
  async isAvailable() {
    try {
      await graphClient.get('/', { timeout: 3000 })
      return true
    } catch (error) {
      return false
    }
  }
  
  /**
   * Get configuration info
   * @returns {object} Client configuration
   */
  getConfig() {
    return {
      url: config.graphService.url,
      timeout: config.graphService.timeout,
      retryAttempts: config.graphService.retryAttempts
    }
  }
}

module.exports = new GraphServiceClient()
