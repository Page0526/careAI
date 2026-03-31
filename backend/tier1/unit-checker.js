/**
 * Tier 1: Unit Checker
 * R001: Possible kg↔lb confusion
 * R002: Possible cm↔m or cm↔mm confusion
 */
const config = require('../config');

function checkUnitConfusion(observation, patient) {
  const alerts = [];

  if (observation.type === 'weight') {
    // R001: Check if value makes more sense in pounds
    const valueAsKg = observation.value;

    // If the kg value seems too high for age, maybe it's actually in pounds
    if (observation.unit === 'kg') {
      // A weight in pounds entered as kg would be ~2.2x too high
      const expectedMax = getExpectedWeightRange(patient).max;

      if (valueAsKg > expectedMax * 1.8 && valueAsKg * config.LB_TO_KG <= expectedMax) {
        alerts.push({
          alert_type: 'R001_UNIT_KG_LB',
          severity: config.SEVERITY.HIGH,
          message: `Weight ${valueAsKg} kg seems too high. Possible lb→kg confusion? ${valueAsKg} lb ≈ ${(valueAsKg * config.LB_TO_KG).toFixed(1)} kg`,
          explanation: `The recorded weight of ${valueAsKg} kg exceeds expected range. If this value is actually in pounds, the converted weight of ${(valueAsKg * config.LB_TO_KG).toFixed(1)} kg would be within normal range.`,
          suggested_value: Math.round(valueAsKg * config.LB_TO_KG * 10) / 10
        });
      }
    }
  }

  if (observation.type === 'height') {
    const value = observation.value;

    // R002: cm↔m confusion
    if (observation.unit === 'cm') {
      // If entered in meters but recorded as cm (e.g., 1.2 cm instead of 120 cm)
      if (value < 10 && value * config.M_TO_CM >= config.HEIGHT_MIN_CM) {
        alerts.push({
          alert_type: 'R002_UNIT_CM_M',
          severity: config.SEVERITY.HIGH,
          message: `Height ${value} cm seems too low. Possible m→cm confusion? ${value} m = ${value * config.M_TO_CM} cm`,
          explanation: `Height of ${value} cm is implausibly low. If this value is actually in meters, ${value * config.M_TO_CM} cm would be within normal range.`,
          suggested_value: value * config.M_TO_CM
        });
      }

      // If entered in mm but recorded as cm
      if (value > config.HEIGHT_MAX_CM && value / 10 >= config.HEIGHT_MIN_CM && value / 10 <= config.HEIGHT_MAX_CM) {
        alerts.push({
          alert_type: 'R002_UNIT_CM_MM',
          severity: config.SEVERITY.WARNING,
          message: `Height ${value} cm seems too high. Possible mm→cm confusion? ${value} mm = ${value / 10} cm`,
          explanation: `Height of ${value} cm exceeds physiological limits. If this value is in mm, ${value / 10} cm would be within normal range.`,
          suggested_value: value / 10
        });
      }
    }
  }

  return alerts;
}

function getExpectedWeightRange(patient) {
  const { ageInMonths } = require('./zscore');
  const months = ageInMonths(patient.date_of_birth);

  // Rough expected weight range by age (kg)
  const ranges = [
    { maxAge: 1, min: 2.5, max: 5 },
    { maxAge: 6, min: 4, max: 10 },
    { maxAge: 12, min: 6, max: 13 },
    { maxAge: 24, min: 8, max: 18 },
    { maxAge: 60, min: 10, max: 30 },
    { maxAge: 120, min: 15, max: 55 },
    { maxAge: 168, min: 25, max: 80 },
    { maxAge: 216, min: 35, max: 120 },
    { maxAge: Infinity, min: 40, max: 150 }
  ];

  for (const r of ranges) {
    if (months <= r.maxAge) return r;
  }
  return ranges[ranges.length - 1];
}

module.exports = { checkUnitConfusion };
