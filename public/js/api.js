/**
 * CareAI API Client
 */
const API_BASE = '/api';

async function readResponseData(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function createApiError(response, payload) {
  const message = typeof payload === 'object' && payload !== null
    ? payload.error || payload.message || `HTTP ${response.status}: ${response.statusText}`
    : `HTTP ${response.status}: ${response.statusText}`;
  const error = new Error(message);
  error.status = response.status;
  error.payload = payload;
  return error;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await readResponseData(response);

  if (!response.ok) {
    throw createApiError(response, payload);
  }

  return payload;
}

async function apiGet(path) {
  return apiRequest(path);
}

async function apiPost(path, body) {
  return apiRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function severityIcon(severity) {
  return `<span class="severity-dot ${severity}" style="width:10px;height:10px;"></span>`;
}

function severityBadge(severity) {
  return `<span class="severity-badge ${severity}"><span class="severity-dot ${severity}"></span>${severity}</span>`;
}

function dqBar(score) {
  const pct = Math.round((score || 0) * 100);
  const cls = pct >= 80 ? 'good' : pct >= 50 ? 'moderate' : 'poor';
  return `<div class="dq-bar"><div class="dq-bar-fill ${cls}" style="width: ${pct}%"></div></div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Simple Markdown renderer (for agent responses)
function renderMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;">$1</code>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/<\/ul><br><ul>/g, '')
    // Table support
    .replace(/\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, body) => {
      const ths = header.split('|').filter(Boolean).map(h => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(row => {
        const tds = row.split('|').filter(Boolean).map(d => `<td>${d.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    });
}

// FHIR JSON syntax highlighting
function highlightJSON(obj, indent = 0) {
  const json = JSON.stringify(obj, null, 2);
  return json
    .replace(/"([^"]+)":/g, '"<span class="key">$1</span>":')
    .replace(/: "([^"]+)"/g, ': "<span class="string">$1</span>"')
    .replace(/: (\d+\.?\d*)/g, ': <span class="number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="boolean">$1</span>')
    .replace(/: (null)/g, ': <span class="null">$1</span>');
}
