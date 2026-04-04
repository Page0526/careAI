/* ═══════════════════════════════════════════
   CareAI Medical Record Form – v1.0
   ═══════════════════════════════════════════ */

let currentStep = 1;
const TOTAL_STEPS = 4;
const DRAFT_KEY = 'careai_medical_record_draft';

// Lab reference ranges (client-side mirror for real-time validation)
const LAB_REFS = {
  biochemistry: [
    { key: 'ure_mau', name: 'Urê máu', min: 2.5, max: 7.5, unit: 'mmol/L' },
    { key: 'creatinin_mau', name: 'Creatinin máu', min: 27, max: 62, unit: 'µmol/L' },
    { key: 'ast_got', name: 'AST (GOT)', min: 0, max: 37, unit: 'U/L' },
    { key: 'alt_gpt', name: 'ALT (GPT)', min: 0, max: 40, unit: 'U/L' },
    { key: 'sat_mau', name: 'Sắt máu', min: 13, max: 33, unit: 'µmol/L' },
    { key: 'albumin_mau', name: 'Albumin máu', min: 35, max: 52, unit: 'g/L' },
    { key: 'mg_mau', name: 'Mg máu', min: 0.7, max: 1.1, unit: 'mmol/L' },
    { key: 'calci_ion', name: 'Calci ion hóa', min: 1.17, max: 1.29, unit: 'mmol/L' },
    { key: 'natri', name: 'Na (Natri)', min: 135, max: 145, unit: 'mmol/L' },
    { key: 'kali', name: 'K (Kali)', min: 3.5, max: 5.0, unit: 'mmol/L' },
    { key: 'chloride', name: 'Cl (Chloride)', min: 98, max: 106, unit: 'mmol/L' },
    { key: 'c3', name: 'Bổ thể C3', min: 90, max: 180, unit: 'mg/dl' },
    { key: 'c4', name: 'Bổ thể C4', min: 10, max: 40, unit: 'mg/dl' },
    { key: 'ferritin', name: 'Ferritin', min: 12, max: 150, unit: 'ng/mL' },
  ],
  urinalysis: [
    { key: 'sg', name: 'Tỷ trọng (SG)', min: 1.015, max: 1.025, unit: '' },
    { key: 'ph_nieu', name: 'pH nước tiểu', min: 4.8, max: 7.4, unit: '' },
    { key: 'protein_nieu', name: 'Protein niệu', min: 0, max: 0.1, unit: 'g/L' },
    { key: 'glucose_nieu', name: 'Glucose niệu', min: 0, max: 0.84, unit: 'mmol/L' },
    { key: 'blood_nieu', name: 'Blood niệu', min: 0, max: 5, unit: 'RBC/uL' },
    { key: 'leukocytes', name: 'Bạch cầu niệu', min: 0, max: 10, unit: 'WBC/uL' },
    { key: 'creatinin_nieu_24h', name: 'Creatinin niệu', min: null, max: null, unit: 'µmol/L' },
  ],
  coagulation: [
    { key: 'fibrinogen', name: 'Fibrinogen', min: 2, max: 4, unit: 'g/L' },
    { key: 'pt_giay', name: 'PT (giây)', min: 0, max: 13.9, unit: 'giây' },
    { key: 'pt_phan_tram', name: 'PT (%)', min: 70, max: 140, unit: '%' },
    { key: 'inr', name: 'INR', min: 0.9, max: 1.3, unit: '' },
    { key: 'aptt_giay', name: 'APTT (giây)', min: 24, max: 39, unit: 'giây' },
    { key: 'aptt_benh_chung', name: 'APTT Bệnh/Chứng', min: 0.8, max: 1.3, unit: '' },
  ]
};

// Age-based vitals ranges
function getVitalRanges(ageMonths) {
  if (ageMonths < 1) return { hr: [100, 160], rr: [30, 60] };
  if (ageMonths < 12) return { hr: [80, 140], rr: [25, 50] };
  if (ageMonths < 36) return { hr: [80, 130], rr: [20, 40] };
  if (ageMonths < 72) return { hr: [80, 120], rr: [18, 30] };
  if (ageMonths < 144) return { hr: [70, 110], rr: [14, 22] };
  return { hr: [60, 100], rr: [12, 20] };
}

function initMedicalRecordForm() {
  buildLabTables();
  setupSearchAutocomplete();
  setupVitalsValidation();
  setupNoteNLP();
  loadDraft();
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-admission-date').value = today;
  document.getElementById('f-lab-date').value = today;
  const noteDateTime = document.getElementById('f-note-datetime');
  if (noteDateTime) noteDateTime.value = new Date().toISOString().slice(0, 16);
  // Auto-save draft every 15s
  setInterval(saveDraft, 15000);
}

