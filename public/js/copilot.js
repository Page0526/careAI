/* ═══════════════════════════════════════════
   CareAI Copilot – Floating AI Assistant
   Context-aware, slide-in panel
   ═══════════════════════════════════════════ */

const Copilot = (() => {
  let isOpen = false;
  let currentPatientId = null;
  let currentPatientName = null;
  let messages = [];

  function getHTML() {
    return `
      <button class="copilot-fab" id="copilot-fab" title="Trợ Lý AI">
        <span data-icon="cpu" data-icon-size="24"></span>
      </button>
      <div class="copilot-panel" id="copilot-panel">
        <div class="copilot-header">
          <h3><span data-icon="cpu" data-icon-size="18"></span> <span data-i18n="copilot.title">Trợ Lý AI</span></h3>
          <button class="copilot-close" id="copilot-close"><span data-icon="x" data-icon-size="16"></span></button>
        </div>
        <div class="copilot-context" id="copilot-context">
          <span data-icon="user" data-icon-size="14"></span>
          <span id="copilot-context-text" data-i18n="copilot.noPatient">Chưa chọn bệnh nhân</span>
        </div>
        <div class="copilot-messages" id="copilot-messages"></div>
        <div class="copilot-input-area">
          <input type="text" id="copilot-input" placeholder="Hỏi về bệnh nhân..." data-i18n-placeholder="copilot.placeholder">
          <button class="btn btn-primary" id="copilot-send">
            <span data-icon="send" data-icon-size="16"></span>
          </button>
        </div>
      </div>`;
  }

  function init() {
    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = getHTML();
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }

    // Bind events
    const fab = document.getElementById('copilot-fab');
    const panel = document.getElementById('copilot-panel');
    const closeBtn = document.getElementById('copilot-close');
    const sendBtn = document.getElementById('copilot-send');
    const input = document.getElementById('copilot-input');

    fab.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    // Inject icons in copilot elements
    if (typeof injectIcons === 'function') injectIcons();

    // Add welcome message
    addMessage('assistant', I18N ? I18N.t('copilot.welcome') : 'Xin chào! Tôi là CareAI, sẵn sàng hỗ trợ bạn phân tích dữ liệu bệnh nhân.');
  }

  function toggle() {
    isOpen ? close() : open();
  }

  function open() {
    const panel = document.getElementById('copilot-panel');
    const fab = document.getElementById('copilot-fab');
    panel.classList.add('open');
    fab.classList.add('active');
    isOpen = true;
    document.getElementById('copilot-input').focus();
  }

  function close() {
    const panel = document.getElementById('copilot-panel');
    const fab = document.getElementById('copilot-fab');
    panel.classList.remove('open');
    fab.classList.remove('active');
    isOpen = false;
  }

  function setPatientContext(patientId, patientName) {
    currentPatientId = patientId;
    currentPatientName = patientName;
    const ctx = document.getElementById('copilot-context-text');
    if (ctx) ctx.textContent = patientName || (I18N ? I18N.t('copilot.noPatient') : 'Chưa chọn bệnh nhân');
  }

  function addMessage(role, content) {
    messages.push({ role, content });
    const container = document.getElementById('copilot-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `copilot-msg ${role}`;
    div.innerHTML = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  async function send() {
    const input = document.getElementById('copilot-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    addMessage('user', msg);

    // Show thinking
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'copilot-msg assistant';
    thinkingDiv.id = 'copilot-thinking';
    thinkingDiv.innerHTML = `<span style="opacity:0.6">${I18N ? I18N.t('copilot.thinking') : 'Đang phân tích...'}</span>`;
    const container = document.getElementById('copilot-messages');
    container.appendChild(thinkingDiv);
    container.scrollTop = container.scrollHeight;

    try {
      const body = { message: msg };
      if (currentPatientId) body.patient_id = parseInt(currentPatientId);

      const data = await apiPost('/agent/chat', body);
      const thinking = document.getElementById('copilot-thinking');
      if (thinking) thinking.remove();

      const answer = data.answer || data.response || data.message || 'Xin lỗi, không thể xử lý yêu cầu.';
      addMessage('assistant', formatMarkdown(answer));
    } catch (e) {
      const thinking = document.getElementById('copilot-thinking');
      if (thinking) thinking.remove();
      addMessage('assistant', 'Xin lỗi, đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    }
  }

  function formatMarkdown(text) {
    text = String(text || '');
    // Strip all emoji
    text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{2B50}\u{2702}-\u{27B0}\u{23E9}-\u{23FA}\u{200D}\u{20E3}\u{FE0E}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2194}-\u{21AA}\u{231A}\u{231B}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}]/gu, '');
    // Clean up multiple spaces from emoji removal
    text = text.replace(/  +/g, ' ').trim();
    // Convert markdown headings
    text = text.replace(/^###\s*(.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^##\s*(.+)$/gm, '<h4>$1</h4>');
    // Convert bold/italic/code
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/`(.*?)`/g, '<code style="background:var(--bg-surface);padding:1px 4px;border-radius:3px;font-size:var(--type-footnote);">$1</code>');
    // Convert lists
    text = text.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*?<\/li>\n?)+/gs, '<ul>$&</ul>');
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    // Clean empty br between block elements
    text = text.replace(/<br>\s*<(h4|ul|\/ul)/g, '<$1');
    return text;
  }

  function getAISummaryHTML(summary) {
    const t = (k, fb) => (typeof I18N !== 'undefined') ? I18N.t(k, fb) : fb;
    return `
      <div class="ai-summary-card">
        <div class="ai-summary-header">
          <h4><span data-icon="cpu" data-icon-size="16"></span> ${t('copilot.insight', 'Phân Tích AI')}</h4>
          <button class="btn btn-sm btn-ghost" onclick="Copilot.refreshSummary()">
            <span data-icon="refresh-cw" data-icon-size="14"></span> ${t('copilot.refresh', 'Làm mới')}
          </button>
        </div>
        <div class="ai-summary-body">${formatMarkdown(summary)}</div>
        <div class="ai-summary-actions">
          <button class="btn btn-sm btn-primary" onclick="Copilot.open()">
            <span data-icon="message-circle" data-icon-size="14"></span> ${t('copilot.askMore', 'Hỏi thêm')}
          </button>
        </div>
      </div>`;
  }

  async function loadAISummary(patientId) {
    const container = document.getElementById('ai-summary');
    if (!container) return;
    container.innerHTML = '<div class="skeleton" style="height:80px;"></div>';
    try {
      const data = await apiPost('/agent/chat', {
        patient_id: parseInt(patientId),
        message: 'Tạo tóm tắt ngắn gọn về tình trạng dinh dưỡng và các cảnh báo quan trọng của bệnh nhân này bằng tiếng Việt, tối đa 3 câu.'
      });
      const summary = data.response || data.answer || 'Không thể tạo tóm tắt AI. Vui lòng thử lại.';
      container.innerHTML = getAISummaryHTML(summary);
      if (typeof injectIcons === 'function') injectIcons();
    } catch (e) {
      container.innerHTML = getAISummaryHTML('Không thể kết nối với AI. Kiểm tra kết nối mạng và thử lại.');
      if (typeof injectIcons === 'function') injectIcons();
    }
  }

  async function refreshSummary() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) loadAISummary(id);
  }

  return { init, open, close, toggle, setPatientContext, addMessage, loadAISummary, refreshSummary, getAISummaryHTML };
})();
