import { state, t, toggleTheme, toggleLang } from './state.js';
import { navigate } from './router.js';
import { logout } from './auth.js';
import { showConfirm, getInitials } from './ui.js';

// ========================= SIDEBAR NAV CONFIG =========================
function getNavItems() {
  const role = state.profile?.role || 'student';

  const adminNav = [
    { icon: 'D', key: 'dashboard', page: 'dashboard' },
    { icon: 'S', key: 'students', page: 'students' },
    { icon: 'T', key: 'teachers', page: 'teachers' },
    { icon: 'P', key: 'parents', page: 'parents' },
    { icon: 'C', key: 'classes', page: 'classes' },
    { icon: 'B', key: 'subjects', page: 'subjects' },
    { icon: 'A', key: 'attendance', page: 'attendance' },
    { icon: 'G', key: 'grades', page: 'grades' },
    { icon: 'L', key: 'schedule', page: 'schedule' },
    { icon: '!', key: 'academicAlerts', page: 'academic-alerts' },
  ];

  if (state.modules?.hr?.enabled) adminNav.push({ icon: 'H', key: 'hr', page: 'hr' });
  if (state.modules?.library?.enabled) adminNav.push({ icon: 'R', key: 'library', page: 'library' });
  if (state.modules?.hostel?.enabled) adminNav.push({ icon: 'M', key: 'hostel', page: 'hostel' });
  if (state.modules?.admissions?.enabled) adminNav.push({ icon: '+', key: 'admissions', page: 'admissions' });
  if (state.modules?.finance?.enabled) adminNav.push({ icon: 'F', key: 'finance', page: 'finance' });
  if (state.modules?.communications?.enabled) {
    adminNav.push({ icon: 'N', key: 'announcements', page: 'announcements' });
    adminNav.push({ icon: '@', key: 'messages', page: 'messages' });
  }
  adminNav.push({ icon: '*', key: 'settings', page: 'settings' });

  const teacherNav = [
    { icon: 'D', key: 'dashboard', page: 'dashboard' },
    { icon: 'C', key: 'myClasses', page: 'classes' },
    { icon: 'A', key: 'attendance', page: 'attendance' },
    { icon: 'G', key: 'grades', page: 'grades' },
    { icon: 'L', key: 'mySchedule', page: 'schedule' },
    { icon: '!', key: 'academicAlerts', page: 'academic-alerts' },
  ];
  if (state.modules?.communications?.enabled) teacherNav.push({ icon: '@', key: 'messages', page: 'messages' });

  const parentNav = [
    { icon: 'D', key: 'dashboard', page: 'dashboard' },
    { icon: 'S', key: 'myChildren', page: 'my-children' },
    { icon: 'G', key: 'grades', page: 'grades' },
    { icon: 'A', key: 'attendance', page: 'attendance' },
    { icon: 'L', key: 'schedule', page: 'schedule' },
  ];
  if (state.modules?.finance?.enabled) parentNav.push({ icon: 'F', key: 'finance', page: 'finance' });
  if (state.modules?.communications?.enabled) parentNav.push({ icon: '@', key: 'messages', page: 'messages' });

  const studentNav = [
    { icon: 'D', key: 'dashboard', page: 'dashboard' },
    { icon: 'L', key: 'mySchedule', page: 'schedule' },
    { icon: 'G', key: 'myGrades', page: 'grades' },
    { icon: 'R', key: 'library', page: 'library' },
  ];

  return { admin: adminNav, teacher: teacherNav, parent: parentNav, student: studentNav }[role] || studentNav;
}

