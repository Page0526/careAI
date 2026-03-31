/**
 * Database Seeder
 * Seeds the database with synthetic patient data and runs validation
 */
const db = require('../database');
const { generateAllPatients } = require('./synthetic-generator');
const { validatePatient } = require('../tier1/validator');
const { extractSignals } = require('../tier2/nlp-engine');
const { detectContradictions } = require('../tier2/contradiction');
const { weightForAgeZScore, heightForAgeZScore } = require('../tier1/zscore');

function seed() {
  console.log('🌱 Seeding CareAI database...\n');

  // Clear existing data
  db.exec('DELETE FROM fhir_exports');
  db.exec('DELETE FROM alerts');
  db.exec('DELETE FROM clinical_notes');
  db.exec('DELETE FROM observations');
  db.exec('DELETE FROM patients');

  const { patients, observations, notes } = generateAllPatients();

  // Insert patients
  const insertPatient = db.prepare(`
    INSERT INTO patients (medical_record_number, name, date_of_birth, gender, admission_date, ward, diagnosis, admission_weight_kg, admission_height_cm, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const patientIds = {};
  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    const result = insertPatient.run(p.medical_record_number, p.name, p.date_of_birth, p.gender, p.admission_date, p.ward, p.diagnosis, p.admission_weight_kg, p.admission_height_cm, p.risk_level);
    patientIds[i] = result.lastInsertRowid;
  }
  console.log(`✅ Inserted ${patients.length} patients`);

  // Insert observations with z-scores
  const insertObs = db.prepare(`
    INSERT INTO observations (patient_id, type, value, unit, effective_date, source, zscore, zscore_interpretation, data_quality_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let obsCount = 0;
  for (const obs of observations) {
    const patientId = patientIds[obs.patient_index];
    const patient = patients[obs.patient_index];

    // Calculate z-score
    let zscore = null, interpretation = null;
    try {
      if (obs.type === 'weight') {
        const result = weightForAgeZScore(obs.value, patient.date_of_birth, patient.gender, new Date(obs.effective_date));
        zscore = result.zscore;
        interpretation = result.interpretation;
      } else if (obs.type === 'height') {
        const result = heightForAgeZScore(obs.value, patient.date_of_birth, patient.gender, new Date(obs.effective_date));
        zscore = result.zscore;
        interpretation = result.interpretation;
      }
    } catch { /* skip z-score on error */ }

    insertObs.run(patientId, obs.type, obs.value, obs.unit, obs.effective_date, obs.source, zscore, interpretation, 1.0);
    obsCount++;
  }
  console.log(`✅ Inserted ${obsCount} observations`);

  // Insert clinical notes with NLP extraction
  const insertNote = db.prepare(`
    INSERT INTO clinical_notes (patient_id, content, author, note_type, effective_date, extracted_signals)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let noteCount = 0;
  for (const note of notes) {
    const patientId = patientIds[note.patient_index];
    const signals = extractSignals(note.content);
    insertNote.run(patientId, note.content, note.author, note.note_type, note.effective_date, JSON.stringify(signals));
    noteCount++;
  }
  console.log(`✅ Inserted ${noteCount} clinical notes (NLP extracted)`);

  // Run Tier 1 validation and save alerts
  const insertAlert = db.prepare(`
    INSERT INTO alerts (patient_id, observation_id, tier, severity, alert_type, message, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let alertCount = 0;
  for (let i = 0; i < patients.length; i++) {
    const patientId = patientIds[i];
    const patient = { ...patients[i], id: patientId };
    const patientObs = db.prepare('SELECT * FROM observations WHERE patient_id = ? ORDER BY effective_date').all(patientId);

    // Tier 1 validation
    const tier1Result = validatePatient(patient, patientObs);
    for (const obsResult of tier1Result.observations) {
      // Update data quality score
      db.prepare('UPDATE observations SET data_quality_score = ? WHERE id = ?').run(obsResult.data_quality_score, obsResult.observation_id);

      for (const alert of obsResult.alerts) {
        insertAlert.run(patientId, obsResult.observation_id, 'tier1', alert.severity, alert.alert_type, alert.message, alert.explanation || null);
        alertCount++;
      }
    }

    // Tier 2 contradiction detection
    const patientNotes = db.prepare('SELECT * FROM clinical_notes WHERE patient_id = ?').all(patientId);
    const sortedObs = patientObs.sort((a, b) => new Date(a.effective_date) - new Date(b.effective_date));

    for (let j = 1; j < sortedObs.length; j++) {
      const obs = { ...sortedObs[j], _prev_value: sortedObs[j - 1].type === sortedObs[j].type ? sortedObs[j - 1].value : undefined };
      const contradictions = detectContradictions(obs, patient, patientNotes);
      for (const alert of contradictions) {
        insertAlert.run(patientId, obs.id, 'tier2', alert.severity, alert.alert_type, alert.message, alert.explanation || null);
        alertCount++;
      }
    }
  }
  console.log(`✅ Generated ${alertCount} validation alerts (Tier 1 + Tier 2)`);

  // Update risk levels based on alerts
  const updateRisk = db.prepare('UPDATE patients SET risk_level = ? WHERE id = ?');
  for (let i = 0; i < patients.length; i++) {
    const patientId = patientIds[i];
    const alerts = db.prepare('SELECT severity FROM alerts WHERE patient_id = ?').all(patientId);
    const critCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;

    let risk = 'low';
    if (critCount > 0) risk = 'critical';
    else if (highCount > 1) risk = 'high';
    else if (highCount > 0 || alerts.length > 2) risk = 'moderate';

    updateRisk.run(risk, patientId);
  }

  console.log(`\n🏥 Database seeded successfully!`);
  console.log(`   ${patients.length} patients | ${obsCount} observations | ${noteCount} notes | ${alertCount} alerts`);
}

// Run if called directly
if (require.main === module) {
  seed();
  process.exit(0);
}

module.exports = { seed };
