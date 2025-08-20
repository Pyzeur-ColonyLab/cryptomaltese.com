const axios = require('axios')
const axiosRetry = require('axios-retry')
const NodeCache = require('node-cache')
const config = require('../../config')

// Create axios instance with retry configuration
const etherscanClient = axios.create({
  baseURL: config.etherscan.baseUrl,
  timeout: config.etherscan.timeout,
  headers: {
    'User-Agent': 'CryptoMaltese-IncidentReporter/1.0'
  }
})

// Configure retry logic
axiosRetry(etherscanClient, {
  retries: config.etherscan.retryAttempts,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           (error.response && error.response.status >= 500)
  }
})

// Cache for transaction data (10 minutes TTL)
const cache = new NodeCache({
  stdTTL: config.cache.ttlSeconds,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false
})

class EtherscanService {
  constructor() {
    this.apiKey = config.etherscan.apiKey
  }

  /**
   * Get internal transactions for a specific transaction hash
   * @param {string} txHash - Transaction hash to lookup
   * @returns {Promise<Object>} Etherscan API response
   */
  async getInternalTransactions(txHash) {
    const cacheKey = `internal_tx_${txHash}`
    
    // Check cache first
    const cachedResult = cache.get(cacheKey)
    if (cachedResult) {
      console.log(`Cache hit for transaction: ${txHash}`)
      return cachedResult
    }

    try {
      console.log(`Fetching internal transactions for: ${txHash}`)
      
      const response = await etherscanClient.get('', {
        params: {
          module: 'account',
          action: 'txlistinternal',
          txhash: txHash,
          apikey: this.apiKey
        }
      })

      const data = response.data
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Etherscan API')
      }

      // Check if API returned an error
      if (data.status === '0' && data.message !== 'No transactions found') {
        const error = new Error(`Etherscan API error: ${data.message || 'Unknown error'}`)
        error.name = 'EtherscanError'
        error.etherscanResponse = data
        throw error
      }

      // Cache successful response
      cache.set(cacheKey, data)
      
      console.log(`Successfully fetched data for transaction: ${txHash}`)
      return data

    } catch (error) {
      console.error(`Error fetching transaction ${txHash}:`, error.message)
      
      // Add context to the error
      if (error.response) {
        error.name = 'EtherscanError'
        error.etherscanStatus = error.response.status
        error.etherscanData = error.response.data
      }
      
      throw error
    }
  }

  /**
   * Get regular transaction details by hash
   * @param {string} txHash - Transaction hash to lookup
   * @returns {Promise<Object>} Etherscan API response
   */
  async getTransactionByHash(txHash) {
    const cacheKey = `tx_${txHash}`
    
    // Check cache first
    const cachedResult = cache.get(cacheKey)
    if (cachedResult) {
      console.log(`Cache hit for transaction details: ${txHash}`)
      return cachedResult
    }

    try {
      console.log(`Fetching transaction details for: ${txHash}`)
      
      const response = await etherscanClient.get('', {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: txHash,
          apikey: this.apiKey
        }
      })

      const data = response.data
      
      // Validate response
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Etherscan API')
      }

      if (data.error) {
        const error = new Error(`Etherscan API error: ${data.error.message || 'Unknown error'}`)
        error.name = 'EtherscanError'
        error.etherscanResponse = data
        throw error
      }

      // Cache successful response
      cache.set(cacheKey, data)
      
      console.log(`Successfully fetched transaction details: ${txHash}`)
      return data

    } catch (error) {
      console.error(`Error fetching transaction details ${txHash}:`, error.message)
      
      if (error.response) {
        error.name = 'EtherscanError'
        error.etherscanStatus = error.response.status
        error.etherscanData = error.response.data
      }
      
      throw error
    }
  }

  /**
   * Normalize internal transaction data for database storage
   * @param {Object} etherscanResponse - Raw Etherscan API response
   * @returns {Array} Normalized transaction array
   */
  normalizeInternalTransactions(etherscanResponse) {
    try {
      if (!etherscanResponse) {
        console.warn('Etherscan response is null or undefined')
        return []
      }

      if (!etherscanResponse.result) {
        console.log('No transaction results found in Etherscan response')
        return []
      }

      const transactions = Array.isArray(etherscanResponse.result) 
        ? etherscanResponse.result 
        : []

      console.log(`Processing ${transactions.length} internal transactions from Etherscan`)

      const normalized = transactions.map((tx, index) => {
        try {
          return {
            blockNumber: tx.blockNumber ? parseInt(tx.blockNumber) : null,
            timestampUnix: tx.timeStamp ? parseInt(tx.timeStamp) : null,
            fromAddress: tx.from || null,
            toAddress: tx.to || null,
            value: tx.value || '0',
            contractAddress: tx.contractAddress || null,
            input: tx.input || null,
            type: tx.type || null,
            gas: tx.gas ? parseInt(tx.gas) : null,
            gasUsed: tx.gasUsed ? parseInt(tx.gasUsed) : null,
            isError: tx.isError === '1',
            errorCode: tx.errCode || null,
            etherscanStatus: etherscanResponse.status,
            etherscanMessage: etherscanResponse.message,
            rawJson: tx
          }
        } catch (error) {
          console.error(`Error normalizing transaction ${index}:`, error)
          console.error('Raw transaction data:', tx)
          throw new Error(`Failed to normalize transaction data at index ${index}: ${error.message}`)
        }
      })

      console.log(`Successfully normalized ${normalized.length} transactions`)
      return normalized
    } catch (error) {
      console.error('Error in normalizeInternalTransactions:', error)
      throw error
    }
  }

  /**
   * Normalize main transaction data for database storage
   * @param {Object} etherscanResponse - Raw Etherscan API response from eth_getTransactionByHash
   * @returns {Object} Normalized transaction object
   */
  normalizeMainTransaction(etherscanResponse) {
    try {
      if (!etherscanResponse) {
        console.warn('Etherscan response is null or undefined')
        return null
      }

      if (!etherscanResponse.result) {
        console.log('No transaction result found in Etherscan response')
        return null
      }

      const tx = etherscanResponse.result
      console.log('Processing main transaction from Etherscan')

      // Helper function to convert hex to decimal
      const hexToDecimal = (hex) => {
        if (!hex || hex === '0x' || hex === '0x0') return '0'
        return parseInt(hex, 16).toString()
      }

      // Helper function to convert hex to number (for smaller values)
      const hexToNumber = (hex) => {
        if (!hex || hex === '0x' || hex === '0x0') return 0
        return parseInt(hex, 16)
      }

      const normalized = {
        blockNumber: hexToNumber(tx.blockNumber),
        timestampUnix: null, // Will need to fetch this separately if needed
        fromAddress: tx.from || null,
        toAddress: tx.to || null,
        value: hexToDecimal(tx.value),
        contractAddress: null, // Not applicable for main transactions
        input: tx.input || null,
        type: tx.type ? hexToNumber(tx.type).toString() : null,
        gas: hexToDecimal(tx.gas),
        gasUsed: null, // Not available in transaction details, need receipt for this
        isError: false, // Main transaction API doesn't return error status directly
        errorCode: null,
        etherscanStatus: '1', // Always success if we get the transaction
        etherscanMessage: 'OK',
        // Additional fields specific to main transactions
        gasPrice: hexToDecimal(tx.gasPrice),
        maxFeePerGas: tx.maxFeePerGas ? hexToDecimal(tx.maxFeePerGas) : null,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? hexToDecimal(tx.maxPriorityFeePerGas) : null,
        nonce: hexToNumber(tx.nonce),
        transactionIndex: hexToNumber(tx.transactionIndex),
        blockHash: tx.blockHash || null,
        chainId: tx.chainId ? hexToNumber(tx.chainId) : null,
        rawJson: tx
      }

      console.log('Successfully normalized main transaction')
      return normalized
    } catch (error) {
      console.error('Error in normalizeMainTransaction:', error)
      console.error('Raw transaction data:', etherscanResponse)
      throw error
    }
  }

  /**
   * Verify if a transaction hash exists on the Ethereum network
   * @param {string} txHash - Transaction hash to verify
   * @returns {Promise<boolean>} True if transaction exists
   */
  async verifyTransactionExists(txHash) {
    try {
      const response = await this.getTransactionByHash(txHash)
      return response.result !== null
    } catch (error) {
      console.error(`Error verifying transaction ${txHash}:`, error.message)
      return false
    }
  }

  /**
   * Clear cache for a specific transaction
   * @param {string} txHash - Transaction hash to clear from cache
   */
  clearTransactionCache(txHash) {
    cache.del(`tx_${txHash}`)
    cache.del(`internal_tx_${txHash}`)
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  }

  /**
   * Clear all cached data
   */
  clearAllCache() {
    cache.flushAll()
  }
}

module.exports = new EtherscanService()
