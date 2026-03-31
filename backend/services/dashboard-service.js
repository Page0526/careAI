const db = require('../database');

function rowsToDistribution(rows, keyField) {
  return rows.reduce((distribution, row) => {
    distribution[row[keyField]] = row.count;
    return distribution;
  }, {});
}

function roundToTwo(value) {
  return Math.round((value || 0) * 100) / 100;
}

function getDashboardStats() {
  const totalPatients = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
  const totalObservations = db.prepare('SELECT COUNT(*) as count FROM observations').get().count;
  const totalAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE resolved = 0').get().count;
  const totalNotes = db.prepare('SELECT COUNT(*) as count FROM clinical_notes').get().count;
  const averageDataQuality = db.prepare('SELECT AVG(data_quality_score) as avg FROM observations').get().avg;

  const severityCounts = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM alerts
    WHERE resolved = 0
    GROUP BY severity
  `).all();

  const riskCounts = db.prepare(`
    SELECT risk_level, COUNT(*) as count
    FROM patients
    GROUP BY risk_level
  `).all();

  const wardCounts = db.prepare(`
    SELECT ward, COUNT(*) as count
    FROM patients
    GROUP BY ward
  `).all();

  const alertTrend = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM alerts
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all();

  const alertTypes = db.prepare(`
    SELECT alert_type, COUNT(*) as count
    FROM alerts
    WHERE resolved = 0
    GROUP BY alert_type
    ORDER BY count DESC
    LIMIT 10
  `).all();

  return {
    summary: {
      total_patients: totalPatients,
      total_observations: totalObservations,
      active_alerts: totalAlerts,
      total_notes: totalNotes,
      avg_data_quality: roundToTwo(averageDataQuality),
    },
    severity_distribution: rowsToDistribution(severityCounts, 'severity'),
    risk_distribution: rowsToDistribution(riskCounts, 'risk_level'),
    ward_distribution: wardCounts,
    alert_trend: alertTrend,
    alert_types: alertTypes,
  };
}

function getRecentAlerts(limit = 20) {
  return db.prepare(`
    SELECT a.*, p.name as patient_name, p.medical_record_number
    FROM alerts a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.resolved = 0
    ORDER BY
      CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
      END,
      a.created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  getDashboardStats,
  getRecentAlerts,
};