const Incident = require('../models/Incident')
const TransactionDetail = require('../models/TransactionDetail')
const etherscanService = require('../services/etherscanService')
const db = require('../models/database')
const { AppError } = require('../middlewares/errorHandler')
const { v4: uuidv4 } = require('uuid')

class IncidentController {
  /**
   * Create a new incident report
   * POST /api/incidents
   */
  async createIncident(req, res, next) {
    try {
      const { walletAddress, transactionHash, description } = req.body

      // Step 1: Check if incident already exists for this transaction
      console.log(`Checking for existing incident with transaction hash: ${transactionHash}`)
      const existingIncident = await Incident.findByTransactionHash(transactionHash)
      
      if (existingIncident) {
        return res.status(409).json({
          status: 'fail',
          message: 'This transaction has already been reported',
          incidentId: existingIncident.id,
          reportedAt: existingIncident.created_at
        })
      }

      // Step 2: Verify transaction exists and fetch data from Etherscan
      console.log(`Fetching transaction data from Etherscan for: ${transactionHash}`)
      
      let etherscanResponse
      try {
        // First verify the transaction exists
        const transactionExists = await etherscanService.verifyTransactionExists(transactionHash)
        if (!transactionExists) {
          return res.status(404).json({
            status: 'fail',
            message: 'Transaction hash not found on Ethereum network'
          })
        }

        // Fetch main transaction details
        etherscanResponse = await etherscanService.getTransactionByHash(transactionHash)
      } catch (etherscanError) {
        console.error('Etherscan API error:', etherscanError)
        
        // Return appropriate error based on the type of failure
        if (etherscanError.name === 'EtherscanError') {
          return res.status(502).json({
            status: 'error',
            message: 'Unable to retrieve blockchain data for this transaction. Please try again later.',
            details: etherscanError.message
          })
        }
        
        throw etherscanError
      }

      // Step 3: Create incident and transaction details in a database transaction
      console.log(`Creating incident record for wallet: ${walletAddress}`)
      
      const result = await db.transaction(async (client) => {
        console.log('Starting database transaction')
        
        // Create the incident record within transaction
        const incidentId = uuidv4()
        const incidentQuery = `
          INSERT INTO incidents (id, wallet_address, transaction_hash, description)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `
        const incidentResult = await client.query(incidentQuery, [
          incidentId, 
          walletAddress, 
          transactionHash, 
          description
        ])
        const incident = incidentResult.rows[0]
        console.log(`Created incident ${incident.id} within transaction`)

        // Normalize main transaction data
        const normalizedTransaction = etherscanService.normalizeMainTransaction(etherscanResponse)
        console.log('Normalized main transaction data')
        
        const transactionDetails = []
        
        if (normalizedTransaction) {
          // Create transaction detail within the same transaction
          const detailQuery = `
            INSERT INTO transaction_details (
              incident_id, block_number, timestamp_unix, from_address, to_address,
              value, contract_address, input, type, gas, gas_used,
              is_error, error_code, etherscan_status, etherscan_message, raw_json,
              gas_price, max_fee_per_gas, max_priority_fee_per_gas, nonce,
              transaction_index, block_hash, chain_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
          `
          
          const detailResult = await client.query(detailQuery, [
            incident.id,
            normalizedTransaction.blockNumber,
            normalizedTransaction.timestampUnix,
            normalizedTransaction.fromAddress,
            normalizedTransaction.toAddress,
            normalizedTransaction.value,
            normalizedTransaction.contractAddress,
            normalizedTransaction.input,
            normalizedTransaction.type,
            normalizedTransaction.gas,
            normalizedTransaction.gasUsed,
            normalizedTransaction.isError,
            normalizedTransaction.errorCode,
            normalizedTransaction.etherscanStatus,
            normalizedTransaction.etherscanMessage,
            JSON.stringify(normalizedTransaction.rawJson),
            normalizedTransaction.gasPrice,
            normalizedTransaction.maxFeePerGas,
            normalizedTransaction.maxPriorityFeePerGas,
            normalizedTransaction.nonce,
            normalizedTransaction.transactionIndex,
            normalizedTransaction.blockHash,
            normalizedTransaction.chainId
          ])
          transactionDetails.push(detailResult.rows[0])
          console.log(`Created transaction detail ${detailResult.rows[0].id} within transaction`)
        }
        
        console.log(`Transaction completed: incident ${incident.id} with ${transactionDetails.length} details`)

        return {
          incident,
          transactionDetails,
          etherscanData: {
            status: etherscanResponse.jsonrpc ? 'success' : (etherscanResponse.status || '1'),
            message: etherscanResponse.jsonrpc ? 'OK' : (etherscanResponse.message || 'Transaction retrieved'),
            transactionCount: transactionDetails.length
          }
        }
      })

      console.log(`Successfully created incident: ${result.incident.id}`)

      // Step 4: Return success response
      res.status(201).json({
        status: 'success',
        message: 'Incident reported successfully',
        data: {
          incidentId: result.incident.id,
          walletAddress: result.incident.wallet_address,
          transactionHash: result.incident.transaction_hash,
          description: result.incident.description,
          createdAt: result.incident.created_at,
          transactionCount: result.transactionDetails.length,
          etherscanStatus: result.etherscanData.status,
          etherscanMessage: result.etherscanData.message
        }
      })

    } catch (error) {
      console.error('Error in createIncident:', error)
      next(error)
    }
  }

