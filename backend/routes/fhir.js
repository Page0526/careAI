/**
 * FHIR Export API Routes
 */
const express = require('express');
const router = express.Router();
const { parsePositiveInt, route, sendJson } = require('../lib/http');
const { generateBundle, getDownloadBundle } = require('../services/fhir-service');

// GET /api/fhir/:patientId — generate FHIR bundle for a patient
router.get('/:patientId', route((req, res) => {
  const patientId = parsePositiveInt(req.params.patientId, { field: 'patient id' });
  sendJson(res, generateBundle(patientId, { minDataQuality: req.query.min_dq }));
}));

// GET /api/fhir/:patientId/download — download FHIR bundle as file
router.get('/:patientId/download', route((req, res) => {
  const patientId = parsePositiveInt(req.params.patientId, { field: 'patient id' });
  const { patient, bundle } = getDownloadBundle(patientId);
  res.setHeader('Content-Disposition', `attachment; filename="fhir-bundle-${patient.medical_record_number}.json"`);
  res.setHeader('Content-Type', 'application/fhir+json');
  res.json(bundle);
}));

module.exports = router;
