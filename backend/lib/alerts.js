const DEFAULT_SEVERITY_COUNTS = Object.freeze({
  critical: 0,
  high: 0,
  warning: 0,
  info: 0,
});

function countAlertsBySeverity(alerts = []) {
  const counts = { ...DEFAULT_SEVERITY_COUNTS };

  for (const alert of alerts) {
    if (alert && alert.severity && Object.hasOwn(counts, alert.severity)) {
      counts[alert.severity] += 1;
    }
  }

  return counts;
}

function determineRiskLevel(alerts = []) {
  const counts = countAlertsBySeverity(alerts);

  if (counts.critical > 0 || counts.high > 2) {
    return 'critical';
  }

  if (counts.high > 0) {
    return 'high';
  }

  if (counts.warning > 0) {
    return 'moderate';
  }

  return 'low';
}

module.exports = {
  countAlertsBySeverity,
  determineRiskLevel,
};