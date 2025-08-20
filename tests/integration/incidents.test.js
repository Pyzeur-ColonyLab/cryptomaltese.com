/**
 * Integration tests for incident API endpoints
 */

const request = require('supertest')
const { app } = require('../../server/app')
const db = require('../../server/models/database')

// Mock Etherscan service
jest.mock('../../server/services/etherscanService', () => ({
  verifyTransactionExists: jest.fn(),
  getInternalTransactions: jest.fn(),
  normalizeInternalTransactions: jest.fn()
}))

const etherscanService = require('../../server/services/etherscanService')

describe('Incidents API', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    
    // Default mock implementations
    etherscanService.verifyTransactionExists.mockResolvedValue(true)
    etherscanService.getInternalTransactions.mockResolvedValue({
      status: '1',
      message: 'OK',
      result: []
    })
    etherscanService.normalizeInternalTransactions.mockReturnValue([])
  })

  afterAll(async () => {
    // Clean up database connections
    await db.close()
  })

  describe('POST /api/incidents', () => {
    const validIncidentData = {
      walletAddress: '0x1234567890123456789012345678901234567890',
      transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
      description: 'Test incident description that meets the minimum length requirement.'
    }

    it('should create a new incident successfully', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect('Content-Type', /json/)
        .expect(201)

      expect(response.body.status).toBe('success')
      expect(response.body.message).toBe('Incident reported successfully')
      expect(response.body.data).toHaveProperty('incidentId')
      expect(response.body.data.walletAddress).toBe(validIncidentData.walletAddress)
      expect(response.body.data.transactionHash).toBe(validIncidentData.transactionHash)
      expect(response.body.data.description).toBe(validIncidentData.description)

      // Verify Etherscan service was called
      expect(etherscanService.verifyTransactionExists).toHaveBeenCalledWith(
        validIncidentData.transactionHash
      )
      expect(etherscanService.getInternalTransactions).toHaveBeenCalledWith(
        validIncidentData.transactionHash
      )
    })

    it('should return validation error for invalid wallet address', async () => {
      const invalidData = {
        ...validIncidentData,
        walletAddress: 'invalid-address'
      }

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Validation failed')
      expect(response.body.errors).toHaveLength(1)
      expect(response.body.errors[0].field).toBe('walletAddress')
    })

    it('should return validation error for invalid transaction hash', async () => {
      const invalidData = {
        ...validIncidentData,
        transactionHash: 'invalid-hash'
      }

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Validation failed')
      expect(response.body.errors).toHaveLength(1)
      expect(response.body.errors[0].field).toBe('transactionHash')
    })

    it('should return validation error for short description', async () => {
      const invalidData = {
        ...validIncidentData,
        description: 'short'
      }

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidData)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Validation failed')
      expect(response.body.errors).toHaveLength(1)
      expect(response.body.errors[0].field).toBe('description')
    })

    it('should return 404 when transaction is not found', async () => {
      etherscanService.verifyTransactionExists.mockResolvedValue(false)

      const response = await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Transaction hash not found on Ethereum network')
    })

    it('should return 502 when Etherscan API fails', async () => {
      etherscanService.verifyTransactionExists.mockResolvedValue(true)
      etherscanService.getInternalTransactions.mockRejectedValue(
        new Error('API Error')
      )

      const response = await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect('Content-Type', /json/)
        .expect(502)

      expect(response.body.status).toBe('error')
      expect(response.body.message).toContain('Unable to retrieve blockchain data')
    })

    it('should handle duplicate transaction hash', async () => {
      // First submission should succeed
      await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect(201)

      // Second submission with same transaction hash should fail
      const response = await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect('Content-Type', /json/)
        .expect(409)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('This transaction has already been reported')
    })

    it('should reject requests with missing fields', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.errors).toHaveLength(3) // All three fields required
    })

    it('should sanitize and trim input fields', async () => {
      const dataWithSpaces = {
        walletAddress: '  0x1234567890123456789012345678901234567890  ',
        transactionHash: '  0x1234567890123456789012345678901234567890123456789012345678901234  ',
        description: '  Test incident description that meets the minimum length requirement.  '
      }

      const response = await request(app)
        .post('/api/incidents')
        .send(dataWithSpaces)
        .expect(201)

      expect(response.body.data.walletAddress).toBe(dataWithSpaces.walletAddress.trim())
      expect(response.body.data.transactionHash).toBe(dataWithSpaces.transactionHash.trim())
      expect(response.body.data.description).toBe(dataWithSpaces.description.trim())
    })
  })

  describe('GET /api/incidents/:id', () => {
    it('should return incident by ID', async () => {
      // First create an incident
      const createResponse = await request(app)
        .post('/api/incidents')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567890',
          transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          description: 'Test incident for retrieval'
        })
        .expect(201)

      const incidentId = createResponse.body.data.incidentId

      // Then retrieve it
      const response = await request(app)
        .get(`/api/incidents/${incidentId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toHaveProperty('incident')
      expect(response.body.data).toHaveProperty('transactionDetails')
      expect(response.body.data.incident.id).toBe(incidentId)
    })

    it('should return 404 for non-existent incident', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000'
      
      const response = await request(app)
        .get(`/api/incidents/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Incident not found')
    })

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/incidents/invalid-uuid')
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Validation failed')
    })
  })

  describe('GET /api/incidents', () => {
    beforeEach(async () => {
      // Create some test incidents
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/incidents')
          .send({
            walletAddress: '0x1234567890123456789012345678901234567890',
            transactionHash: `0x123456789012345678901234567890123456789012345678901234567890123${i}`,
            description: `Test incident ${i + 1} description that meets requirements.`
          })
      }
    })

    it('should return paginated incidents', async () => {
      const response = await request(app)
        .get('/api/incidents?limit=3&offset=0')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data).toHaveProperty('incidents')
      expect(response.body.data).toHaveProperty('pagination')
      expect(response.body.data.incidents).toHaveLength(3)
      expect(response.body.data.pagination.limit).toBe(3)
      expect(response.body.data.pagination.offset).toBe(0)
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(5)
    })

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/incidents?limit=2')
        .expect(200)

      expect(response.body.data.incidents).toHaveLength(2)
    })

    it('should reject limit greater than 100', async () => {
      const response = await request(app)
        .get('/api/incidents?limit=101')
        .expect(400)

      expect(response.body.status).toBe('fail')
      expect(response.body.message).toBe('Limit cannot exceed 100')
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = []
      
      // Make many requests quickly
      for (let i = 0; i < 105; i++) {
        requests.push(
          request(app)
            .post('/api/incidents')
            .send({
              walletAddress: '0x1234567890123456789012345678901234567890',
              transactionHash: `0x123456789012345678901234567890123456789012345678901234567890123${i}`,
              description: 'Rate limit test description that meets requirements.'
            })
        )
      }

      const responses = await Promise.allSettled(requests)
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        result => result.value?.status === 429
      )
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    }, 60000) // Increase timeout for this test
  })
})

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body.status).toBe('healthy')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('uptime')
    expect(response.body).toHaveProperty('environment')
  })
})