  /**
   * Get incident by ID
   * GET /api/incidents/:id
   */
  async getIncidentById(req, res, next) {
    try {
      const { id } = req.params

      const incident = await Incident.findById(id)
      if (!incident) {
        return res.status(404).json({
          status: 'fail',
          message: 'Incident not found'
        })
      }

      // Get associated transaction details
      const transactionDetails = await TransactionDetail.findByIncidentId(id)

      res.status(200).json({
        status: 'success',
        data: {
          incident,
          transactionDetails
        }
      })

    } catch (error) {
      console.error('Error in getIncidentById:', error)
      next(error)
    }
  }

  /**
   * Get incidents with pagination
   * GET /api/incidents
   */
  async getIncidents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10
      const offset = parseInt(req.query.offset) || 0

      // Validate pagination parameters
      if (limit > 100) {
        return res.status(400).json({
          status: 'fail',
          message: 'Limit cannot exceed 100'
        })
      }

      const incidents = await Incident.getAll(limit, offset)
      const totalCount = await Incident.count()

      res.status(200).json({
        status: 'success',
        data: {
          incidents,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          }
        }
      })

    } catch (error) {
      console.error('Error in getIncidents:', error)
      next(error)
    }
  }

  /**
   * Get incidents by wallet address
   * GET /api/incidents/wallet/:walletAddress
   */
  async getIncidentsByWallet(req, res, next) {
    try {
      const { walletAddress } = req.params
      const { limit = 10, offset = 0 } = req.query

      const incidents = await Incident.findByWalletAddress(walletAddress, limit, offset)

      res.status(200).json({
        status: 'success',
        data: {
          walletAddress,
          incidents,
          count: incidents.length
        }
      })

    } catch (error) {
      console.error('Error in getIncidentsByWallet:', error)
      next(error)
    }
  }

  /**
   * Update incident description
   * PUT /api/incidents/:id
   */
  async updateIncident(req, res, next) {
    try {
      const { id } = req.params
      const { description } = req.body

      // Validate description
      if (!description || description.trim().length < 10 || description.length > 1000) {
        return res.status(400).json({
          status: 'fail',
          message: 'Description must be between 10 and 1000 characters'
        })
      }

      const updatedIncident = await Incident.updateDescription(id, description.trim())
      
      if (!updatedIncident) {
        return res.status(404).json({
          status: 'fail',
          message: 'Incident not found'
        })
      }

      res.status(200).json({
        status: 'success',
        message: 'Incident description updated successfully',
        data: {
          incident: updatedIncident
        }
      })

    } catch (error) {
      console.error('Error in updateIncident:', error)
      next(error)
    }
  }

  /**
   * Delete incident (admin only - placeholder implementation)
   * DELETE /api/incidents/:id
   */
  async deleteIncident(req, res, next) {
    try {
      const { id } = req.params

      // In a production system, you'd want to check admin permissions here
      // For now, this is a placeholder that could be used for admin functionality

      const deletedIncident = await Incident.delete(id)
      
      if (!deletedIncident) {
        return res.status(404).json({
          status: 'fail',
          message: 'Incident not found'
        })
      }

      res.status(200).json({
        status: 'success',
        message: 'Incident deleted successfully',
        data: {
          deletedIncident
        }
      })

    } catch (error) {
      console.error('Error in deleteIncident:', error)
      next(error)
    }
  }

  /**
   * Get incident statistics
   * GET /api/incidents/stats
   */
  async getIncidentStats(req, res, next) {
    try {
      const totalIncidents = await Incident.count()
      const cacheStats = etherscanService.getCacheStats()

      res.status(200).json({
        status: 'success',
        data: {
          totalIncidents,
          cacheStats
        }
      })

    } catch (error) {
      console.error('Error in getIncidentStats:', error)
      next(error)
    }
  }
}

module.exports = new IncidentController()
