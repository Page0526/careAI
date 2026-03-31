const db = require('../database');
const { countAlertsBySeverity, determineRiskLevel } = require('../lib/alerts');
const { todayIsoDate } = require('../lib/date');
const { badRequest } = require('../lib/http');
const { validateLabResult, crossValidateLabs, detectLabDecimalError } = require('../tier1/lab-validator');
const { validateObservation } = require('../tier1/validator');
const { heightForAgeZScore, weightForAgeZScore } = require('../tier1/zscore');
const { detectContradictions } = require('../tier2/contradiction');
const { extractSignals } = require('../tier2/nlp-engine');

const findPatientByMrnStatement = db.prepare('SELECT id FROM patients WHERE medical_record_number = ?');
const selectPatientByIdStatement = db.prepare('SELECT * FROM patients WHERE id = ?');
const selectObservationsByPatientStatement = db.prepare('SELECT * FROM observations WHERE patient_id = ? ORDER BY effective_date');
const selectNotesByPatientStatement = db.prepare('SELECT * FROM clinical_notes WHERE patient_id = ?');
const selectLabResultsByPatientStatement = db.prepare(
  'SELECT * FROM lab_results WHERE patient_id = ? ORDER BY effective_date DESC, test_category, test_name'
);
const selectMedicalOrdersByPatientStatement = db.prepare(
  'SELECT * FROM medical_orders WHERE patient_id = ? ORDER BY effective_date DESC'
);
const selectVitalsByPatientStatement = db.prepare(
  'SELECT * FROM vitals WHERE patient_id = ? ORDER BY effective_date DESC'
);

const updatePatientStatement = db.prepare(`
  UPDATE patients
  SET name = ?, date_of_birth = ?, gender = ?, ward = ?, diagnosis = ?, admission_date = ?, admission_weight_kg = ?, admission_height_cm = ?
  WHERE id = ?
`);

