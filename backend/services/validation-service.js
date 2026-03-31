const { countAlertsBySeverity } = require('../lib/alerts');
const { safeParseJson } = require('../lib/json');
const { validatePatient } = require('../tier1/validator');
const { detectContradictions } = require('../tier2/contradiction');
const { extractSignals } = require('../tier2/nlp-engine');
const { getPatientByIdOrThrow, getPatientNotes, getPatientObservations } = require('./patient-service');

function buildTier2Alerts(patient, observations, notes) {
  const alerts = [];
  const sortedObservations = [...observations].sort(
    (left, right) => new Date(left.effective_date) - new Date(right.effective_date)
  );

  for (let index = 1; index < sortedObservations.length; index += 1) {
    const currentObservation = sortedObservations[index];
    const previousObservation = sortedObservations[index - 1];
    const observationWithHistory = {
      ...currentObservation,
      _prev_value: previousObservation.type === currentObservation.type ? previousObservation.value : undefined,
    };

    alerts.push(...detectContradictions(observationWithHistory, patient, notes));
  }

  return alerts;
}

function buildNoteAnalysis(notes) {
  return notes.map((note) => ({
    note_id: note.id,
    effective_date: note.effective_date,
    note_type: note.note_type,
    signals: safeParseJson(note.extracted_signals) || extractSignals(note.content),
  }));
}

function runPatientValidation(patientId) {
  const patient = getPatientByIdOrThrow(patientId);
  const observations = getPatientObservations(patientId);
  const notes = getPatientNotes(patientId, { desc: false });
  const tier1Result = validatePatient(patient, observations);
  const tier2Alerts = buildTier2Alerts(patient, observations, notes);
  const tier2Counts = countAlertsBySeverity(tier2Alerts);

  return {
    patient_id: patient.id,
    patient_name: patient.name,
    tier1: tier1Result,
    tier2: {
      alerts: tier2Alerts,
      total: tier2Alerts.length,
    },
    note_analysis: buildNoteAnalysis(notes),
    combined_summary: {
      total_alerts: tier1Result.summary.total_alerts + tier2Alerts.length,
      tier1_alerts: tier1Result.summary.total_alerts,
      tier2_alerts: tier2Alerts.length,
      average_data_quality: tier1Result.summary.average_data_quality,
      severity_counts: {
        critical: tier1Result.summary.severity_counts.critical + tier2Counts.critical,
        high: tier1Result.summary.severity_counts.high + tier2Counts.high,
        warning: tier1Result.summary.severity_counts.warning + tier2Counts.warning,
        info: tier1Result.summary.severity_counts.info + tier2Counts.info,
      },
    },
  };
}

module.exports = { runPatientValidation };