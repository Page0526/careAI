/* ═══════════════════════════════════════════
   CareAI Patient Detail – v3.0
   Maps to: GET /api/patients/:id →
   { patient, observations, alerts, notes, summary }
   ═══════════════════════════════════════════ */

let patientData = null;
let growthChart = null;

async function loadPatientDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;

  try {
    patientData = await apiGet(`/patients/${id}`);
    if (!patientData || !patientData.patient) return;

    renderBanner(patientData);
    renderNutritionSummary(patientData);
    setupTabs();
    renderGrowthChart(patientData);
    renderAlerts(patientData);
    renderNotes(patientData);
    renderFHIR(id);
    setupRevalidate(id);

    // Set copilot context
    if (typeof Copilot !== 'undefined') {
      Copilot.setPatientContext(id, patientData.patient.name || '');
      Copilot.loadAISummary(id);
    }

  } catch (e) {
    console.error('Failed to load patient:', e);
  }
}

function renderBanner(data) {
  const p = data.patient;
  const initials = (p.name || '--').split(' ').map(w => w.charAt(0)).join('').slice(0, 2);
  document.getElementById('banner-avatar').textContent = initials;
  document.getElementById('banner-name').textContent = p.name || '-';

  const age = p.date_of_birth ? I18N.formatAge(p.date_of_birth) : '-';
  const gender = p.gender === 'female' ? 'Nữ' : 'Nam';
  const admDate = p.admission_date ? I18N.formatDate(p.admission_date) : '-';
  document.getElementById('banner-meta').textContent = `${p.medical_record_number || '-'} | ${gender} | ${age} | ${p.ward || '-'} | ${admDate}`;

  const sev = document.getElementById('banner-severity');
  const risk = (p.risk_level || 'low').toLowerCase();
  sev.innerHTML = `<span class="severity-badge ${risk}">${I18N.t('severity.' + risk, risk)}</span>`;

  document.title = `${p.name || 'Bệnh nhân'} – CareAI`;
}