// ═════════════════════════════════════════
// WIZARD NAVIGATION
// ═════════════════════════════════════════

function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  // Validate current step before going forward
  if (step > currentStep && !validateStep(currentStep)) return;

  currentStep = step;
  // Update panels
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  // Update progress
  document.querySelectorAll('.wizard-step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === step);
    s.classList.toggle('done', sn < step);
  });
  // Update buttons
  document.getElementById('btn-prev').style.display = step === 1 ? 'none' : '';
  document.getElementById('btn-next').style.display = step === TOTAL_STEPS ? 'none' : '';
  document.getElementById('btn-submit').style.display = step === TOTAL_STEPS ? '' : 'none';
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() { goToStep(currentStep + 1); }
function prevStep() { goToStep(currentStep - 1); }

function validateStep(step) {
  if (step === 1) {
    const required = ['f-name', 'f-mrn', 'f-dob', 'f-gender', 'f-ward', 'f-admission-date', 'f-diagnosis'];
    let valid = true;
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        el.classList.add('input-error');
        valid = false;
      } else {
        el.classList.remove('input-error');
      }
    }
    if (!valid) showToast('Vui lòng hoàn tất thông tin bắt buộc', 'warning');
    return valid;
  }
  if (step === 2) {
    const w = document.getElementById('f-weight');
    const h = document.getElementById('f-height');
    if (!w.value || parseFloat(w.value) <= 0) { w.classList.add('input-error'); showToast('Vui lòng nhập cân nặng', 'warning'); return false; }
    if (!h.value || parseFloat(h.value) <= 0) { h.classList.add('input-error'); showToast('Vui lòng nhập chiều cao', 'warning'); return false; }
    w.classList.remove('input-error');
    h.classList.remove('input-error');
    return true;
  }
  return true; // Steps 3, 4 are optional
}

// ═════════════════════════════════════════
// PATIENT SEARCH AUTOCOMPLETE
// ═════════════════════════════════════════

function setupSearchAutocomplete() {
  const input = document.getElementById('patient-search');
  const dropdown = document.getElementById('patient-search-results');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }
      try {
        const data = await apiGet(`/patients?search=${encodeURIComponent(q)}`);
        const patients = data.patients || [];
        if (patients.length === 0) {
          dropdown.innerHTML = '<div class="search-item empty">Không tìm thấy — <a href="#" onclick="clearSearch()">Tạo BN mới</a></div>';
        } else {
          dropdown.innerHTML = patients.slice(0, 8).map(p => `
            <div class="search-item" onclick="selectPatient(${JSON.stringify(p).replace(/"/g, '&quot;')})">
              <strong>${p.name}</strong>
              <span class="search-meta">${p.medical_record_number} | ${p.ward}</span>
            </div>
          `).join('');
        }
        dropdown.style.display = 'block';
      } catch (e) { console.error(e); }
    }, 300);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.patient-search-wrap')) dropdown.style.display = 'none';
  });
}

function selectPatient(p) {
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-mrn').value = p.medical_record_number || '';
  document.getElementById('f-dob').value = p.date_of_birth || '';
  document.getElementById('f-gender').value = p.gender || '';
  document.getElementById('f-ward').value = p.ward || '';
  document.getElementById('f-admission-date').value = p.admission_date || '';
  document.getElementById('f-diagnosis').value = p.diagnosis || '';
  document.getElementById('patient-search-results').style.display = 'none';
  document.getElementById('patient-search').value = '';
  // Calculate age
  if (p.date_of_birth) updateAgeDisplay();
  showToast(`Đã chọn: ${p.name}`, 'success');
}

function clearSearch() {
  document.getElementById('patient-search-results').style.display = 'none';
  document.getElementById('patient-search').value = '';
  document.getElementById('f-name').focus();
}

// ═════════════════════════════════════════
// LAB TABLES
// ═════════════════════════════════════════

function buildLabTables() {
  for (const [category, tests] of Object.entries(LAB_REFS)) {
    const container = document.getElementById(`lab-${category}`);
    if (!container) continue;
    container.innerHTML = `
      <table class="lab-table">
        <thead><tr>
          <th style="width:35%">Tên Xét Nghiệm</th>
          <th style="width:20%">Kết Quả</th>
          <th style="width:25%">CSBT</th>
          <th style="width:15%">Đơn Vị</th>
          <th style="width:5%"></th>
        </tr></thead>
        <tbody>
          ${tests.map(t => `
            <tr id="lab-row-${t.key}">
              <td class="lab-name">${t.name}</td>
              <td><input type="number" step="any" class="lab-input" id="lab-${t.key}" data-key="${t.key}" data-category="${category}" onchange="validateLabInput(this)" onblur="validateLabInput(this)"></td>
              <td class="lab-ref">${t.min !== null ? t.min : '—'} – ${t.max !== null ? t.max : '—'}</td>
              <td class="lab-unit">${t.unit}</td>
              <td class="lab-status" id="lab-status-${t.key}"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }
}

