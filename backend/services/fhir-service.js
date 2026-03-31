const db = require('../database');
const { assembleFHIRBundle } = require('../tier3/fhir-bundle');
const { getPatientByIdOrThrow, getPatientObservations } = require('./patient-service');

const selectExistingExportStatement = db.prepare(
  'SELECT id FROM fhir_exports WHERE patient_id = ? AND resource_type = ?'
);
const updateExportStatement = db.prepare(
  "UPDATE fhir_exports SET fhir_json = ?, created_at = datetime('now') WHERE id = ?"
);
const insertExportStatement = db.prepare(
  'INSERT INTO fhir_exports (patient_id, resource_type, fhir_json) VALUES (?, ?, ?)'
);

function clampMinDataQuality(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, parsed));
}

function persistBundle(patientId, bundle) {
  const existing = selectExistingExportStatement.get(patientId, 'Bundle');

  if (existing) {
    updateExportStatement.run(JSON.stringify(bundle), existing.id);
    return;
  }

  insertExportStatement.run(patientId, 'Bundle', JSON.stringify(bundle));
}

function generateBundle(patientId, options = {}) {
  const patient = getPatientByIdOrThrow(patientId);
  const observations = getPatientObservations(patientId);
  const minDataQuality = clampMinDataQuality(options.minDataQuality);
  const bundle = assembleFHIRBundle(patient, observations, { minDataQuality });

  persistBundle(patient.id, bundle);

  return bundle;
}

function getDownloadBundle(patientId) {
  const patient = getPatientByIdOrThrow(patientId);
  const observations = getPatientObservations(patientId);

  return {
    patient,
    bundle: assembleFHIRBundle(patient, observations),
  };
}

module.exports = {
  generateBundle,
  getDownloadBundle,
};