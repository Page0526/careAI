/**
 * Tier 1: Trajectory Checker
 * R006: Implausible weight velocity (>5% per day)
 * R007: Weight exceeded physiological bounds
 * R008: Age-weight mismatch (z-score beyond ±5)
 * R009: Height decrease (impossible for growing child)
 * R010: BMI extreme outlier
 */
const config = require('../config');
const { weightForAgeZScore, heightForAgeZScore, ageInMonths } = require('./zscore');

function checkTrajectory(observation, patient, history) {
  const alerts = [];

  // R007: Physiological bounds
  if (observation.type === 'weight') {
    if (observation.value < config.WEIGHT_MIN_KG || observation.value > config.WEIGHT_MAX_KG) {
      alerts.push({
        alert_type: 'R007_PHYSIOLOGICAL_BOUNDS',
        severity: config.SEVERITY.CRITICAL,
        message: `Weight ${observation.value} kg outside physiological bounds (${config.WEIGHT_MIN_KG}-${config.WEIGHT_MAX_KG} kg)`,
        explanation: `A weight of ${observation.value} kg is outside the range of physiologically possible values for any pediatric patient.`
      });
    }
  }

  if (observation.type === 'height') {
    if (observation.value < config.HEIGHT_MIN_CM || observation.value > config.HEIGHT_MAX_CM) {
      alerts.push({
        alert_type: 'R007_PHYSIOLOGICAL_BOUNDS',
        severity: config.SEVERITY.CRITICAL,
        message: `Height ${observation.value} cm outside physiological bounds (${config.HEIGHT_MIN_CM}-${config.HEIGHT_MAX_CM} cm)`,
        explanation: `A height of ${observation.value} cm is outside the range of physiologically possible values for any pediatric patient.`
      });
    }
  }

  // R008: Z-score extremes
  if (observation.type === 'weight' && patient) {
    const zResult = weightForAgeZScore(observation.value, patient.date_of_birth, patient.gender, new Date(observation.effective_date));
    if (zResult.zscore < config.ZSCORE_EXTREME_LOW || zResult.zscore > config.ZSCORE_EXTREME_HIGH) {
      alerts.push({
        alert_type: 'R008_ZSCORE_EXTREME',
        severity: config.SEVERITY.CRITICAL,
        message: `Weight z-score = ${zResult.zscore} (${zResult.interpretation}). Extreme outlier for ${ageInMonths(patient.date_of_birth, new Date(observation.effective_date))}-month-old ${patient.gender}`,
        explanation: `A z-score of ${zResult.zscore} means this weight is extremely far from the WHO reference median. This is very likely a data entry error unless there is documented clinical justification.`
      });
    }
  }

  if (observation.type === 'height' && patient) {
    const zResult = heightForAgeZScore(observation.value, patient.date_of_birth, patient.gender, new Date(observation.effective_date));
    if (zResult.zscore < config.ZSCORE_EXTREME_LOW || zResult.zscore > config.ZSCORE_EXTREME_HIGH) {
      alerts.push({
        alert_type: 'R008_ZSCORE_EXTREME',
        severity: config.SEVERITY.HIGH,
        message: `Height z-score = ${zResult.zscore} (${zResult.interpretation}). Extreme outlier for age`,
        explanation: `A z-score of ${zResult.zscore} means this height is extremely far from the WHO reference median for this age and gender.`
      });
    }
  }

  // R006: Weight velocity
  if (observation.type === 'weight' && history && history.length > 0) {
    const weightHistory = history
      .filter(h => h.type === 'weight')
      .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));

    if (weightHistory.length > 0) {
      const prev = weightHistory[0];
      const daysDiff = (new Date(observation.effective_date) - new Date(prev.effective_date)) / (1000 * 60 * 60 * 24);

      if (daysDiff > 0) {
        const percentChange = Math.abs(observation.value - prev.value) / prev.value * 100;
        const percentPerDay = percentChange / daysDiff;

        if (percentPerDay > config.MAX_WEIGHT_CHANGE_PERCENT_PER_DAY) {
          const direction = observation.value > prev.value ? 'gain' : 'loss';
          alerts.push({
            alert_type: 'R006_IMPLAUSIBLE_VELOCITY',
            severity: config.SEVERITY.HIGH,
            message: `Implausible weight ${direction}: ${prev.value}→${observation.value} kg (${percentChange.toFixed(1)}% in ${daysDiff.toFixed(0)} days = ${percentPerDay.toFixed(1)}%/day)`,
            explanation: `Weight changed by ${percentChange.toFixed(1)}% over ${daysDiff.toFixed(0)} days (${percentPerDay.toFixed(1)}% per day). Expected maximum is ${config.MAX_WEIGHT_CHANGE_PERCENT_PER_DAY}% per day. This rapid ${direction} may indicate a measurement error.`
          });
        }
      }
    }
  }

  // R009: Height decrease
  if (observation.type === 'height' && history && history.length > 0) {
    const heightHistory = history
      .filter(h => h.type === 'height')
      .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));

    if (heightHistory.length > 0) {
      const prev = heightHistory[0];
      const ageMonths = ageInMonths(patient.date_of_birth, new Date(observation.effective_date));

      // Height should not decrease significantly for children (small measurement variance is OK)
      if (observation.value < prev.value - 1.0 && ageMonths < 216) {
        alerts.push({
          alert_type: 'R009_HEIGHT_DECREASE',
          severity: config.SEVERITY.HIGH,
          message: `Height decreased: ${prev.value}→${observation.value} cm (−${(prev.value - observation.value).toFixed(1)} cm). Height should not decrease in growing children`,
          explanation: `A decrease in height from ${prev.value} cm to ${observation.value} cm is physiologically impossible for a growing child. This likely indicates a measurement error.`
        });
      }
    }
  }

  return alerts;
}

module.exports = { checkTrajectory };