function validateLabInput(el) {
  const key = el.dataset.key;
  const category = el.dataset.category;
  const value = parseFloat(el.value);
  const row = document.getElementById(`lab-row-${key}`);
  const statusCell = document.getElementById(`lab-status-${key}`);

  if (!el.value || isNaN(value)) {
    row.className = '';
    statusCell.innerHTML = '';
    return;
  }

  // Find reference
  const tests = LAB_REFS[category];
  const ref = tests.find(t => t.key === key);
  if (!ref || (ref.min === null && ref.max === null)) {
    statusCell.innerHTML = '';
    return;
  }

  let level = 'normal';
  let msg = '';

  if (ref.max !== null && value > ref.max) {
    const ratio = value / ref.max;
    if (ratio > 5) { level = 'critical'; msg = `TĂNG RẤT CAO (×${ratio.toFixed(1)})`; }
    else if (ratio > 2) { level = 'high'; msg = `TĂNG CAO`; }
    else if (ratio > 1.1) { level = 'warning'; msg = 'Tăng nhẹ'; }
    else { level = 'borderline'; msg = 'Sát ngưỡng trên'; }
  } else if (ref.min !== null && value < ref.min) {
    const ratio = ref.min / value;
    if (ratio > 5) { level = 'critical'; msg = 'GIẢM RẤT NHIỀU'; }
    else if (ratio > 2) { level = 'high'; msg = 'GIẢM'; }
    else if (ratio > 1.1) { level = 'warning'; msg = 'Giảm nhẹ'; }
    else { level = 'borderline'; msg = 'Sát ngưỡng dưới'; }
  }

  row.className = `lab-row-${level}`;

  if (level === 'critical' || level === 'high') {
    statusCell.innerHTML = `<span class="lab-flag ${level}" title="${msg}">⚠</span>`;
    // Check for decimal error
    if (ref.max !== null && value > ref.max * 8) {
      const corrected = (value / 10).toFixed(1);
      showLabSuggestion(key, value, corrected, ref);
    }
  } else if (level === 'warning') {
    statusCell.innerHTML = `<span class="lab-flag warning" title="${msg}">!</span>`;
  } else if (level === 'borderline') {
    statusCell.innerHTML = `<span class="lab-flag borderline" title="${msg}">~</span>`;
  } else {
    statusCell.innerHTML = `<span class="lab-flag normal">✓</span>`;
  }

  updateLabSummary(category);
}

function showLabSuggestion(key, original, corrected, ref) {
  const row = document.getElementById(`lab-row-${key}`);
  const existingSugg = row.querySelector('.lab-suggestion');
  if (existingSugg) existingSugg.remove();

  const sugg = document.createElement('tr');
  sugg.className = 'lab-suggestion';
  sugg.innerHTML = `<td colspan="5" class="lab-suggestion-cell">
    <div class="suggestion-box">
      ⚠️ <strong>${ref.name} = ${original}</strong> — có thể nhầm dấu phẩy? <strong>${corrected} ${ref.unit}</strong> sẽ nằm trong ngưỡng
      <button class="btn-sm btn-primary" onclick="acceptLabSuggestion('${key}', ${corrected})">✅ Dùng ${corrected}</button>
      <button class="btn-sm btn-outline" onclick="this.closest('.lab-suggestion').remove()">✖ Giữ nguyên</button>
    </div>
  </td>`;
  row.after(sugg);
}

function acceptLabSuggestion(key, value) {
  const input = document.getElementById(`lab-${key}`);
  if (input) {
    input.value = value;
    validateLabInput(input);
    const sugg = input.closest('tbody').querySelector('.lab-suggestion');
    if (sugg) sugg.remove();
  }
}

function updateLabSummary(category) {
  const tests = LAB_REFS[category];
  let abnormal = 0, filled = 0;
  for (const t of tests) {
    const input = document.getElementById(`lab-${t.key}`);
    if (input && input.value) {
      filled++;
      const row = document.getElementById(`lab-row-${t.key}`);
      if (row && (row.className.includes('critical') || row.className.includes('high') || row.className.includes('warning'))) abnormal++;
    }
  }
  const summaryMap = { biochemistry: 'lab-biochem-summary', urinalysis: 'lab-urine-summary', coagulation: 'lab-coag-summary' };
  const el = document.getElementById(summaryMap[category]);
  if (el) {
    if (filled === 0) el.textContent = '';
    else if (abnormal === 0) el.textContent = `${filled} chỉ số ✅`;
    else el.textContent = `${abnormal}/${filled} bất thường ⚠️`;
  }
}

