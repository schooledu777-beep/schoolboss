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
  // Sidebar toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    state.sidebarOpen = !state.sidebarOpen;
    document.getElementById('sidebar')?.classList.toggle('sidebar-open', state.sidebarOpen);
    document.getElementById('sidebar')?.classList.toggle('sidebar-closed', !state.sidebarOpen);
    document.getElementById('sidebar-overlay')?.classList.toggle('hidden', !state.sidebarOpen);
  });
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    state.sidebarOpen = false;
    document.getElementById('sidebar')?.classList.add('sidebar-closed');
    document.getElementById('sidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    state.sidebarOpen = false;
    document.getElementById('sidebar')?.classList.add('sidebar-closed');
    document.getElementById('sidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
      if (window.innerWidth <= 768) {
        state.sidebarOpen = false;
        document.getElementById('sidebar')?.classList.add('sidebar-closed');
        document.getElementById('sidebar')?.classList.remove('sidebar-open');
        document.getElementById('sidebar-overlay')?.classList.add('hidden');
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
}