function renderNutritionSummary(data) {
  const obs = data.observations || [];
  const summary = data.summary || {};

  // Latest weight/height from observations
  const weights = obs.filter(o => o.type === 'weight');
  const heights = obs.filter(o => o.type === 'height');
  const latestW = weights.length > 0 ? weights[weights.length - 1] : null;
  const latestH = heights.length > 0 ? heights[heights.length - 1] : null;

  const wEl = document.getElementById('nut-weight');
  const hEl = document.getElementById('nut-height');
  if (wEl) wEl.textContent = latestW ? parseFloat(latestW.value).toFixed(1) : '-';
  if (hEl) hEl.textContent = latestH ? parseFloat(latestH.value).toFixed(1) : '-';

  // Z-score from latest weight observation
  const zEl = document.getElementById('nut-zscore');
  if (zEl && latestW && latestW.zscore !== null && latestW.zscore !== undefined) {
    const z = parseFloat(latestW.zscore);
    zEl.textContent = z.toFixed(2);
    if (z < -3) zEl.style.color = 'var(--severity-critical)';
    else if (z < -2) zEl.style.color = 'var(--severity-high)';
    else if (z < -1) zEl.style.color = 'var(--severity-warning)';
    else zEl.style.color = 'var(--accent-emerald)';
  }

  // DQ Score from summary
  const dqEl = document.getElementById('nut-dq');
  const dq = summary.avg_dq_score;
  if (dqEl && dq != null) {
    const dqPercent = Math.round(dq * 100);
    dqEl.textContent = dqPercent;
    if (dqPercent >= 80) dqEl.style.color = 'var(--accent-emerald)';
    else if (dqPercent >= 60) dqEl.style.color = 'var(--severity-warning)';
    else dqEl.style.color = 'var(--severity-critical)';
  }

  // Alerts & Obs counts
  const alertCount = summary.active_alerts || 0;
  const obsCount = summary.total_observations || obs.length;
  const aEl = document.getElementById('nut-alerts');
  const oEl = document.getElementById('nut-obs');
  if (aEl) {
    aEl.textContent = alertCount;
    if (alertCount > 3) aEl.style.color = 'var(--severity-critical)';
    else if (alertCount > 0) aEl.style.color = 'var(--severity-warning)';
  }
  if (oEl) oEl.textContent = obsCount;

  const aLabel = document.getElementById('nut-alerts-label');
  const oLabel = document.getElementById('nut-obs-label');
  if (aLabel) aLabel.textContent = I18N.t('patient.active', 'đang hoạt động');
  if (oLabel) oLabel.textContent = I18N.t('patient.total', 'tổng');
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

function calculateRiskLevelFromAlerts(alerts) {
  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const criticalCount = activeAlerts.filter(alert => alert.severity === 'critical').length;
  const highCount = activeAlerts.filter(alert => alert.severity === 'high').length;
  const warningCount = activeAlerts.filter(alert => alert.severity === 'warning').length;

  if (criticalCount > 0 || highCount > 2) return 'critical';
  if (highCount > 0) return 'high';
  if (warningCount > 0) return 'moderate';
  return 'low';
}

function buildAlertKey(alert) {
  return [
    alert.tier || '',
    alert.alert_type || '',
    alert.observation_id || '',
    alert.message || ''
  ].join('::');
}

function dedupeAlerts(alerts) {
  const seen = new Set();

  return alerts.filter(alert => {
    const key = buildAlertKey(alert);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyValidationResult(validationData) {
  if (!patientData) return;

  const tier1Observations = validationData?.tier1?.observations || [];
  const tier2Alerts = validationData?.tier2?.alerts || [];
  const validationByObservationId = new Map(
    tier1Observations.map(result => [result.observation_id, result])
  );

  patientData.observations = (patientData.observations || []).map(observation => {
    const validationResult = validationByObservationId.get(observation.id);
    if (!validationResult) return observation;

    return {
      ...observation,
      data_quality_score: validationResult.data_quality_score,
      zscore: validationResult.zscore ? validationResult.zscore.zscore : observation.zscore,
      zscore_interpretation: validationResult.zscore
        ? validationResult.zscore.interpretation
        : observation.zscore_interpretation,
    };
  });

  const preservedAlerts = (patientData.alerts || []).filter(alert => {
    const alertType = String(alert.alert_type || '');
    return alertType.startsWith('LAB_') || !['tier1', 'tier2'].includes(alert.tier);
  });

  const recalculatedAlerts = [
    ...tier1Observations.flatMap(result => result.alerts || []),
    ...tier2Alerts,
  ];

  patientData.alerts = dedupeAlerts([...preservedAlerts, ...recalculatedAlerts]);

  const activeAlerts = patientData.alerts.filter(alert => !alert.resolved);
  patientData.patient = {
    ...patientData.patient,
    risk_level: calculateRiskLevelFromAlerts(patientData.alerts),
  };
  patientData.summary = {
    ...(patientData.summary || {}),
    total_observations: (patientData.observations || []).length,
    total_notes: (patientData.notes || []).length,
    active_alerts: activeAlerts.length,
    critical_alerts: activeAlerts.filter(alert => alert.severity === 'critical').length,
    avg_dq_score: validationData?.combined_summary?.average_data_quality ?? patientData.summary?.avg_dq_score,
  };
}

function renderGrowthChart(data) {
  const obs = data.observations || [];
  const weights = obs.filter(o => o.type === 'weight').sort((a, b) => new Date(a.effective_date) - new Date(b.effective_date));

  if (weights.length === 0) return;

  const labels = weights.map(w => I18N.formatDate(w.effective_date));
  const values = weights.map(w => parseFloat(w.value));
  const zScores = weights.map(w => w.zscore !== null && w.zscore !== undefined ? parseFloat(w.zscore) : null);

  const ctx = document.getElementById('chart-growth');
  if (!ctx) return;

  if (growthChart) growthChart.destroy();

  const datasets = [
    {
      label: I18N.t('patient.weight', 'Cân Nặng') + ' (kg)',
      data: values,
      borderColor: '#0F6FDE',
      backgroundColor: 'rgba(15, 111, 222, 0.06)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: '#0F6FDE',
      borderWidth: 2,
      yAxisID: 'y',
    }
  ];

  if (zScores.some(z => z !== null)) {
    datasets.push({
      label: 'Z-Score (WAZ)',
      data: zScores,
      borderColor: '#7C3AED',
      borderDash: [4, 4],
      pointRadius: 3,
      pointBackgroundColor: '#7C3AED',
      borderWidth: 1.5,
      fill: false,
      yAxisID: 'y1',
    });
  }

  growthChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#64748B', font: { family: 'Inter', size: 12 } } },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              if (context.datasetIndex === 0) {
                const z = zScores[context.dataIndex];
                if (z !== null) {
                  let interp = 'Bình thường';
                  if (z < -3) interp = 'Suy dinh dưỡng nặng';
                  else if (z < -2) interp = 'Suy dinh dưỡng';
                  else if (z < -1) interp = 'Nguy cơ suy dinh dưỡng';
                  return `Z-Score: ${z.toFixed(2)} (${interp})`;
                }
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94A3B8', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { position: 'left', title: { display: true, text: 'kg', color: '#64748B' }, ticks: { color: '#64748B', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Z-Score', color: '#7C3AED' }, ticks: { color: '#7C3AED', font: { size: 11 } }, grid: { drawOnChartArea: false },
          suggestedMin: -4, suggestedMax: 2
        }
      }
    }
  });
}