function toggleLabPanel(header) {
  const wrap = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  wrap.classList.toggle('collapsed');
  icon.textContent = wrap.classList.contains('collapsed') ? '▸' : '▾';
}

// ═════════════════════════════════════════
// VITALS REAL-TIME VALIDATION
// ═════════════════════════════════════════

function setupVitalsValidation() {
  // DOB → age display
  document.getElementById('f-dob').addEventListener('change', updateAgeDisplay);

  // Weight validation
  document.getElementById('f-weight').addEventListener('blur', validateWeight);
  // Height validation
  document.getElementById('f-height').addEventListener('blur', validateHeight);
  // HR
  document.getElementById('f-hr').addEventListener('blur', () => validateVital('f-hr', 'v-hr', 30, 250, 'Nhịp tim'));
  // RR
  document.getElementById('f-rr').addEventListener('blur', () => validateVital('f-rr', 'v-rr', 5, 80, 'Tần số thở'));
  // Temp
  document.getElementById('f-temp').addEventListener('blur', validateTemp);
  // CRT
  document.getElementById('f-crt').addEventListener('blur', validateCRT);
}

function updateAgeDisplay() {
  const dob = document.getElementById('f-dob').value;
  const display = document.getElementById('f-age-display');
  if (!dob) { display.textContent = ''; return; }
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1) display.textContent = `Sơ sinh`;
  else if (months < 24) display.textContent = `${months} tháng tuổi`;
  else display.textContent = `${Math.floor(months / 12)} tuổi ${months % 12} tháng`;

  if (months > 216) display.innerHTML += ' <span class="field-warn">⚠ CareAI chuyên Nhi (0-18 tuổi)</span>';

  // Update HR hint
  const ranges = getVitalRanges(months);
  const hrHint = document.getElementById('hr-hint');
  if (hrHint) hrHint.textContent = `Ngưỡng: ${ranges.hr[0]}–${ranges.hr[1]} l/ph`;
}

function validateWeight() {
  const el = document.getElementById('f-weight');
  const val = parseFloat(el.value);
  const vDiv = document.getElementById('v-weight');
  if (!val || isNaN(val)) { vDiv.innerHTML = ''; return; }

  const msgs = [];

  if (val < 0.5) {
    msgs.push({ level: 'critical', text: 'Cân nặng quá thấp (<0.5 kg)' });
  } else if (val > 100) {
    const corrected = (val / 10).toFixed(1);
    msgs.push({
      level: 'critical', text: `Có thể nhầm dấu phẩy? ${corrected} kg?`,
      action: `<button class="btn-sm btn-primary" onclick="document.getElementById('f-weight').value=${corrected};validateWeight()">✅ Dùng ${corrected} kg</button>`
    });
  } else if (val > 30) {
    const lbToKg = (val * 0.4536).toFixed(1);
    msgs.push({
      level: 'warning', text: `Nếu đây là lb: ${val} lb ≈ ${lbToKg} kg`,
      action: `<button class="btn-sm btn-outline" onclick="document.getElementById('f-weight').value=${lbToKg};validateWeight()">Chuyển đổi</button>`
    });
  }

  // Z-score
  const dob = document.getElementById('f-dob').value;
  const gender = document.getElementById('f-gender').value;
  if (dob && gender) {
    const wazEl = document.getElementById('zscore-waz');
    // Simple z-score approximation (actual calculation on backend)
    const ageMonths = getAgeMonths(dob);
    // WHO median weight-for-age approximation
    const medians = {
      m: [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6, 10.8, 12.2, 13.5, 15.3, 17.3, 20.5, 23.5, 28.2, 32.6, 37.0, 42.0, 49.0, 56.0],
      f: [3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9, 10.2, 11.5, 12.7, 14.5, 16.4, 19.5, 22.5, 27.0, 31.0, 36.0, 40.0, 45.0, 52.0]
    };
    const g = gender === 'male' ? 'm' : 'f';
    const idx = Math.min(Math.floor(ageMonths / (ageMonths < 24 ? 1 : 12)) + (ageMonths >= 24 ? 12 : 0), medians[g].length - 1);
    const median = medians[g][Math.max(0, idx)];
    const approxZ = median > 0 ? ((val - median) / (median * 0.15)).toFixed(1) : null;

    if (approxZ !== null) {
      wazEl.textContent = approxZ;
      wazEl.className = 'zscore-display';
      if (approxZ < -3) { wazEl.classList.add('zscore-critical'); wazEl.textContent += ' (SDD nặng)'; }
      else if (approxZ < -2) { wazEl.classList.add('zscore-high'); wazEl.textContent += ' (SDD)'; }
      else if (approxZ < -1) { wazEl.classList.add('zscore-warning'); wazEl.textContent += ' (Nguy cơ)'; }
      else { wazEl.classList.add('zscore-normal'); wazEl.textContent += ' (Bình thường)'; }
    }
  }

  vDiv.innerHTML = msgs.map(m => `<div class="validation-msg ${m.level}">${m.text} ${m.action || ''}</div>`).join('');
}

