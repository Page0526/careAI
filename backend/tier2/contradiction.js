/**
 * Tier 2: Contradiction Detection
 * 5 rules matching structured data signals with clinical note signals
 */
const config = require('../config');
const { extractSignals } = require('./nlp-engine');

/**
 * Detect contradictions between observation data and clinical notes
 */
function detectContradictions(observation, patient, notes) {
  const alerts = [];

  if (!notes || notes.length === 0) return alerts;

  // Get recent notes (within 3 days of observation)
  const obsDate = new Date(observation.effective_date);
  const relevantNotes = notes.filter(n => {
    const noteDate = new Date(n.effective_date);
    const daysDiff = Math.abs((obsDate - noteDate) / (1000 * 60 * 60 * 24));
    return daysDiff <= 3;
  });

  if (relevantNotes.length === 0) return alerts;

  // Extract signals from each note
  const allSignals = [];
  for (const note of relevantNotes) {
    const extracted = note.extracted_signals
      ? (typeof note.extracted_signals === 'string' ? JSON.parse(note.extracted_signals) : note.extracted_signals)
      : extractSignals(note.content);
    allSignals.push(...(extracted.signals || extracted.categories || []));
  }

  if (observation.type !== 'weight') return alerts;

  // Get previous weight to determine direction of change
  // (This would typically come from observation history, but we work with what we have)
  const prevWeight = observation._prev_value; // injected by caller

  if (prevWeight !== undefined && prevWeight !== null) {
    const weightChange = observation.value - prevWeight;
    const isGaining = weightChange > 0.1;
    const isLosing = weightChange < -0.1;

    // C001: Weight gain + edema signals → expected, lower severity
    // C002: Weight gain + NO edema but edema-like gain → flag for clinical review
    const hasEdema = allSignals.some(s => s.category === 'edema');
    const hasPoorIntake = allSignals.some(s => s.category === 'poor_intake');
    const hasVomiting = allSignals.some(s => s.category === 'vomiting');
    const hasDiuretics = allSignals.some(s => s.category === 'diuretics');
    const hasGrowthConcern = allSignals.some(s => s.category === 'growth_concern');

    // C001: Weight GAIN + Poor Intake/Vomiting documented
    if (isGaining && (hasPoorIntake || hasVomiting)) {
      alerts.push({
        alert_type: 'C001_GAIN_VS_POOR_INTAKE',
        severity: config.SEVERITY.HIGH,
        tier: 'tier2',
        message: `Weight gain (+${weightChange.toFixed(1)} kg) contradicts documented ${hasPoorIntake ? 'poor oral intake' : 'vomiting'} in clinical notes`,
        explanation: `Clinical notes document ${hasPoorIntake ? 'poor oral intake' : 'vomiting/GI losses'}, but the patient's weight increased by ${weightChange.toFixed(1)} kg. This may indicate: (1) weight gain is due to fluid retention, not nutritional improvement; (2) measurement error; or (3) notes are outdated.`
      });
    }

    // C002: Weight GAIN + Edema → contextualize (not a data error, but clinical flag)
    if (isGaining && hasEdema) {
      alerts.push({
        alert_type: 'C002_GAIN_WITH_EDEMA',
        severity: config.SEVERITY.WARNING,
        tier: 'tier2',
        message: `Weight gain (+${weightChange.toFixed(1)} kg) with documented edema — weight may reflect fluid retention, not true growth`,
        explanation: `Edema is documented in clinical notes. The weight gain of ${weightChange.toFixed(1)} kg may be partially or fully attributable to fluid retention rather than true nutritional weight gain. Consider dry weight estimation for nutrition assessment.`
      });
    }

    // C003: Weight LOSS + IV fluids/TPN → unexpected
    if (isLosing && allSignals.some(s => s.category === 'iv_fluids')) {
      alerts.push({
        alert_type: 'C003_LOSS_VS_IV_FLUIDS',
        severity: config.SEVERITY.WARNING,
        tier: 'tier2',
        message: `Weight loss (${weightChange.toFixed(1)} kg) despite documented IV fluid/TPN administration`,
        explanation: `Clinical notes document IV fluid or TPN administration, yet the patient's weight decreased by ${Math.abs(weightChange).toFixed(1)} kg. This may indicate: (1) inadequate fluid replacement; (2) significant GI or urinary losses; or (3) measurement inconsistency.`
      });
    }

    // C004: Weight LOSS + Diuretics → expected, contextualize
    if (isLosing && hasDiuretics) {
      alerts.push({
        alert_type: 'C004_LOSS_WITH_DIURETICS',
        severity: config.SEVERITY.INFO,
        tier: 'tier2',
        message: `Weight loss (${weightChange.toFixed(1)} kg) is consistent with documented diuretic therapy`,
        explanation: `Diuretic therapy is documented. The weight loss of ${Math.abs(weightChange).toFixed(1)} kg is likely due to fluid mobilization and may not represent true tissue loss.`
      });
    }

    // C005: Growth concern + no recent nutrition assessment
    if (hasGrowthConcern && isLosing) {
      alerts.push({
        alert_type: 'C005_GROWTH_CONCERN_CONFIRMED',
        severity: config.SEVERITY.HIGH,
        tier: 'tier2',
        message: `Weight loss confirmed with documented growth concern (${allSignals.filter(s => s.category === 'growth_concern').map(s => s.keywords?.join(', ')).join('; ')})`,
        explanation: `Clinical notes document growth concerns and weight loss is confirmed by the data. Immediate nutrition assessment and intervention may be warranted.`
      });
    }
  }

  return alerts.map(a => ({ ...a, patient_id: patient?.id, observation_id: observation.id }));
}

module.exports = { detectContradictions };
