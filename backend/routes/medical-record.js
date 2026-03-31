/**
 * CareAI — Medical Record Input API
 * POST /api/medical-record         — Save complete record
 * POST /api/medical-record/validate — Validate before save
 * GET  /api/lab-results/:id        — Get lab results for patient
 * GET  /api/medical-orders/:id     — Get orders for patient
 * GET  /api/vitals/:id             — Get vitals for patient
 */
const express = require('express');
const router = express.Router();
const { parsePositiveInt, route, sendJson } = require('../lib/http');
const {
  getLabResults,
  getMedicalOrders,
  getVitals,
  saveMedicalRecord,
  validateMedicalRecordField,
} = require('../services/medical-record-service');

// ─── POST /api/medical-record ─────────────────────────────────
router.post('/', route((req, res) => {
  sendJson(res, saveMedicalRecord(req.body));
}));

// ─── POST /api/medical-record/validate ────────────────────────
router.post('/validate', route((req, res) => {
  sendJson(res, validateMedicalRecordField(req.body));
}));

// ─── GET /api/lab-results/:id ─────────────────────────────────
router.get('/lab-results/:id', route((req, res) => {
  const patientId = parsePositiveInt(req.params.id, { field: 'patient id' });
  sendJson(res, { lab_results: getLabResults(patientId) });
}));

// ─── GET /api/medical-orders/:id ──────────────────────────────
router.get('/medical-orders/:id', route((req, res) => {
  const patientId = parsePositiveInt(req.params.id, { field: 'patient id' });
  sendJson(res, { orders: getMedicalOrders(patientId) });
}));

// ─── GET /api/vitals/:id ──────────────────────────────────────
router.get('/vitals/:id', route((req, res) => {
  const patientId = parsePositiveInt(req.params.id, { field: 'patient id' });
  sendJson(res, { vitals: getVitals(patientId) });
}));

module.exports = router;