function validateHeight() {
  const el = document.getElementById('f-height');
  const val = parseFloat(el.value);
  const vDiv = document.getElementById('v-height');
  if (!val || isNaN(val)) { vDiv.innerHTML = ''; return; }

  const msgs = [];
  if (val < 10) {
    const corrected = (val * 100).toFixed(0);
    msgs.push({
      level: 'critical', text: `Có thể nhập mét thay vì cm? ${val} m = ${corrected} cm`,
      action: `<button class="btn-sm btn-primary" onclick="document.getElementById('f-height').value=${corrected};validateHeight()">✅ Dùng ${corrected} cm</button>`
    });
  } else if (val > 200) {
    msgs.push({ level: 'warning', text: 'Chiều cao > 200 cm — vượt ngưỡng nhi khoa' });
  }

  // Z-score HAZ
  const dob = document.getElementById('f-dob').value;
  const gender = document.getElementById('f-gender').value;
  if (dob && gender) {
    const hazEl = document.getElementById('zscore-haz');
    const ageMonths = getAgeMonths(dob);
    const medians = {
      m: [49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 84.9, 87.8, 96.1, 103.3, 110.0, 116.0, 121.7, 127.3, 133.0, 140.0, 147.0, 154.0, 163.0],
      f: [49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 83.6, 86.4, 95.1, 102.5, 109.0, 115.0, 120.7, 126.3, 132.0, 139.0, 145.0, 152.0, 160.0]
    };
    const g = gender === 'male' ? 'm' : 'f';
    const idx = Math.min(Math.floor(ageMonths / (ageMonths < 24 ? 1 : 12)) + (ageMonths >= 24 ? 12 : 0), medians[g].length - 1);
    const median = medians[g][Math.max(0, idx)];
    const approxZ = median > 0 ? ((val - median) / (median * 0.04)).toFixed(1) : null;

    if (approxZ !== null) {
      hazEl.textContent = approxZ;
      hazEl.className = 'zscore-display';
      if (approxZ < -3) { hazEl.classList.add('zscore-critical'); hazEl.textContent += ' (Thấp còi nặng)'; }
      else if (approxZ < -2) { hazEl.classList.add('zscore-high'); hazEl.textContent += ' (Thấp còi)'; }
      else { hazEl.classList.add('zscore-normal'); hazEl.textContent += ' (Bình thường)'; }
    }
  }

  vDiv.innerHTML = msgs.map(m => `<div class="validation-msg ${m.level}">${m.text} ${m.action || ''}</div>`).join('');
}

function validateVital(inputId, outputId, min, max, label) {
  const val = parseFloat(document.getElementById(inputId).value);
  const vDiv = document.getElementById(outputId);
  if (!val || isNaN(val)) { vDiv.innerHTML = ''; return; }
  if (val < min || val > max) {
    vDiv.innerHTML = `<div class="validation-msg critical">${label} = ${val} — ngoài ngưỡng sinh lý (${min}–${max})</div>`;
  } else {
    vDiv.innerHTML = '';
  }
}

function validateTemp() {
  const val = parseFloat(document.getElementById('f-temp').value);
  const vDiv = document.getElementById('v-temp');
  if (!val || isNaN(val)) { vDiv.innerHTML = ''; return; }
  if (val < 34 || val > 42) {
    vDiv.innerHTML = `<div class="validation-msg critical">Nhiệt độ ${val}°C — ngoài ngưỡng sinh lý</div>`;
  } else if (val > 38.5) {
    vDiv.innerHTML = `<div class="validation-msg warning">Sốt cao (${val}°C) — xác nhận?</div>`;
  } else { vDiv.innerHTML = ''; }
}

function validateCRT() {
  const val = parseFloat(document.getElementById('f-crt').value);
  const vDiv = document.getElementById('v-crt');
  if (!val || isNaN(val)) { vDiv.innerHTML = ''; return; }
  if (val >= 3) {
    vDiv.innerHTML = `<div class="validation-msg warning">CRT ≥ ${val}s — có thể giảm tưới máu mô</div>`;
  } else { vDiv.innerHTML = ''; }
}

