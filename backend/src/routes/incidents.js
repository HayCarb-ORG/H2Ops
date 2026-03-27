// Incident routes
const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/Incidentcontroller');

router.get('/', incidentController.getIncidents);
router.post('/', incidentController.createIncident);
router.delete('/:id', incidentController.deleteIncident);

module.exports = router;
