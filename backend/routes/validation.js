/**
 * Validation API Routes
 */
const express = require('express');
const router = express.Router();
const { parsePositiveInt, route, sendJson } = require('../lib/http');
const { runPatientValidation } = require('../services/validation-service');

// GET /api/validation/:patientId — run validation for a patient
router.get('/:patientId', route((req, res) => {
  const patientId = parsePositiveInt(req.params.patientId, { field: 'patient id' });
  sendJson(res, runPatientValidation(patientId));
}));

module.exports = router;