function getAgeMonths(dob) {
  const d = new Date(dob);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

// ═════════════════════════════════════════
// NLP PREVIEW
// ═════════════════════════════════════════

function setupNoteNLP() {
  const textarea = document.getElementById('f-clinical-note');
  if (!textarea) return;
  let debounce;
  textarea.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => parseNoteNLP(textarea.value), 500);
  });
}

function parseNoteNLP(text) {
  const preview = document.getElementById('nlp-preview');
  if (!text.trim()) { preview.innerHTML = ''; return; }

  const patterns = [
    { regex: /\b(phù|edema|phù nề|pitting|ascites)\b/gi, label: 'Phù nề', cls: 'nlp-edema' },
    { regex: /\b(ăn kém|kém ăn|bỏ ăn|biếng ăn|poor intake)\b/gi, label: 'Ăn kém', cls: 'nlp-intake' },
    { regex: /\b(nôn|buồn nôn|tiêu chảy|vomiting)\b/gi, label: 'Nôn / Tiêu chảy', cls: 'nlp-gi' },
    { regex: /\b(suy dinh dưỡng|malnutrition|wasting|sụt cân)\b/gi, label: 'SDD', cls: 'nlp-sdd' },
    { regex: /\b(truyền dịch|IV fluid|dịch truyền)\b/gi, label: 'Truyền dịch', cls: 'nlp-iv' },
    { regex: /\b(furosemide|lợi tiểu|diuretic)\b/gi, label: 'Lợi tiểu', cls: 'nlp-diuretic' },
    { regex: /\b(mất nước|dehydrated|khô niêm)\b/gi, label: 'Mất nước', cls: 'nlp-dehydration' },
  ];

  // Detect numbers near clinical terms
  const numberPattern = /\b(creatinin|albumin|cân nặng|cn|wt|weight|chiều cao|cc|ht)\s*[:=]?\s*(\d+\.?\d*)\b/gi;
  const numbers = [];
  let match;
  while ((match = numberPattern.exec(text)) !== null) {
    numbers.push({ term: match[1], value: parseFloat(match[2]) });
  }

  const found = [];
  for (const p of patterns) {
    if (p.regex.test(text)) {
      found.push(`<span class="nlp-tag ${p.cls}">${p.label}</span>`);
    }
  }

  // Cross-check: if weight mentioned in note vs step 2
  const weightInput = document.getElementById('f-weight');
  for (const num of numbers) {
    if (['creatinin', 'albumin'].includes(num.term.toLowerCase())) {
      found.push(`<span class="nlp-tag nlp-number">Phát hiện: ${num.term} = ${num.value}</span>`);
    }
    if (['cân nặng', 'cn', 'wt', 'weight'].includes(num.term.toLowerCase()) && weightInput && weightInput.value) {
      const formWeight = parseFloat(weightInput.value);
      if (Math.abs(formWeight - num.value) > 0.5) {
        found.push(`<span class="nlp-tag nlp-warning">⚠ Ghi chú: ${num.term}=${num.value} vs Form: ${formWeight} kg</span>`);
      }
    }
  }

  preview.innerHTML = found.length > 0
    ? `<div class="nlp-result"><strong>NLP:</strong> ${found.join(' ')}</div>`
    : '';
}

// ═════════════════════════════════════════
// MEDICATIONS & LAB ORDERS
// ═════════════════════════════════════════

function addMedRow() {
  const list = document.getElementById('medication-list');
  const row = document.createElement('div');
  row.className = 'med-row';
  row.innerHTML = `
    <input type="text" class="form-input med-name" placeholder="Tên thuốc">
    <input type="text" class="form-input med-dose" placeholder="Liều">
    <input type="text" class="form-input med-route" placeholder="Đường dùng">
    <input type="text" class="form-input med-freq" placeholder="Tần suất">
    <button class="btn-sm btn-outline" onclick="this.parentElement.remove()">✕</button>`;
  list.appendChild(row);
}

function addLabOrderRow() {
  const list = document.getElementById('lab-order-list');
  const row = document.createElement('div');
  row.className = 'lab-order-row';
  row.innerHTML = `
    <input type="text" class="form-input" placeholder="VD: Khám chuyên khoa DD" style="flex:1">
    <button class="btn-sm btn-outline" onclick="this.parentElement.remove()">✕</button>`;
  list.appendChild(row);
}

// ═════════════════════════════════════════
// DRAFT SAVE / LOAD
// ═════════════════════════════════════════

