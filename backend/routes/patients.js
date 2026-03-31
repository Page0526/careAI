/**
 * Patients API Routes
 */
const express = require('express');
const router = express.Router();
const { parsePositiveInt, route, sendJson } = require('../lib/http');
const { getPatientDetail, getPatientGrowth, listPatients } = require('../services/patient-service');

// GET /api/patients — list all patients
router.get('/', route((req, res) => {
  sendJson(res, listPatients(req.query));
}));

// GET /api/patients/:id — single patient with full data
router.get('/:id', route((req, res) => {
  const patientId = parsePositiveInt(req.params.id, { field: 'patient id' });
  sendJson(res, getPatientDetail(patientId));
}));

// GET /api/patients/:id/growth — growth chart data
router.get('/:id/growth', route((req, res) => {
  const patientId = parsePositiveInt(req.params.id, { field: 'patient id' });
  sendJson(res, getPatientGrowth(patientId));
}));

module.exports = router;
