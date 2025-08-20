const db = require('./database')

class TransactionDetail {
  static async create(transactionData) {
    try {
      const {
        incidentId,
        blockNumber,
        timestampUnix,
        fromAddress,
        toAddress,
        value,
        contractAddress,
        input,
        type,
        gas,
        gasUsed,
        isError,
        errorCode,
        etherscanStatus,
        etherscanMessage,
        rawJson
      } = transactionData

      const query = `
        INSERT INTO transaction_details (
          incident_id, block_number, timestamp_unix, from_address, to_address,
          value, contract_address, input, type, gas, gas_used,
          is_error, error_code, etherscan_status, etherscan_message, raw_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `

      const result = await db.query(query, [
        incidentId,
        blockNumber,
        timestampUnix,
        fromAddress,
        toAddress,
        value,
        contractAddress,
        input,
        type,
        gas,
        gasUsed,
        isError,
        errorCode,
        etherscanStatus,
        etherscanMessage,
        rawJson
      ])

      return result.rows[0]
    } catch (error) {
      console.error('Error creating transaction detail:', error)
      throw error
    }
  }

  static async createBulk(transactionDataArray) {
    try {
      if (!transactionDataArray || transactionDataArray.length === 0) {
        return []
      }

      return await db.transaction(async (client) => {
        const results = []
        for (const transactionData of transactionDataArray) {
          const {
            incidentId,
            blockNumber,
            timestampUnix,
            fromAddress,
            toAddress,
            value,
            contractAddress,
            input,
            type,
            gas,
            gasUsed,
            isError,
            errorCode,
            etherscanStatus,
            etherscanMessage,
            rawJson
          } = transactionData

          const query = `
            INSERT INTO transaction_details (
              incident_id, block_number, timestamp_unix, from_address, to_address,
              value, contract_address, input, type, gas, gas_used,
              is_error, error_code, etherscan_status, etherscan_message, raw_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
          `

          const result = await client.query(query, [
            incidentId,
            blockNumber,
            timestampUnix,
            fromAddress,
            toAddress,
            value,
            contractAddress,
            input,
            type,
            gas,
            gasUsed,
            isError,
            errorCode,
            etherscanStatus,
            etherscanMessage,
            rawJson
          ])

          results.push(result.rows[0])
        }
        return results
      })
    } catch (error) {
      console.error('Error creating bulk transaction details:', error)
      throw error
    }
  }

  static async findByIncidentId(incidentId) {
    try {
      const query = `
        SELECT * FROM transaction_details 
        WHERE incident_id = $1 
        ORDER BY created_at ASC
      `
      const result = await db.query(query, [incidentId])
      return result.rows
    } catch (error) {
      console.error('Error finding transaction details by incident ID:', error)
      throw error
    }
  }

  static async findById(id) {
    try {
      const query = 'SELECT * FROM transaction_details WHERE id = $1'
      const result = await db.query(query, [id])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error finding transaction detail by ID:', error)
      throw error
    }
  }

  static async findByFromAddress(fromAddress, limit = 10, offset = 0) {
    try {
      const query = `
        SELECT td.*, i.wallet_address, i.transaction_hash 
        FROM transaction_details td
        JOIN incidents i ON td.incident_id = i.id
        WHERE td.from_address = $1 
        ORDER BY td.created_at DESC 
        LIMIT $2 OFFSET $3
      `
      const result = await db.query(query, [fromAddress, limit, offset])
      return result.rows
    } catch (error) {
      console.error('Error finding transaction details by from address:', error)
      throw error
    }
  }

  static async findByToAddress(toAddress, limit = 10, offset = 0) {
    try {
      const query = `
        SELECT td.*, i.wallet_address, i.transaction_hash 
        FROM transaction_details td
        JOIN incidents i ON td.incident_id = i.id
        WHERE td.to_address = $1 
        ORDER BY td.created_at DESC 
        LIMIT $2 OFFSET $3
      `
      const result = await db.query(query, [toAddress, limit, offset])
      return result.rows
    } catch (error) {
      console.error('Error finding transaction details by to address:', error)
      throw error
    }
  }

  static async deleteByIncidentId(incidentId) {
    try {
      const query = 'DELETE FROM transaction_details WHERE incident_id = $1 RETURNING *'
      const result = await db.query(query, [incidentId])
      return result.rows
    } catch (error) {
      console.error('Error deleting transaction details by incident ID:', error)
      throw error
    }
  }
}

module.exports = TransactionDetail