function saveDraft() {
  const draft = {
    step: currentStep,
    patient: {
      name: document.getElementById('f-name').value,
      mrn: document.getElementById('f-mrn').value,
      dob: document.getElementById('f-dob').value,
      gender: document.getElementById('f-gender').value,
      ward: document.getElementById('f-ward').value,
      admission_date: document.getElementById('f-admission-date').value,
      diagnosis: document.getElementById('f-diagnosis').value,
    },
    vitals: {
      weight: document.getElementById('f-weight').value,
      height: document.getElementById('f-height').value,
      hr: document.getElementById('f-hr').value,
      rr: document.getElementById('f-rr').value,
      temp: document.getElementById('f-temp').value,
      crt: document.getElementById('f-crt').value,
    },
    note: document.getElementById('f-clinical-note')?.value || '',
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    const ago = (Date.now() - new Date(draft.savedAt).getTime()) / 60000;
    if (ago > 120) { localStorage.removeItem(DRAFT_KEY); return; } // Discard > 2h old

    if (draft.patient) {
      if (draft.patient.name) document.getElementById('f-name').value = draft.patient.name;
      if (draft.patient.mrn) document.getElementById('f-mrn').value = draft.patient.mrn;
      if (draft.patient.dob) document.getElementById('f-dob').value = draft.patient.dob;
      if (draft.patient.gender) document.getElementById('f-gender').value = draft.patient.gender;
      if (draft.patient.ward) document.getElementById('f-ward').value = draft.patient.ward;
      if (draft.patient.admission_date) document.getElementById('f-admission-date').value = draft.patient.admission_date;
      if (draft.patient.diagnosis) document.getElementById('f-diagnosis').value = draft.patient.diagnosis;
    }
    if (draft.vitals) {
      if (draft.vitals.weight) document.getElementById('f-weight').value = draft.vitals.weight;
      if (draft.vitals.height) document.getElementById('f-height').value = draft.vitals.height;
      if (draft.vitals.hr) document.getElementById('f-hr').value = draft.vitals.hr;
      if (draft.vitals.rr) document.getElementById('f-rr').value = draft.vitals.rr;
      if (draft.vitals.temp) document.getElementById('f-temp').value = draft.vitals.temp;
      if (draft.vitals.crt) document.getElementById('f-crt').value = draft.vitals.crt;
    }
    if (draft.note) document.getElementById('f-clinical-note').value = draft.note;
    showToast(`Đã khôi phục bản nháp (${Math.round(ago)} phút trước)`, 'info');
  } catch (e) { console.error('Draft load error:', e); }
}

// ═════════════════════════════════════════
// SUBMIT
// ═════════════════════════════════════════