function renderAlerts(data) {
  const container = document.getElementById('patient-alerts');
  if (!container) return;
  const alerts = data.alerts || [];
  if (alerts.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>${I18N.t('patient.noAlerts', 'Không có cảnh báo')}</h3><p>${I18N.t('patient.allGood', 'Tất cả chỉ số bình thường!')}</p></div>`;
    return;
  }

  container.innerHTML = alerts.map(a => {
    const sev = (a.severity || 'info').toLowerCase();
    const explanation = a.explanation ? `<div style="margin-top:6px;font-size:0.75rem;color:var(--text-tertiary);font-style:italic;">${a.explanation}</div>` : '';
    return `<div class="alert-item ${sev}">
      <span class="severity-dot ${sev}"></span>
      <div class="alert-body">
        <div class="alert-type">${a.alert_type || '-'} <span style="font-size:0.68rem;color:var(--text-tertiary);font-family:var(--font-mono);">[${a.tier || ''}]</span></div>
        <div class="alert-msg">${a.message || '-'}</div>
        ${explanation}
      </div>
      <span class="severity-badge ${sev}">${I18N.t('severity.' + sev, sev)}</span>
    </div>`;
  }).join('');
}

function renderNotes(data) {
  const container = document.getElementById('patient-notes');
  if (!container) return;
  const notes = data.notes || [];
  if (notes.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>${I18N.t('patient.noNotes', 'Không có ghi chú')}</h3></div>`;
    return;
  }

  container.innerHTML = notes.map(n => {
    const highlighted = highlightNLPKeywords(n.content || '');
    const noteType = n.note_type ? `<span class="severity-badge info" style="margin-left:8px;">${n.note_type}</span>` : '';
    return `<div style="padding:14px;border-bottom:1px solid var(--bg-primary);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:600;font-size:0.82rem;">${n.author || 'Staff'}${noteType}</span>
        <span style="font-size:0.72rem;color:var(--text-tertiary);">${I18N.formatDate(n.effective_date)}</span>
      </div>
      <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.7;">${highlighted}</p>
    </div>`;
  }).join('');
}

function highlightNLPKeywords(text) {
  const patterns = [
    { regex: /\b(edema|phù|pitting edema|ascites)\b/gi, cls: 'edema' },
    { regex: /\b(fluid retention|giữ nước|tích nước|IV fluid|IV fluids|dehydrated)\b/gi, cls: 'fluid' },
    { regex: /\b(poor intake|intake reduced|giảm ăn|ăn kém|poor oral intake|NPO|refusing oral|poor appetite)\b/gi, cls: 'intake' },
    { regex: /\b(weight gain|tăng cân|improving|cải thiện|tolerating|weight stable|adequate oral intake|eating well)\b/gi, cls: 'positive' },
    { regex: /\b(prednisone|furosemide|albumin|antibiotic|supplement|thuốc|kháng sinh|F-75|F-100|diuretic)\b/gi, cls: 'medication' },
    { regex: /\b(malnutrition|wasting|failure to thrive|MUAC|severe acute malnutrition|suy dinh dưỡng)\b/gi, cls: 'edema' },
  ];
  let result = text;
  patterns.forEach(p => {
    result = result.replace(p.regex, match => `<span class="nlp-tag ${p.cls}">${match}</span>`);
  });
  return result;
}

async function renderFHIR(patientId) {
  const viewer = document.getElementById('fhir-viewer');
  if (!viewer) return;
  try {
    const data = await apiGet(`/fhir/${patientId}`);
    viewer.innerHTML = highlightJSON(data);
    // Download button
    const btn = document.getElementById('btn-download-json');
    if (btn) {
      btn.onclick = () => { window.location.href = `/api/fhir/${patientId}/download`; };
    }
  } catch (e) {
    viewer.textContent = 'FHIR data not available for this patient.';
  }
}

function setupRevalidate(id) {
  const btn = document.getElementById('btn-revalidate');
  if (btn) {
    btn.onclick = async () => {
      btn.disabled = true;
      const labelEl = btn.querySelector('span:last-child');
      if (labelEl) labelEl.textContent = I18N.t('common.loading', 'Đang tải...');
      try {
        const validationData = await apiGet(`/validation/${id}`);
        applyValidationResult(validationData);
        renderBanner(patientData);
        renderNutritionSummary(patientData);
        renderAlerts(patientData);
        renderGrowthChart(patientData);
        if (typeof Layout !== 'undefined') {
          Layout.showToast(I18N.t('patient.revalidate', 'Kiểm tra lại') + ' thành công', 'info', 2400);
        }
      } catch (e) {
        console.error('Revalidation failed:', e);
        if (typeof Layout !== 'undefined') {
          Layout.showToast(e.message || 'Không thể kiểm tra lại dữ liệu', 'error', 3200);
        }
      }
      btn.disabled = false;
      if (labelEl) labelEl.textContent = I18N.t('patient.revalidate', 'Kiểm tra lại');
    };
  }
}

async function revalidatePatient() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    const btn = document.getElementById('btn-revalidate');
    if (btn) btn.click();
  }
}
