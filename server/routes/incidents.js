const express = require('express')
const router = express.Router()

const incidentController = require('../controllers/incidentController')
const {
  validateCreateIncident,
  validateGetIncidentsByWallet,
  validateIncidentId
} = require('../middlewares/validation')

// POST /api/incidents - Create a new incident report
router.post('/', validateCreateIncident, incidentController.createIncident)

// GET /api/incidents/:id - Get incident by ID
router.get('/:id', validateIncidentId, incidentController.getIncidentById)

// GET /api/incidents/stats - Get incident statistics
router.get('/stats', incidentController.getIncidentStats)

// Graph processing endpoints
// GET /api/incidents/graph/health - Get graph service health
router.get('/graph/health', incidentController.getGraphServiceHealth)

// GET /api/incidents - Get incidents with optional filtering
router.get('/', incidentController.getIncidents)

// GET /api/incidents/wallet/:walletAddress - Get incidents by wallet address
router.get('/wallet/:walletAddress', validateGetIncidentsByWallet, incidentController.getIncidentsByWallet)

// PUT /api/incidents/:id - Update incident description (admin only in future)
router.put('/:id', validateIncidentId, incidentController.updateIncident)

// DELETE /api/incidents/:id - Delete incident (admin only in future)
router.delete('/:id', validateIncidentId, incidentController.deleteIncident)

// POST /api/incidents/:id/graph - Start graph processing for an incident
router.post('/:id/graph', validateIncidentId, incidentController.startGraphProcessing)

// GET /api/incidents/:id/graph - Get graph processing status and results
router.get('/:id/graph', validateIncidentId, incidentController.getGraphStatus)

module.exports = router
