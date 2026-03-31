/* ═══════════════════════════════════════════
   CareAI Layout v4.0 – macOS-Grade Sidebar
   Global search, shortcuts, toast, scroll-top
   ═══════════════════════════════════════════ */

const Layout = (() => {
  function checkAuth() {
    const user = sessionStorage.getItem('careai_user');
    if (!user && !window.location.pathname.includes('login')) {
      window.location.href = 'login.html';
      return null;
    }
    return user ? JSON.parse(user) : null;
  }

  function logout() {
    sessionStorage.removeItem('careai_user');
    window.location.href = 'login.html';
  }

  function getInitials(name) {
    return name.split(' ').map(w => w.charAt(0)).join('').slice(0, 2).toUpperCase();
  }

  function getSidebarHTML(activePage) {
    const user = checkAuth();
    if (!user) return '';
    const t = (k, fb) => (typeof I18N !== 'undefined') ? I18N.t(k, fb) : fb;
    const lang = (typeof I18N !== 'undefined') ? I18N.getLang() : 'vi';

    const sections = [
      {
        title: t('nav.sectionOverview', 'Tổng Quan'),
        items: [
          { id: 'dashboard', icon: 'layout-dashboard', label: t('nav.dashboard', 'Bảng Theo Dõi'), href: 'dashboard.html' },
        ]
      },
      {
        title: t('nav.sectionPatients', 'Bệnh Nhân'),
        items: [
          { id: 'patients', icon: 'users', label: t('nav.patients', 'Danh Sách'), href: 'patients.html' },
          { id: 'medical-record', icon: 'clipboard-plus', label: t('nav.medicalRecord', 'Nhập Hồ Sơ'), href: 'medical-record.html' },
        ]
      }
    ];

    let navHTML = '';
    sections.forEach(section => {
      navHTML += `<li class="sidebar-section-title">${section.title}</li>`;
      section.items.forEach(item => {
        const isActive = activePage === item.id ? ' active' : '';
        navHTML += `<li><a href="${item.href}" class="${isActive}"><span data-icon="${item.icon}" data-icon-size="18"></span> <span>${item.label}</span></a></li>`;
      });
    });

    return `
      <nav class="sidebar" id="sidebar">
        <a class="sidebar-brand" href="dashboard.html">
          <div class="brand-icon"><span data-icon="stethoscope" data-icon-size="18"></span></div>
          <div class="brand-text">
            <h1>CareAI</h1>
            <div class="brand-version">${t('app.version', 'v1.0')}</div>
          </div>
        </a>
        <div class="sidebar-search">
          <input type="text" placeholder="${t('search.placeholder', 'Tìm bệnh nhân...')} (Ctrl+K)" id="global-search" autocomplete="off">
          <div class="search-dropdown" id="global-search-dropdown"></div>
        </div>
        <ul class="sidebar-nav">${navHTML}</ul>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">${getInitials(user.name)}</div>
            <div class="user-info">
              <div class="user-name">${user.name}</div>
              <div class="user-role">${user.role}</div>
            </div>
          </div>
          <div class="lang-switch">
            <button class="${lang === 'vi' ? 'active' : ''}" onclick="Layout.switchLang('vi')">VI</button>
            <button class="${lang === 'en' ? 'active' : ''}" onclick="Layout.switchLang('en')">EN</button>
          </div>
          <a href="#" onclick="Layout.logout(); return false;" class="sidebar-nav-link" style="display:flex;align-items:center;gap:8px;padding:10px 8px;margin-top:8px;font-size:0.78rem;color:var(--text-tertiary);text-decoration:none;min-height:44px;">
            <span data-icon="log-out" data-icon-size="16"></span>
            <span data-i18n="nav.logout">${t('nav.logout', 'Đăng Xuất')}</span>
          </a>
          <div class="shortcut-hint">
            <kbd>Ctrl+K</kbd> tìm kiếm · <kbd>Ctrl+/</kbd> AI
          </div>
        </div>
      </nav>`;
  }

  function injectSidebar(activePage) {
    const user = checkAuth();
    if (!user) return;
    const sidebarDiv = document.getElementById('app-sidebar');
    if (sidebarDiv) {
      sidebarDiv.innerHTML = getSidebarHTML(activePage);
    }
    // Init global search
    initGlobalSearch();
    // Init keyboard shortcuts
    initShortcuts();
    // Init scroll-to-top
    initScrollTop();
    // Init toast container
    initToastContainer();
  }

  // ─── Global Search ───
  function initGlobalSearch() {
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('global-search-dropdown');
    if (!input || !dropdown) return;

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        try {
          const data = await apiGet(`/patients?search=${encodeURIComponent(q)}`);
          const patients = Array.isArray(data.patients) ? data.patients : [];
          if (patients.length === 0) {
            dropdown.innerHTML = '<div class="search-item empty">Không tìm thấy</div>';
          } else {
            dropdown.innerHTML = patients.slice(0, 6).map(p => `
              <div class="search-item" onclick="window.location.href='patient-detail.html?id=${p.id}'">
                <strong>${p.name}</strong>
                <span class="search-meta">${p.medical_record_number || ''} · ${p.ward || ''}</span>
              </div>
            `).join('');
          }
          dropdown.style.display = 'block';
        } catch (e) { dropdown.style.display = 'none'; }
      }, 250);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) dropdown.style.display = 'block';
    });
  }

  // ─── Keyboard Shortcuts ───
  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          const input = document.getElementById('global-search');
          if (input) input.focus();
        }
        if (e.key === '/') {
          e.preventDefault();
          if (typeof Copilot !== 'undefined') Copilot.toggle();
        }
      }
      if (e.key === 'Escape') {
        if (typeof Copilot !== 'undefined') Copilot.close();
        // Close any context menus
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
      }
    });
  }

  // ─── Scroll to Top ───
  function initScrollTop() {
    const btn = document.createElement('button');
    btn.className = 'scroll-top-btn';
    btn.innerHTML = '↑';
    btn.setAttribute('data-tooltip', 'Lên đầu trang');
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    });
  }

  // ─── Toast System ───
  function initToastContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.className = 'toast-container';
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ─── Context Menu ───
  function showContextMenu(x, y, items) {
    // Remove existing
    document.querySelectorAll('.context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    items.forEach(item => {
      if (item.divider) {
        menu.innerHTML += '<div class="context-menu-divider"></div>';
      } else {
        const div = document.createElement('div');
        div.className = 'context-menu-item';
        div.textContent = item.label;
        div.addEventListener('click', () => {
          menu.remove();
          if (item.action) item.action();
        });
        menu.appendChild(div);
      }
    });

    document.body.appendChild(menu);

    // Adjust if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 10);
  }

  // ─── Recent Patients ───
  function addRecentPatient(id, name) {
    let recent = JSON.parse(localStorage.getItem('careai_recent_patients') || '[]');
    recent = recent.filter(p => p.id !== id);
    recent.unshift({ id, name });
    recent = recent.slice(0, 5);
    localStorage.setItem('careai_recent_patients', JSON.stringify(recent));
  }

  function getRecentPatients() {
    return JSON.parse(localStorage.getItem('careai_recent_patients') || '[]');
  }

  // ─── Language Switch ───
  async function switchLang(lang) {
    if (typeof I18N !== 'undefined') {
      await I18N.switchLang(lang);
      const activePage = document.body.getAttribute('data-page') || 'dashboard';
      injectSidebar(activePage);
      if (typeof injectIcons === 'function') injectIcons();
    }
    document.querySelectorAll('.lang-switch button').forEach(b => {
      b.classList.toggle('active', b.textContent.trim() === lang.toUpperCase());
    });
  }

  return {
    checkAuth, logout, injectSidebar, switchLang, getInitials,
    showToast, showContextMenu, addRecentPatient, getRecentPatients
  };
})();
