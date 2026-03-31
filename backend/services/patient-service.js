const db = require('../database');
const { countAlertsBySeverity } = require('../lib/alerts');
const { notFound } = require('../lib/http');

const PATIENT_SORT_COLUMNS = {
  name: 'p.name',
  risk: 'p.risk_level',
  alerts: 'active_alerts',
  dq: 'avg_dq_score',
  admission: 'p.admission_date',
};

const ALERT_SEVERITY_ORDER_SQL = `
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'warning' THEN 3
    WHEN 'info' THEN 4
  END
`;

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function findPatientById(patientId) {
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
}

function getPatientByIdOrThrow(patientId) {
  const patient = findPatientById(patientId);
  if (!patient) {
    throw notFound('Patient not found');
  }

  return patient;
}

function getPatientObservations(patientId, options = {}) {
  let query = 'SELECT * FROM observations WHERE patient_id = ?';
  const params = [patientId];

  if (options.type) {
    query += ' AND type = ?';
    params.push(options.type);
  }

  query += ` ORDER BY effective_date ${options.desc ? 'DESC' : 'ASC'}`;

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params);
}

function getPatientAlerts(patientId, options = {}) {
  let query = 'SELECT * FROM alerts WHERE patient_id = ?';
  const params = [patientId];

  if (options.activeOnly) {
    query += ' AND resolved = 0';
  }

  query += ` ORDER BY ${ALERT_SEVERITY_ORDER_SQL}, created_at ${options.desc === false ? 'ASC' : 'DESC'}`;

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params);
}

function getPatientNotes(patientId, options = {}) {
  let query = 'SELECT * FROM clinical_notes WHERE patient_id = ?';
  const params = [patientId];
  query += ` ORDER BY effective_date ${options.desc === false ? 'ASC' : 'DESC'}`;

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params);
}

function buildPatientSummary(observations, alerts, notes) {
  const activeAlerts = alerts.filter((alert) => !alert.resolved);
  const averageDataQuality = observations.length > 0
    ? roundToTwo(
      observations.reduce((total, observation) => total + (observation.data_quality_score || 1), 0) / observations.length
    )
    : null;

  return {
    total_observations: observations.length,
    active_alerts: activeAlerts.length,
    critical_alerts: activeAlerts.filter((alert) => alert.severity === 'critical').length,
    total_notes: notes.length,
    avg_dq_score: averageDataQuality,
    severity_counts: countAlertsBySeverity(activeAlerts),
  };
}

function listPatients(filters = {}) {
  const { search, risk, ward, sort = 'name', order = 'asc' } = filters;
  let query = `
    SELECT p.*,
      (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND a.resolved = 0) as active_alerts,
      (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND a.resolved = 0 AND a.severity = 'critical') as critical_alerts,
      (SELECT AVG(o.data_quality_score) FROM observations o WHERE o.patient_id = p.id) as avg_dq_score,
      (SELECT COUNT(*) FROM observations o WHERE o.patient_id = p.id) as observation_count
    FROM patients p
    WHERE 1 = 1
  `;
  const params = [];

  if (search) {
    query += ' AND (p.name LIKE ? OR p.medical_record_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (risk) {
    query += ' AND p.risk_level = ?';
    params.push(risk);
  }

  if (ward) {
    query += ' AND p.ward = ?';
    params.push(ward);
  }

  const sortColumn = PATIENT_SORT_COLUMNS[sort] || PATIENT_SORT_COLUMNS.name;
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
  query += ` ORDER BY ${sortColumn} ${sortOrder}`;

  const patients = db.prepare(query).all(...params);

  return {
    patients: patients.map((patient) => ({
      ...patient,
      avg_dq_score: patient.avg_dq_score !== null && patient.avg_dq_score !== undefined
        ? roundToTwo(patient.avg_dq_score)
        : null,
    })),
    total: patients.length,
  };
}

function getPatientDetail(patientId) {
  const patient = getPatientByIdOrThrow(patientId);
  const observations = getPatientObservations(patientId);
  const alerts = getPatientAlerts(patientId);
  const notes = getPatientNotes(patientId);

  return {
    patient,
    observations,
    alerts,
    notes,
    summary: buildPatientSummary(observations, alerts, notes),
  };
}

function getPatientGrowth(patientId) {
  const patient = getPatientByIdOrThrow(patientId);

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
    },
    weights: getPatientObservations(patientId, { type: 'weight' }),
    heights: getPatientObservations(patientId, { type: 'height' }),
  };
}

module.exports = {
  buildPatientSummary,
  findPatientById,
  getPatientAlerts,
  getPatientByIdOrThrow,
  getPatientDetail,
  getPatientGrowth,
  getPatientNotes,
  getPatientObservations,
  listPatients,
};