async function submitRecord() {
  if (!validateStep(1)) { goToStep(1); return; }
  if (!validateStep(2)) { goToStep(2); return; }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Đang lưu & kiểm tra...';

  try {
    // Collect lab results
    const labs = [];
    for (const [category, tests] of Object.entries(LAB_REFS)) {
      for (const t of tests) {
        const input = document.getElementById(`lab-${t.key}`);
        if (input && input.value) {
          labs.push({
            test_key: t.key,
            test_name: t.name,
            test_category: category,
            result_value: parseFloat(input.value),
            unit: t.unit,
            effective_date: document.getElementById('f-lab-date')?.value || new Date().toISOString().split('T')[0],
            ordering_doctor: document.getElementById('f-lab-doctor')?.value || null,
          });
        }
      }
    }

    // Collect orders
    const orders = [];
    const careLevel = document.querySelector('input[name="care-level"]:checked');
    if (careLevel) orders.push({ order_type: 'care_level', content: careLevel.value, effective_date: document.getElementById('f-admission-date').value });
    const diet = document.getElementById('f-diet')?.value;
    if (diet) orders.push({ order_type: 'diet', content: diet, effective_date: document.getElementById('f-admission-date').value });
    document.querySelectorAll('.med-row').forEach(row => {
      const name = row.querySelector('.med-name')?.value;
      if (name) orders.push({
        order_type: 'medication', content: name,
        dosage: row.querySelector('.med-dose')?.value || null,
        route: row.querySelector('.med-route')?.value || null,
        frequency: row.querySelector('.med-freq')?.value || null,
        effective_date: document.getElementById('f-admission-date').value
      });
    });
    // Monitoring
    document.querySelectorAll('#step-4 .checkbox-group input[type="checkbox"]:checked').forEach(cb => {
      if (cb.closest('.orders-column')) {
        orders.push({ order_type: 'monitoring', content: cb.value, effective_date: document.getElementById('f-admission-date').value });
      }
    });

    // Collect physical exam
    const physicalExam = [];
    document.querySelectorAll('#physical-exam-checks input:checked').forEach(cb => physicalExam.push(cb.value));

    // Build clinical note
    const noteText = document.getElementById('f-clinical-note')?.value || '';
    const fullNote = physicalExam.length > 0
      ? `Khám: ${physicalExam.join('; ')}. ${noteText}`
      : noteText;

    const payload = {
      patient: {
        name: document.getElementById('f-name').value.toUpperCase(),
        medical_record_number: document.getElementById('f-mrn').value,
        date_of_birth: document.getElementById('f-dob').value,
        gender: document.getElementById('f-gender').value,
        ward: document.getElementById('f-ward').value,
        admission_date: document.getElementById('f-admission-date').value,
        diagnosis: document.getElementById('f-diagnosis').value,
        weight: parseFloat(document.getElementById('f-weight').value) || null,
        height: parseFloat(document.getElementById('f-height').value) || null,
      },
      vitals: {
        heart_rate: parseInt(document.getElementById('f-hr').value) || null,
        respiratory_rate: parseInt(document.getElementById('f-rr').value) || null,
        temperature: parseFloat(document.getElementById('f-temp').value) || null,
        crt: parseFloat(document.getElementById('f-crt').value) || null,
        effective_date: document.getElementById('f-admission-date').value,
      },
      labs,
      notes: fullNote ? {
        content: fullNote,
        author: document.getElementById('f-note-author')?.value || null,
        note_type: 'progress',
        effective_date: document.getElementById('f-note-datetime')?.value?.split('T')[0] || new Date().toISOString().split('T')[0],
      } : null,
      orders
    };

    const result = await apiPost('/medical-record', payload);
    showValidationResult(result);
    localStorage.removeItem(DRAFT_KEY);

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Lỗi lưu hồ sơ — dữ liệu đã lưu nháp', 'error');
    saveDraft();
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = '💾 Lưu Hồ Sơ & Kiểm Tra';
}

function showValidationResult(result) {
  const container = document.getElementById('validation-result');
  const body = document.getElementById('validation-result-body');
  container.style.display = 'flex';

  const s = result.summary || {};
  const riskColors = { critical: '#DC2626', high: '#EA580C', moderate: '#CA8A04', low: '#059669' };
  const riskLabel = { critical: 'Nguy hiểm', high: 'Cao', moderate: 'Trung bình', low: 'Thấp' };

  let html = `
    <div class="result-risk" style="border-left:4px solid ${riskColors[result.risk_level] || '#94A3B8'}">
      <span class="severity-badge ${result.risk_level}">${riskLabel[result.risk_level] || result.risk_level}</span>
      <span>${s.total_alerts || 0} cảnh báo phát hiện</span>
    </div>`;

  if (result.alerts && result.alerts.length > 0) {
    const grouped = { critical: [], high: [], warning: [], info: [] };
    result.alerts.forEach(a => (grouped[a.severity] || grouped.info).push(a));

    for (const [sev, alerts] of Object.entries(grouped)) {
      if (alerts.length === 0) continue;
      const icon = sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'warning' ? '🟡' : 'ℹ️';
      html += `<div class="result-group"><h3>${icon} ${alerts.length} ${sev}</h3>`;
      alerts.forEach(a => {
        html += `<div class="result-alert ${sev}">
          <div class="result-alert-type">${a.alert_type}</div>
          <div class="result-alert-msg">${a.message}</div>
          ${a.explanation ? `<div class="result-alert-explain">${a.explanation}</div>` : ''}
        </div>`;
      });
      html += '</div>';
    }
  } else {
    html += `<div class="result-success"><h3>✅ Không phát hiện cảnh báo</h3><p>Tất cả dữ liệu nằm trong ngưỡng bình thường</p></div>`;
  }

  body.innerHTML = html;
  document.getElementById('btn-view-patient').href = `patient-detail.html?id=${result.patient_id}`;
}

function closeValidationResult() {
  document.getElementById('validation-result').style.display = 'none';
}

function resetForm() {
  closeValidationResult();
  document.querySelectorAll('.form-input').forEach(el => el.value = '');
  document.querySelectorAll('.lab-input').forEach(el => { el.value = ''; });
  document.querySelectorAll('.lab-table tbody tr').forEach(tr => tr.className = '');
  document.querySelectorAll('.lab-status').forEach(el => el.innerHTML = '');
  document.querySelectorAll('.field-validation').forEach(el => el.innerHTML = '');
  document.querySelectorAll('.nlp-preview').forEach(el => el.innerHTML = '');
  document.querySelectorAll('.lab-suggestion').forEach(el => el.remove());
  document.getElementById('medication-list').innerHTML = '';
  document.getElementById('lab-order-list').innerHTML = '';
  document.getElementById('zscore-waz').textContent = '—';
  document.getElementById('zscore-haz').textContent = '—';
  goToStep(1);
  localStorage.removeItem(DRAFT_KEY);
}

// ═════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═════════════════════════════════════════

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}
