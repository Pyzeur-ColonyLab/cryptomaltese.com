const db = require('./database')
const { v4: uuidv4 } = require('uuid')

class Incident {
  static async findByTransactionHash(transactionHash) {
    try {
      const query = 'SELECT * FROM incidents WHERE transaction_hash = $1'
      const result = await db.query(query, [transactionHash])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error finding incident by transaction hash:', error)
      throw error
    }
  }

  static async findById(id) {
    try {
      const query = 'SELECT * FROM incidents WHERE id = $1'
      const result = await db.query(query, [id])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error finding incident by ID:', error)
      throw error
    }
  }

  static async create(incidentData) {
    try {
      const { walletAddress, transactionHash, description } = incidentData
      const id = uuidv4()
      
      const query = `
        INSERT INTO incidents (id, wallet_address, transaction_hash, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `
      
      const result = await db.query(query, [id, walletAddress, transactionHash, description])
      return result.rows[0]
    } catch (error) {
      console.error('Error creating incident:', error)
      throw error
    }
  }

  static async findByWalletAddress(walletAddress, limit = 10, offset = 0) {
    try {
      const query = `
        SELECT * FROM incidents 
        WHERE wallet_address = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `
      const result = await db.query(query, [walletAddress, limit, offset])
      return result.rows
    } catch (error) {
      console.error('Error finding incidents by wallet address:', error)
      throw error
    }
  }

  static async getAll(limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM incidents 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `
      const result = await db.query(query, [limit, offset])
      return result.rows
    } catch (error) {
      console.error('Error getting all incidents:', error)
      throw error
    }
  }

  static async count() {
    try {
      const query = 'SELECT COUNT(*) as total FROM incidents'
      const result = await db.query(query)
      return parseInt(result.rows[0].total)
    } catch (error) {
      console.error('Error counting incidents:', error)
      throw error
    }
  }

  static async updateDescription(id, description) {
    try {
      const query = `
        UPDATE incidents 
        SET description = $2, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 
        RETURNING *
      `
      const result = await db.query(query, [id, description])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error updating incident description:', error)
      throw error
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM incidents WHERE id = $1 RETURNING *'
      const result = await db.query(query, [id])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error deleting incident:', error)
      throw error
    }
  }
}

module.exports = Incident