const insertPatientStatement = db.prepare(`
  INSERT INTO patients (
    medical_record_number,
    name,
    date_of_birth,
    gender,
    admission_date,
    ward,
    diagnosis,
    admission_weight_kg,
    admission_height_cm
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertVitalsStatement = db.prepare(`
  INSERT INTO vitals (
    patient_id,
    heart_rate,
    respiratory_rate,
    temperature,
    blood_pressure,
    spo2,
    crt,
    effective_date,
    recorded_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertObservationStatement = db.prepare(`
  INSERT INTO observations (patient_id, type, value, unit, effective_date, source)
  VALUES (?, ?, ?, ?, ?, 'manual')
`);

const updateObservationValidationStatement = db.prepare(`
  UPDATE observations
  SET zscore = ?, zscore_interpretation = ?, data_quality_score = ?
  WHERE id = ?
`);

const insertLabStatement = db.prepare(`
  INSERT INTO lab_results (
    patient_id,
    test_category,
    test_name,
    result_value,
    result_text,
    unit,
    reference_min,
    reference_max,
    is_abnormal,
    effective_date,
    ordering_doctor
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertClinicalNoteStatement = db.prepare(`
  INSERT INTO clinical_notes (patient_id, content, author, note_type, effective_date, extracted_signals)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertMedicalOrderStatement = db.prepare(`
  INSERT INTO medical_orders (patient_id, order_type, content, dosage, frequency, route, effective_date, ordering_doctor)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAlertStatement = db.prepare(`
  INSERT INTO alerts (patient_id, observation_id, tier, severity, alert_type, message, explanation)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const updateRiskLevelStatement = db.prepare('UPDATE patients SET risk_level = ? WHERE id = ?');

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function asNullableNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableString(value) {
  if (!hasValue(value)) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function buildSeveritySummary(alerts) {
  const severityCounts = countAlertsBySeverity(alerts);

  return {
    total_alerts: alerts.length,
    critical: severityCounts.critical,
    high: severityCounts.high,
    warning: severityCounts.warning,
    info: severityCounts.info,
  };
}

function upsertPatient(patient) {
  const effectiveAdmissionDate = asNullableString(patient.admission_date) || todayIsoDate();
  const admissionWeight = asNullableNumber(patient.weight) ?? asNullableNumber(patient.admission_weight_kg);
  const admissionHeight = asNullableNumber(patient.height) ?? asNullableNumber(patient.admission_height_cm);
  const existing = findPatientByMrnStatement.get(patient.medical_record_number);

  if (existing) {
    updatePatientStatement.run(
      patient.name,
      patient.date_of_birth,
      patient.gender,
      patient.ward,
      asNullableString(patient.diagnosis),
      effectiveAdmissionDate,
      admissionWeight,
      admissionHeight,
      existing.id
    );

    return {
      patientId: existing.id,
      isNew: false,
      admissionDate: effectiveAdmissionDate,
    };
  }

  const inserted = insertPatientStatement.run(
    patient.medical_record_number,
    patient.name,
    patient.date_of_birth,
    patient.gender,
    effectiveAdmissionDate,
    patient.ward,
    asNullableString(patient.diagnosis),
    admissionWeight,
    admissionHeight
  );

  return {
    patientId: inserted.lastInsertRowid,
    isNew: true,
    admissionDate: effectiveAdmissionDate,
  };
}

function insertVitals(patientId, vitals) {
  for (const vital of toArray(vitals)) {
    if (!vital) {
      continue;
    }

    const hasAnyVital = [
      vital.heart_rate,
      vital.respiratory_rate,
      vital.temperature,
      vital.blood_pressure,
      vital.spo2,
      vital.crt,
    ].some(hasValue);

    if (!hasAnyVital) {
      continue;
    }

    insertVitalsStatement.run(
      patientId,
      asNullableNumber(vital.heart_rate),
      asNullableNumber(vital.respiratory_rate),
      asNullableNumber(vital.temperature),
      asNullableString(vital.blood_pressure),
      asNullableNumber(vital.spo2),
      asNullableNumber(vital.crt),
      asNullableString(vital.effective_date) || todayIsoDate(),
      asNullableString(vital.recorded_by)
    );
  }
}

function insertAnthropometricObservations(patientId, patient, effectiveDate) {
  const insertedObservations = [];

  const candidates = [
    { type: 'weight', value: patient.weight, unit: 'kg' },
    { type: 'height', value: patient.height, unit: 'cm' },
  ];

  for (const candidate of candidates) {
    const numericValue = asNullableNumber(candidate.value);
    if (numericValue === null) {
      continue;
    }

    const inserted = insertObservationStatement.run(
      patientId,
      candidate.type,
      numericValue,
      candidate.unit,
      effectiveDate
    );

    insertedObservations.push({
      id: inserted.lastInsertRowid,
      patient_id: patientId,
      type: candidate.type,
      value: numericValue,
      unit: candidate.unit,
      effective_date: effectiveDate,
      source: 'manual',
    });
  }

  return insertedObservations;
}

function applyObservationValidation(insertedObservations, patient, observationHistory) {
  const alerts = [];

  for (const observation of insertedObservations) {
    const validationResult = validateObservation(observation, patient, observationHistory);
    updateObservationValidationStatement.run(
      validationResult.zscore ? validationResult.zscore.zscore : null,
      validationResult.zscore ? validationResult.zscore.interpretation : null,
      validationResult.data_quality_score,
      observation.id
    );

    alerts.push(...validationResult.alerts);
    observationHistory.push({
      ...observation,
      data_quality_score: validationResult.data_quality_score,
      zscore: validationResult.zscore ? validationResult.zscore.zscore : null,
      zscore_interpretation: validationResult.zscore ? validationResult.zscore.interpretation : null,
    });
  }

  return alerts;
}

function insertLabResults(patientId, labs) {
  const alerts = [];
  const normalizedLabs = [];

  for (const lab of toArray(labs)) {
    if (!lab || !lab.test_key || !lab.test_category) {
      continue;
    }

    const resultValue = asNullableNumber(lab.result_value);
    const validation = resultValue === null
      ? { is_abnormal: false, level: 'normal', message: '', ref: null }
      : validateLabResult(lab.test_key, resultValue, lab.test_category);
    const decimalCheck = resultValue === null
      ? null
      : detectLabDecimalError(lab.test_key, resultValue, lab.test_category);

    insertLabStatement.run(
      patientId,
      lab.test_category,
      asNullableString(lab.test_name) || validation.ref?.name || lab.test_key,
      resultValue,
      asNullableString(lab.result_text),
      asNullableString(lab.unit) || validation.ref?.unit || '',
      validation.ref?.min ?? null,
      validation.ref?.max ?? null,
      validation.is_abnormal ? 1 : 0,
      asNullableString(lab.effective_date) || todayIsoDate(),
      asNullableString(lab.ordering_doctor)
    );

    normalizedLabs.push({
      ...lab,
      result_value: resultValue,
    });

    if (validation.is_abnormal) {
      alerts.push({
        alert_type: `LAB_ABNORMAL_${lab.test_key.toUpperCase()}`,
        severity: validation.level === 'critical'
          ? 'critical'
          : validation.level === 'high'
            ? 'high'
            : 'warning',
        tier: 'tier1',
        message: validation.message,
        explanation: `Giá trị ngoài ngưỡng tham chiếu. CSBT: ${validation.ref?.min ?? '—'}–${validation.ref?.max ?? '—'} ${validation.ref?.unit || ''}`,
        patient_id: patientId,
      });
    }

    if (decimalCheck) {
      alerts.push({
        ...decimalCheck,
        tier: 'tier1',
        patient_id: patientId,
      });
    }
  }

  const crossAlerts = crossValidateLabs(normalizedLabs.filter((lab) => lab.result_value !== null));
  alerts.push(...crossAlerts.map((alert) => ({ ...alert, patient_id: patientId })));

  return alerts;
}

function insertClinicalNotes(patientId, notes) {
  let insertedCount = 0;

  for (const note of toArray(notes)) {
    const content = note && asNullableString(note.content);
    if (!content) {
      continue;
    }

    const signals = extractSignals(content);
    insertClinicalNoteStatement.run(
      patientId,
      content,
      asNullableString(note.author),
      asNullableString(note.note_type) || 'progress',
      asNullableString(note.effective_date) || todayIsoDate(),
      JSON.stringify(signals)
    );
    insertedCount += 1;
  }

  return insertedCount;
}

function getLatestObservationValue(observations, type, excludedObservationId) {
  const match = [...observations]
    .filter((observation) => observation.type === type && observation.id !== excludedObservationId)
    .sort((left, right) => new Date(right.effective_date) - new Date(left.effective_date))[0];

  return match ? match.value : undefined;
}

function appendContradictionAlerts(patientId, patient, insertedObservations, observationHistory, alerts) {
  const notes = selectNotesByPatientStatement.all(patientId);
  if (notes.length === 0) {
    return;
  }

  for (const observation of insertedObservations) {
    if (observation.type !== 'weight') {
      continue;
    }

    const contradictions = detectContradictions(
      {
        ...observation,
        _prev_value: getLatestObservationValue(observationHistory, 'weight', observation.id),
      },
      patient,
      notes
    );

    alerts.push(...contradictions);
  }
}

function insertMedicalOrders(patientId, orders) {
  for (const order of toArray(orders)) {
    if (!order || !hasValue(order.order_type) || !hasValue(order.content)) {
      continue;
    }

    insertMedicalOrderStatement.run(
      patientId,
      order.order_type,
      order.content,
      asNullableString(order.dosage),
      asNullableString(order.frequency),
      asNullableString(order.route),
      asNullableString(order.effective_date) || todayIsoDate(),
      asNullableString(order.ordering_doctor)
    );
  }
}

function persistAlerts(patientId, alerts) {
  for (const alert of alerts) {
    insertAlertStatement.run(
      alert.patient_id || patientId,
      alert.observation_id || null,
      alert.tier || 'tier1',
      alert.severity,
      alert.alert_type,
      alert.message,
      alert.explanation || null
    );
  }
}

const saveMedicalRecordTransaction = db.transaction((payload) => {
  const { patient, vitals, labs, notes, orders } = payload;
  const { patientId, isNew, admissionDate } = upsertPatient(patient);
  const patientRow = selectPatientByIdStatement.get(patientId);
  const observationHistory = selectObservationsByPatientStatement.all(patientId);
  const allAlerts = [];

  insertVitals(patientId, vitals);

  const insertedObservations = insertAnthropometricObservations(patientId, patient, admissionDate);
  allAlerts.push(...applyObservationValidation(insertedObservations, patientRow, observationHistory));
  allAlerts.push(...insertLabResults(patientId, labs));

  const insertedNotes = insertClinicalNotes(patientId, notes);
  if (insertedNotes > 0) {
    appendContradictionAlerts(patientId, patientRow, insertedObservations, observationHistory, allAlerts);
  }

  insertMedicalOrders(patientId, orders);
  persistAlerts(patientId, allAlerts);

  const riskLevel = determineRiskLevel(allAlerts);
  updateRiskLevelStatement.run(riskLevel, patientId);

  return {
    success: true,
    patient_id: patientId,
    is_new: isNew,
    risk_level: riskLevel,
    alerts: allAlerts,
    summary: buildSeveritySummary(allAlerts),
  };
});

function saveMedicalRecord(payload = {}) {
  const patient = payload.patient;
  if (!patient || !hasValue(patient.name) || !hasValue(patient.medical_record_number)) {
    throw badRequest('Thiếu thông tin bệnh nhân (tên, mã y tế)');
  }

  return saveMedicalRecordTransaction(payload);
}

function validateMedicalRecordField(payload = {}) {
  const { field, value, patient, category, test_key: testKey } = payload;
  const numericValue = asNullableNumber(value);
  const result = {};

  if (field === 'lab' && testKey && category && numericValue !== null) {
    result.validation = validateLabResult(testKey, numericValue, category);
    result.decimal_check = detectLabDecimalError(testKey, numericValue, category);
  }

  if (field === 'weight' && numericValue !== null && patient) {
    result.zscore = weightForAgeZScore(numericValue, patient.date_of_birth, patient.gender);
  }

  if (field === 'height' && numericValue !== null && patient) {
    result.zscore = heightForAgeZScore(numericValue, patient.date_of_birth, patient.gender);
  }

  return result;
}

function getLabResults(patientId) {
  return selectLabResultsByPatientStatement.all(patientId);
}

function getMedicalOrders(patientId) {
  return selectMedicalOrdersByPatientStatement.all(patientId);
}

function getVitals(patientId) {
  return selectVitalsByPatientStatement.all(patientId);
}

module.exports = {
  getLabResults,
  getMedicalOrders,
  getVitals,
  saveMedicalRecord,
  validateMedicalRecordField,
};