// ========================= RENDER SIDEBAR =========================
export function renderSidebar() {
  const role = state.profile?.role || 'student';
  const items = getNavItems();
  const roleBadge = { admin: '🔴', teacher: '🟢', parent: '🔵', student: '🟡' };
  
  return `
  <aside class="sidebar ${state.sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}" id="sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="url(#sg)"/>
              <path d="M14 34V20l10-8 10 8v14H28v-8h-8v8H14z" fill="white"/>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
            </svg>
          </div>
          <div class="brand-text">
            <h2>EduManage</h2>
            <span class="brand-badge">${roleBadge[role]} ${t(role)}</span>
          </div>
        </div>
        <button class="btn-icon sidebar-close-btn" id="sidebar-close">✕</button>
      </div>
      <nav class="sidebar-nav">
        ${items.map(item => `
          <a class="nav-item ${state.currentPage === item.page ? 'active' : ''}" data-page="${item.page}" href="#${item.page}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${t(item.key)}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar avatar-sm">${state.profile?.avatar ? `<img src="${state.profile.avatar}" alt="">` : getInitials(state.profile?.name)}</div>
          <div class="user-info">
            <span class="user-name">${state.profile?.name || ''}</span>
            <span class="user-email">${state.profile?.email || ''}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
  <div class="sidebar-overlay ${state.sidebarOpen ? '' : 'hidden'}" id="sidebar-overlay"></div>`;
}

// ========================= RENDER HEADER =========================
export function renderHeader() {
  return `
  <header class="header" id="header">
    <div class="header-start">
      <button class="btn-icon hamburger" id="sidebar-toggle">☰</button>
      <h1 class="header-title">${t(state.currentPage.replace('-', '') || 'dashboard')}</h1>
    </div>
    <div class="header-search-wrap" id="header-search-wrap">
      <div class="header-search-box">
        <span class="search-icon-inner">🔍</span>
        <input type="text" id="global-search-input" class="global-search-input"
          placeholder="${state.lang === 'ar' ? 'بحث عن طالب، معلم، صف...' : 'Search students, teachers, classes...'}"
          autocomplete="off">
        <button class="search-clear-btn hidden" id="search-clear-btn">✕</button>
      </div>
      <div class="global-search-dropdown hidden" id="global-search-dropdown"></div>
    </div>
    <div class="header-end">
      <button class="btn-icon header-action" id="toggle-lang-btn" title="${state.lang === 'ar' ? 'English' : 'عربي'}">
        ${state.lang === 'ar' ? 'EN' : 'ع'}
      </button>
      <button class="btn-icon header-action" id="toggle-theme-btn" title="${state.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}">
        ${state.theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button class="btn-icon header-action" id="notif-btn" title="${state.lang === 'ar' ? 'الإشعارات' : 'Notifications'}">
        🔔<span class="notif-badge" id="notif-count"></span>
      </button>
      <div class="header-user" id="header-user-menu">
        <div class="avatar avatar-sm">${state.profile?.avatar ? `<img src="${state.profile.avatar}" alt="">` : getInitials(state.profile?.name)}</div>
      </div>
    </div>
  </header>`;
}

// ========================= ATTACH LAYOUT EVENTS =========================
export function attachLayoutEvents(renderApp) {
  const setSidebarState = (isOpen) => {
    state.sidebarOpen = isOpen;
    document.querySelector('.app-layout')?.classList.toggle('sidebar-expanded', isOpen);
    document.querySelector('.app-layout')?.classList.toggle('sidebar-collapsed', !isOpen);
    document.getElementById('sidebar')?.classList.toggle('sidebar-open', isOpen);
    document.getElementById('sidebar')?.classList.toggle('sidebar-closed', !isOpen);
    document.getElementById('sidebar-overlay')?.classList.toggle('hidden', !isOpen);
  };

  // Sidebar toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    setSidebarState(!state.sidebarOpen);
  });
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    setSidebarState(false);
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    setSidebarState(false);
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
      if (window.innerWidth <= 768) {
        setSidebarState(false);
      }
    });
  });

  // Theme & Lang toggles
  document.getElementById('toggle-theme-btn')?.addEventListener('click', () => { toggleTheme(); renderApp(); });
  document.getElementById('toggle-lang-btn')?.addEventListener('click', () => { toggleLang(); renderApp(); });

  // User menu
  document.getElementById('header-user-menu')?.addEventListener('click', () => {
    showConfirm(t('logout'), state.lang === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Do you want to logout?', () => logout(), 'warning');
  });

  // ========================= GLOBAL SEARCH =========================
  const searchInput   = document.getElementById('global-search-input');
  const dropdown      = document.getElementById('global-search-dropdown');
  const clearBtn      = document.getElementById('search-clear-btn');

  if (!searchInput) return;

  let _searchTimer = null;

  function doSearch(query) {
    const q = query.trim().toLowerCase();
    dropdown.innerHTML = '';

    if (!q) {
      dropdown.classList.add('hidden');
      clearBtn.classList.add('hidden');
      return;
    }

    clearBtn.classList.remove('hidden');

    // --- Search across students, teachers, classes ---
    const results = [];

    // Students
    (state.students || []).forEach(s => {
      if ((s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)) {
        results.push({ type: 'student', icon: '🎓', label: s.name, sub: s.grade || s.email || '', page: 'student-profile', id: s.id });
      }
    });

    // Teachers
    (state.teachers || []).forEach(tc => {
      if ((tc.name || '').toLowerCase().includes(q) || (tc.subject || '').toLowerCase().includes(q)) {
        results.push({ type: 'teacher', icon: '👨‍🏫', label: tc.name, sub: tc.subject || tc.email || '', page: 'teachers', id: tc.id });
      }
    });

    // Classes
    (state.classes || []).forEach(cl => {
      if ((cl.name || '').toLowerCase().includes(q)) {
        results.push({ type: 'class', icon: '🏫', label: cl.name, sub: state.lang === 'ar' ? 'صف دراسي' : 'Class', page: 'classes', id: cl.id });
      }
    });

    // Parents
    (state.parents || []).forEach(p => {
      if ((p.name || '').toLowerCase().includes(q)) {
        results.push({ type: 'parent', icon: '👨‍👩‍👧', label: p.name, sub: p.email || '', page: 'parent-profile', id: p.id });
      }
    });

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="search-no-results">${state.lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    // Cap to 8 results
    const shown = results.slice(0, 8);
    dropdown.innerHTML = shown.map(r => `
      <div class="search-result-item" data-page="${r.page}" data-id="${r.id}" data-type="${r.type}">
        <span class="search-result-icon">${r.icon}</span>
        <div class="search-result-text">
          <span class="search-result-label">${r.label}</span>
          <span class="search-result-sub">${r.sub}</span>
        </div>
        <span class="search-result-type-badge">${state.lang === 'ar'
          ? { student: 'طالب', teacher: 'معلم', class: 'صف', parent: 'ولي أمر' }[r.type]
          : { student: 'Student', teacher: 'Teacher', class: 'Class', parent: 'Parent' }[r.type]
        }</span>
      </div>`).join('');

    if (results.length > 8) {
      dropdown.innerHTML += `<div class="search-more">${state.lang === 'ar' ? `و ${results.length - 8} نتيجة أخرى` : `and ${results.length - 8} more`}</div>`;
    }

    dropdown.classList.remove('hidden');

    // Attach click handlers on result rows
    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const page = el.dataset.page;
        const id   = el.dataset.id;
        const type = el.dataset.type;
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        dropdown.classList.add('hidden');
        // Navigate — for profile pages pass id in hash
        if ((type === 'student' || type === 'parent') && id) {
          navigate(page + '?id=' + id);
        } else {
          navigate(page);
        }
      });
    });
  }

  searchInput.addEventListener('input', e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => doSearch(e.target.value), 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) dropdown.classList.remove('hidden');
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    dropdown.classList.add('hidden');
    searchInput.focus();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', e => {
    if (!document.getElementById('header-search-wrap')?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }, { capture: true });

  // Keyboard: Escape closes, Arrow keys navigate results
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      searchInput.blur();
      return;
    }
    const items = dropdown.querySelectorAll('.search-result-item');
    if (!items.length) return;
    const focused = dropdown.querySelector('.search-result-item.focused');
    let idx = focused ? [...items].indexOf(focused) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (focused) focused.classList.remove('focused');
      idx = (idx + 1) % items.length;
      items[idx].classList.add('focused');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focused) focused.classList.remove('focused');
      idx = (idx - 1 + items.length) % items.length;
      items[idx].classList.add('focused');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault();
      focused.click();
    }
  });
}
