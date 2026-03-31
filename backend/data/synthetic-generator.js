/**
 * Synthetic Data Generator
 * Generates 28 pediatric patients across 8 clinical scenarios
 * with Vietnamese names and realistic anthropometric data
 */
// Vietnamese names
const FIRST_NAMES_MALE = ['Minh', 'Đức', 'Hùng', 'Anh', 'Khoa', 'Long', 'Phúc', 'Bảo', 'Quang', 'Nam', 'Thịnh', 'Tuấn', 'Vinh', 'Dũng'];
const FIRST_NAMES_FEMALE = ['Linh', 'Mai', 'Hương', 'Ngọc', 'Trang', 'Thảo', 'Hà', 'Lan', 'Yến', 'Chi', 'Thủy', 'Phương', 'Oanh', 'Hạnh'];
const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];

const WARDS = ['PICU', 'Nhi Tổng hợp', 'Nhi Tiêu hóa', 'Nhi Dinh dưỡng', 'Sơ sinh'];
const DIAGNOSES = [
  'Pneumonia', 'Acute gastroenteritis', 'Nephrotic syndrome', 'Type 1 Diabetes',
  'Failure to thrive', 'Post-cardiac surgery', 'Severe acute malnutrition',
  'Cerebral palsy with feeding difficulties', 'Inflammatory bowel disease',
  'Preterm infant', 'Cystic fibrosis', 'Oncology (ALL)', 'Liver disease',
  'Renal failure', 'Bronchiolitis'
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function dateOffsetDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generatePatientName(gender) {
  const lastName = randomFrom(LAST_NAMES);
  const middleName = gender === 'male' ? randomFrom(['Văn', 'Minh', 'Hoàng', 'Quốc']) : randomFrom(['Thị', 'Thanh', 'Xuân', 'Kim']);
  const firstName = gender === 'male' ? randomFrom(FIRST_NAMES_MALE) : randomFrom(FIRST_NAMES_FEMALE);
  return `${lastName} ${middleName} ${firstName}`;
}

function generateDOB(ageMonthsTarget) {
  const now = new Date();
  const dob = new Date(now.getFullYear(), now.getMonth() - ageMonthsTarget, 1 + Math.floor(Math.random() * 28));
  return dob.toISOString().split('T')[0];
}

function generateMRN(index) {
  return `MRN-${String(index + 1001).padStart(6, '0')}`;
}

/**
 * Generate synthetic data for all 8 scenario groups
 */
function generateAllPatients() {
  const patients = [];
  const observations = [];
  const notes = [];
  let patientIndex = 0;

  // Scenario 1: Normal growth (4 patients)
  for (let i = 0; i < 4; i++) {
    const gender = i % 2 === 0 ? 'male' : 'female';
    const ageMonths = [6, 18, 48, 96][i];
    const result = generateScenario1_Normal(patientIndex, gender, ageMonths);
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 2: Unit confusion errors (3 patients)
  for (let i = 0; i < 3; i++) {
    const gender = i % 2 === 0 ? 'male' : 'female';
    const result = generateScenario2_UnitErrors(patientIndex, gender);
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 3: Decimal errors (3 patients)
  for (let i = 0; i < 3; i++) {
    const result = generateScenario3_DecimalErrors(patientIndex, i % 2 === 0 ? 'female' : 'male');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 4: Carried-forward values (3 patients)
  for (let i = 0; i < 3; i++) {
    const result = generateScenario4_CarriedForward(patientIndex, i % 2 === 0 ? 'male' : 'female');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 5: Edema + weight gain (3 patients)
  for (let i = 0; i < 3; i++) {
    const result = generateScenario5_Edema(patientIndex, i % 2 === 0 ? 'female' : 'male');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 6: Poor intake + contradiction (3 patients)
  for (let i = 0; i < 3; i++) {
    const result = generateScenario6_PoorIntake(patientIndex, i % 2 === 0 ? 'male' : 'female');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 7: Severe malnutrition (3 patients)
  for (let i = 0; i < 3; i++) {
    const result = generateScenario7_Malnutrition(patientIndex, i % 2 === 0 ? 'female' : 'male');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  // Scenario 8: Mixed issues (6 patients)
  for (let i = 0; i < 6; i++) {
    const result = generateScenario8_Mixed(patientIndex, i % 2 === 0 ? 'male' : 'female');
    patients.push(result.patient);
    observations.push(...result.observations);
    notes.push(...result.notes);
    patientIndex++;
  }

  return { patients, observations, notes };
}

// ── Scenario Generators ──

function generateScenario1_Normal(index, gender, ageMonths) {
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -10);
  const medianWeights = { 6: gender === 'male' ? 7.9 : 7.3, 18: gender === 'male' ? 10.9 : 10.2, 48: gender === 'male' ? 16.3 : 16.0, 96: gender === 'male' ? 25.3 : 25.1 };
  const baseWeight = medianWeights[ageMonths] || 12;
  const medianHeights = { 6: gender === 'male' ? 67.6 : 65.7, 18: gender === 'male' ? 82.2 : 80.5, 48: gender === 'male' ? 102.5 : 101.5, 96: gender === 'male' ? 127 : 127 };
  const baseHeight = medianHeights[ageMonths] || 80;

  const patient = {
    medical_record_number: generateMRN(index),
    name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: 'Routine assessment', admission_weight_kg: baseWeight, admission_height_cm: baseHeight, risk_level: 'low'
  };

  const obs = [];
  for (let d = 0; d < 7; d++) {
    obs.push({ patient_index: index, type: 'weight', value: Math.round((baseWeight + d * 0.02 + randomBetween(-0.1, 0.1)) * 10) / 10, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
    if (d === 0 || d === 6) {
      obs.push({ patient_index: index, type: 'height', value: Math.round((baseHeight + d * 0.05) * 10) / 10, unit: 'cm', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
    }
  }

  const noteTexts = [
    `Admission assessment. Child appears well-nourished, active. Weight ${baseWeight} kg, height ${baseHeight} cm. Normal growth parameters. Regular diet tolerated well. Appetite good.`,
    `Progress note day 3. Patient tolerating diet well, eating approximately 80% of meals. No vomiting or diarrhea. Weight stable. Continue current nutrition plan.`,
    `Progress note day 6. Ready for discharge. Adequate oral intake, weight stable at ~${baseWeight} kg. Follow-up in 2 weeks for growth monitoring.`
  ];
  const notesList = noteTexts.map((t, i) => ({
    patient_index: index, content: t, author: 'Dr. ' + randomFrom(LAST_NAMES),
    note_type: i === 0 ? 'admission' : 'progress', effective_date: dateOffsetDays(admDate, i * 3)
  }));

  return { patient, observations: obs, notes: notesList };
}

function generateScenario2_UnitErrors(index, gender) {
  const ageMonths = Math.floor(randomBetween(12, 84));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -8);
  const trueWeight = ageMonths < 24 ? randomBetween(8, 14) : ageMonths < 60 ? randomBetween(12, 22) : randomBetween(18, 35);
  const trueHeight = ageMonths < 24 ? randomBetween(70, 90) : ageMonths < 60 ? randomBetween(90, 115) : randomBetween(110, 140);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: randomFrom(DIAGNOSES), admission_weight_kg: Math.round(trueWeight * 10) / 10,
    admission_height_cm: Math.round(trueHeight * 10) / 10, risk_level: 'moderate'
  };

  const obs = [];
  for (let d = 0; d < 6; d++) {
    let wt = Math.round((trueWeight + d * 0.03 + randomBetween(-0.1, 0.1)) * 10) / 10;
    // Inject lb→kg error on day 3
    if (d === 3) wt = Math.round(trueWeight * 2.20462 * 10) / 10;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }
  // Inject height in meters instead of cm on day 4
  obs.push({ patient_index: index, type: 'height', value: Math.round(trueHeight / 100 * 100) / 100, unit: 'cm', effective_date: dateOffsetDays(admDate, 4), source: 'ehr' });
  obs.push({ patient_index: index, type: 'height', value: Math.round(trueHeight * 10) / 10, unit: 'cm', effective_date: dateOffsetDays(admDate, 0), source: 'ehr' });

  const notesList = [{
    patient_index: index, content: `Patient admitted for ${patient.diagnosis}. Weight ${trueWeight.toFixed(1)} kg measured on admission. Nutrition assessment pending.`,
    author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate
  }];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario3_DecimalErrors(index, gender) {
  const ageMonths = Math.floor(randomBetween(6, 60));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -7);
  const trueWeight = ageMonths < 12 ? randomBetween(6, 10) : ageMonths < 36 ? randomBetween(10, 16) : randomBetween(14, 22);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: randomFrom(DIAGNOSES), admission_weight_kg: Math.round(trueWeight * 10) / 10,
    admission_height_cm: 80, risk_level: 'moderate'
  };

  const obs = [];
  for (let d = 0; d < 6; d++) {
    let wt = Math.round((trueWeight + randomBetween(-0.1, 0.1)) * 10) / 10;
    // Inject ×10 error on day 2
    if (d === 2) wt = Math.round(trueWeight * 10 * 10) / 10;
    // Inject ÷10 error on day 4
    if (d === 4) wt = Math.round(trueWeight / 10 * 100) / 100;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }

  const notesList = [{
    patient_index: index, content: `Patient weight stable around ${trueWeight.toFixed(1)} kg. Good oral intake observed. Continue monitoring.`,
    author: 'RD ' + randomFrom(LAST_NAMES), note_type: 'nutrition', effective_date: dateOffsetDays(admDate, 1)
  }];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario4_CarriedForward(index, gender) {
  const ageMonths = Math.floor(randomBetween(12, 120));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -14);
  const trueWeight = ageMonths < 36 ? randomBetween(10, 16) : randomBetween(15, 35);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: randomFrom(DIAGNOSES), admission_weight_kg: Math.round(trueWeight * 10) / 10,
    admission_height_cm: 90, risk_level: 'low'
  };

  const obs = [];
  const carriedValue = Math.round(trueWeight * 10) / 10;
  for (let d = 0; d < 10; d++) {
    // Days 0-2: measured normally, Days 3-8: carried forward (same value)
    let wt = d < 3 ? Math.round((trueWeight + d * 0.02 + randomBetween(-0.05, 0.05)) * 10) / 10 : carriedValue;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }

  const notesList = [
    { patient_index: index, content: `Admission weight ${trueWeight.toFixed(1)} kg. Patient admitted for ${patient.diagnosis}. Nutrition screen completed.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate },
    { patient_index: index, content: `Day 5: Patient has been eating well. Scale unavailable today, using previous weight. Weight documented as ${carriedValue} kg per yesterday's record.`, author: 'RN ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 5) }
  ];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario5_Edema(index, gender) {
  const ageMonths = Math.floor(randomBetween(24, 96));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -10);
  const dryWeight = ageMonths < 48 ? randomBetween(10, 18) : randomBetween(16, 30);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: 'Nephrotic syndrome', admission_weight_kg: Math.round(dryWeight * 10) / 10,
    admission_height_cm: 100, risk_level: 'high'
  };

  const obs = [];
  for (let d = 0; d < 8; d++) {
    // Weight increases due to edema days 0-4, then decreases with diuretics days 5-7
    let edemaGain = d < 5 ? d * 0.4 : (4 * 0.4) - (d - 4) * 0.6;
    let wt = Math.round((dryWeight + edemaGain + randomBetween(-0.1, 0.1)) * 10) / 10;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }

  const notesList = [
    { patient_index: index, content: `Admission for nephrotic syndrome relapse. Bilateral lower extremity edema noted. Pitting edema 2+. Started prednisone 2mg/kg/day. Poor appetite, intake approximately 40% of meals.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate },
    { patient_index: index, content: `Day 3: Increasing edema, ascites present. Weight up ${(dryWeight + 1.2).toFixed(1)} kg. Patient with generalized edema. IV albumin administered. Furosemide started. Poor oral intake continues.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 3) },
    { patient_index: index, content: `Day 6: Edema improving with diuretic therapy. Weight trending down. Urine output improved. Appetite slightly better, eating 60% of meals. Continue furosemide and prednisone.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 6) }
  ];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario6_PoorIntake(index, gender) {
  const ageMonths = Math.floor(randomBetween(6, 60));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -8);
  const baseWeight = ageMonths < 12 ? randomBetween(6, 10) : ageMonths < 36 ? randomBetween(10, 15) : randomBetween(14, 20);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: 'Acute gastroenteritis', admission_weight_kg: Math.round(baseWeight * 10) / 10,
    admission_height_cm: 75, risk_level: 'moderate'
  };

  const obs = [];
  for (let d = 0; d < 7; d++) {
    // Weight decreases days 0-3 (GI losses), then paradoxically increases on day 4 (data error)
    let change = d <= 3 ? -d * 0.15 : d === 4 ? 0.8 : -0.3;
    let wt = Math.round((baseWeight + change + randomBetween(-0.05, 0.05)) * 10) / 10;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }

  const notesList = [
    { patient_index: index, content: `Admitted with acute gastroenteritis. Vomiting 4-5 times/day, watery diarrhea. Dehydrated, dry mucous membranes, poor skin turgor. NPO, IV fluids started. Weight ${baseWeight.toFixed(1)} kg.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate },
    { patient_index: index, content: `Day 2: Continued vomiting and diarrhea. Poor intake, refusing oral fluids. IV maintenance fluids continued. Weight loss noted. Nutrition consult requested.`, author: 'RN ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 2) },
    { patient_index: index, content: `Day 4: Vomiting improved but still has diarrhea. Tolerating small sips. Poor oral intake, approximately 20% of meals. Continue IV fluids. Monitor weight closely.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 4) }
  ];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario7_Malnutrition(index, gender) {
  const ageMonths = Math.floor(randomBetween(12, 60));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -14);
  // Weight significantly below median (z-score < -3)
  const medianWeight = ageMonths < 24 ? 11 : ageMonths < 48 ? 15 : 18;
  const baseWeight = medianWeight * 0.65; // ~35% below median

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: 'Nhi Dinh dưỡng',
    diagnosis: 'Severe acute malnutrition', admission_weight_kg: Math.round(baseWeight * 10) / 10,
    admission_height_cm: 70, risk_level: 'critical'
  };

  const obs = [];
  for (let d = 0; d < 12; d++) {
    // Slow weight gain with nutritional rehabilitation
    let gain = d * 0.05;
    let wt = Math.round((baseWeight + gain + randomBetween(-0.05, 0.05)) * 10) / 10;
    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
  }

  const notesList = [
    { patient_index: index, content: `Severe acute malnutrition with wasting. MUAC 11.0 cm. Visible muscle wasting, no edema. Failure to thrive documented. Started F-75 therapeutic formula per WHO protocol. Weight ${baseWeight.toFixed(1)} kg.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate },
    { patient_index: index, content: `Day 5: Stabilization phase complete. Transitioning to F-100 formula. Gradual increase in caloric intake. Weight gain ${(baseWeight * 0.05).toFixed(2)} kg/day. No signs of refeeding syndrome. Monitor electrolytes.`, author: 'RD ' + randomFrom(LAST_NAMES), note_type: 'nutrition', effective_date: dateOffsetDays(admDate, 5) },
    { patient_index: index, content: `Day 10: Rehabilitation phase. Good appetite, tolerating increased feeds. Weight trend improving. Target weight gain 5-10 g/kg/day. Continue nutritional supplementation and growth monitoring.`, author: 'RD ' + randomFrom(LAST_NAMES), note_type: 'nutrition', effective_date: dateOffsetDays(admDate, 10) }
  ];

  return { patient, observations: obs, notes: notesList };
}

function generateScenario8_Mixed(index, gender) {
  const ageMonths = Math.floor(randomBetween(3, 144));
  const dob = generateDOB(ageMonths);
  const admDate = dateOffsetDays(new Date(), -12);
  const trueWeight = ageMonths < 12 ? randomBetween(5, 10) : ageMonths < 36 ? randomBetween(10, 16) : ageMonths < 72 ? randomBetween(15, 25) : randomBetween(25, 50);
  const trueHeight = ageMonths < 12 ? randomBetween(55, 75) : ageMonths < 36 ? randomBetween(75, 100) : ageMonths < 72 ? randomBetween(95, 125) : randomBetween(120, 160);

  const patient = {
    medical_record_number: generateMRN(index), name: generatePatientName(gender),
    date_of_birth: dob, gender, admission_date: admDate, ward: randomFrom(WARDS),
    diagnosis: randomFrom(DIAGNOSES), admission_weight_kg: Math.round(trueWeight * 10) / 10,
    admission_height_cm: Math.round(trueHeight * 10) / 10, risk_level: randomFrom(['low', 'moderate', 'high'])
  };

  const obs = [];
  for (let d = 0; d < 10; d++) {
    let wt = Math.round((trueWeight + randomBetween(-0.2, 0.2)) * 10) / 10;
    // Inject various errors on random days
    if (d === 2 && index % 3 === 0) wt = Math.round(trueWeight * 2.2 * 10) / 10; // lb error
    if (d === 5 && index % 3 === 1) wt = Math.round(trueWeight * 10 * 10) / 10; // decimal ×10
    if (d === 7 && index % 3 === 2) wt = obs[d - 1]?.value || wt; // duplicate

    obs.push({ patient_index: index, type: 'weight', value: wt, unit: 'kg', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });

    if (d === 0 || d === 5 || d === 9) {
      obs.push({ patient_index: index, type: 'height', value: Math.round((trueHeight + d * 0.02) * 10) / 10, unit: 'cm', effective_date: dateOffsetDays(admDate, d), source: 'ehr' });
    }
  }

  const notesList = [
    { patient_index: index, content: `Admitted for ${patient.diagnosis}. Initial assessment: weight ${trueWeight.toFixed(1)} kg, height ${trueHeight.toFixed(1)} cm. Nutrition risk screen completed. Diet ordered.`, author: 'Dr. ' + randomFrom(LAST_NAMES), note_type: 'admission', effective_date: admDate },
    { patient_index: index, content: `Day 4: Patient clinically stable. Tolerating diet. No significant weight changes. Continue current management and monitoring.`, author: 'RN ' + randomFrom(LAST_NAMES), note_type: 'progress', effective_date: dateOffsetDays(admDate, 4) }
  ];

  return { patient, observations: obs, notes: notesList };
}

module.exports = { generateAllPatients };
