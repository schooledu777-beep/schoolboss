import { state, t, toggleTheme, toggleLang } from './state.js';
import { navigate } from './router.js';
import { logout } from './auth.js';
import { showConfirm, getInitials } from './ui.js';

// ========================= SIDEBAR NAV CONFIG =========================
function getNavGroups() {
  const role = state.profile?.role || 'student';

  // ── ADMIN ──────────────────────────────────────────────────────────
  if (role === 'admin') {
    const groups = [
      {
        labelAr: 'الرئيسية', labelEn: 'Home',
        items: [
          { icon: '📊', key: 'dashboard', page: 'dashboard' },
        ]
      },
      {
        labelAr: 'المجتمع المدرسي', labelEn: 'School Community',
        items: [
          { icon: '🎓', key: 'students', page: 'students' },
          { icon: '👨‍🏫', key: 'teachers', page: 'teachers' },
          { icon: '👨‍👩‍👧', key: 'parents', page: 'parents' },
        ]
      },
      {
        labelAr: 'الشؤون الأكاديمية', labelEn: 'Academic',
        items: [
          { icon: '🏫', key: 'classes',        page: 'classes'         },
          { icon: '📚', key: 'subjects',       page: 'subjects'        },
          { icon: '🗺️', key: 'annualPlan',    page: 'annual-plan'    },
          { icon: '✅', key: 'attendance',     page: 'attendance'      },
          { icon: '📅', key: 'schedule',       page: 'schedule'        },
          { icon: '📋', key: 'examsPage',      page: 'exams'           },
          { icon: '📄', key: 'reportCards',    page: 'report-cards'    },
          { icon: '📆', key: 'calendar',       page: 'calendar'        },
          { icon: '📚', key: 'homeworkPage',   page: 'homework'        },
          { icon: '⚠️', key: 'academicAlerts', page: 'academic-alerts' },
        ]
      },
    ];

    // Optional services group
    const serviceItems = [];
    if (state.modules?.hr?.enabled)             serviceItems.push({ icon: '👥', key: 'hr',             page: 'hr'             });
    if (state.modules?.library?.enabled)        serviceItems.push({ icon: '📖', key: 'library',        page: 'library'        });
    if (state.modules?.hostel?.enabled)         serviceItems.push({ icon: '🏠', key: 'hostel',         page: 'hostel'         });
    if (state.modules?.admissions?.enabled)     serviceItems.push({ icon: '📋', key: 'admissions',     page: 'admissions'     });
    if (state.modules?.transportation?.enabled) serviceItems.push({ icon: '🚌', key: 'transportation', page: 'transportation' });
    if (state.modules?.clinic?.enabled)         serviceItems.push({ icon: '🏥', key: 'clinicPage',     page: 'clinic'         });
    if (state.modules?.inventory?.enabled)      serviceItems.push({ icon: '📦', key: 'inventory',      page: 'inventory'      });
    if (serviceItems.length)
      groups.push({ labelAr: 'الخدمات', labelEn: 'Services', items: serviceItems });

    // Optional finance & comms group
    const commItems = [];
    if (state.modules?.finance?.enabled)        commItems.push({ icon: '💰', key: 'finance', page: 'finance' });
    if (state.modules?.communications?.enabled) {
      commItems.push({ icon: '📢', key: 'announcements', page: 'announcements' });
      commItems.push({ icon: '✉️', key: 'messages', page: 'messages' });
      if (state.profile?.role === 'admin') commItems.push({ icon: '📨', key: 'notificationOutbox', page: 'notification-outbox' });
    }
    if (commItems.length)
      groups.push({ labelAr: 'المالية والتواصل', labelEn: 'Finance & Comms', items: commItems });

    // System always last
    groups.push({
      labelAr: 'النظام', labelEn: 'System',
      items: [
        { icon: '📊', key: 'analytics', page: 'analytics'  },
        { icon: '🔍', key: 'auditLog',  page: 'audit-log'  },
        { icon: '⚙️', key: 'settings',  page: 'settings'   },
      ]
    });

    return groups;
  }

  // ── TEACHER ────────────────────────────────────────────────────────
  if (role === 'teacher') {
    const groups = [
      {
        labelAr: 'الرئيسية', labelEn: 'Home',
        items: [{ icon: '📊', key: 'dashboard', page: 'dashboard' }]
      },
      {
        labelAr: 'الفصول الدراسية', labelEn: 'Classroom',
        items: [
          { icon: '🏫', key: 'myClasses',    page: 'classes'      },
          { icon: '🗺️', key: 'annualPlan',  page: 'annual-plan' },
          { icon: '✅', key: 'attendance',   page: 'attendance'   },
          { icon: '📄', key: 'reportCards',  page: 'report-cards' },
          { icon: '📋', key: 'examsPage',    page: 'exams'        },
          { icon: '📚', key: 'homeworkPage', page: 'homework'     },
          { icon: '📅', key: 'mySchedule',   page: 'schedule'     },
          { icon: '📆', key: 'calendar',     page: 'calendar'     },
        ]
      },
      {
        labelAr: 'المتابعة', labelEn: 'Follow-up',
        items: [
          { icon: '⚠️', key: 'academicAlerts', page: 'academic-alerts' },
          ...(state.modules?.clinic?.enabled ? [{ icon: '🩺', key: 'clinicPage', page: 'clinic' }] : []),
        ]
      },
    ];
    if (state.modules?.communications?.enabled)
      groups.push({ labelAr: 'التواصل', labelEn: 'Communication', items: [{ icon: '✉️', key: 'messages', page: 'messages' }] });
    return groups;
  }

  // ── PARENT ─────────────────────────────────────────────────────────
  if (role === 'parent') {
    const groups = [
      {
        labelAr: 'الرئيسية', labelEn: 'Home',
        items: [{ icon: '📊', key: 'dashboard', page: 'dashboard' }]
      },
      {
        labelAr: 'أبنائي', labelEn: 'My Children',
        items: [
          { icon: '👨‍👩‍👧', key: 'myChildren',   page: 'my-children'  },
          { icon: '✅', key: 'attendance',     page: 'attendance'   },
          { icon: '📄', key: 'reportCards',  page: 'report-cards' },
          { icon: '📋', key: 'examsPage',      page: 'exams'        },
          { icon: '📚', key: 'homeworkPage',   page: 'homework'     },
          { icon: '📅', key: 'schedule',       page: 'schedule'     },
          { icon: '📆', key: 'calendar',       page: 'calendar'     },
        ]
      },
    ];
    if (state.modules?.finance?.enabled)
      groups.push({ labelAr: 'المالية', labelEn: 'Finance', items: [{ icon: '💰', key: 'finance', page: 'finance' }] });
    if (state.modules?.communications?.enabled)
      groups.push({ labelAr: 'التواصل', labelEn: 'Communication', items: [{ icon: '✉️', key: 'messages', page: 'messages' }] });
    return groups;
  }

  // ── STUDENT ────────────────────────────────────────────────────────
  return [
    {
      labelAr: 'الرئيسية', labelEn: 'Home',
      items: [{ icon: '📊', key: 'dashboard', page: 'dashboard' }]
    },
    {
      labelAr: 'دراستي', labelEn: 'My Studies',
      items: [
        { icon: '📅', key: 'mySchedule', page: 'schedule' },
        { icon: '📄', key: 'reportCards', page: 'report-cards' },
        { icon: '📖', key: 'library', page: 'library' },
      ]
    },
  ];
}

// Flatten groups → flat item list (used by bottom nav)
function flattenGroups(groups) {
  return groups.flatMap(g => g.items);
}

// ========================= NAV GROUP COLLAPSE (persisted) =========================
const NAV_COLLAPSE_KEY = () => `sms-nav-collapsed-${state.profile?.role || 'student'}`;

function getCollapsedGroups() {
  try { return JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY()) || '[]'); }
  catch { return []; }
}

// Called from inline onclick — toggles one group by index
window.toggleNavGroup = function(idx) {
  let collapsed = getCollapsedGroups();
  const isNowCollapsed = collapsed.includes(idx);
  if (isNowCollapsed) {
    collapsed = collapsed.filter(i => i !== idx);
  } else {
    collapsed.push(idx);
  }
  localStorage.setItem(NAV_COLLAPSE_KEY(), JSON.stringify(collapsed));
  // Toggle class directly on DOM (no full re-render needed)
  const group = document.querySelectorAll('.sidebar-nav .nav-group')[idx];
  if (group) group.classList.toggle('collapsed', !isNowCollapsed);
};

// ========================= RENDER SIDEBAR =========================
export function renderSidebar() {
  const role = state.profile?.role || 'student';
  const groups = getNavGroups();
  const allItems = flattenGroups(groups);
  const roleBadge = { admin: '🔴', teacher: '🟢', parent: '🔵', student: '🟡' };
  const isAr = state.lang === 'ar';
  const collapsed = getCollapsedGroups();

  const navGroupsHtml = groups.map((group, idx) => {
    const isCollapsed = collapsed.includes(idx);
    return `
    <div class="nav-group ${idx > 0 ? 'nav-group-divided' : ''} ${isCollapsed ? 'collapsed' : ''}">
      <span class="nav-group-label" onclick="window.toggleNavGroup(${idx})">${isAr ? group.labelAr : group.labelEn}</span>
      <div class="nav-group-items">
        <div class="nav-group-items-inner">
          ${group.items.map(item => `
            <a class="nav-item ${state.currentPage === item.page ? 'active' : ''}" data-page="${item.page}" href="#${item.page}">
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${t(item.key)}</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>`;
  }).join('');

  // Bottom nav: dashboard + next 4 most important items (skipping Settings)
  const bottomItems = allItems.filter(i => i.page !== 'settings').slice(0, 5);

  return `
  <aside class="sidebar ${state.sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}" id="sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-icon"><img src="assets/edumanage-mark.svg" alt="EduManage"></div>
          <div class="brand-text">
            <h2>EduManage</h2>
            <span class="brand-badge">${roleBadge[role]} ${t(role)}</span>
          </div>
        </div>
        <button class="btn-icon sidebar-close-btn" id="sidebar-close">✕</button>
      </div>
      <nav class="sidebar-nav">
        ${navGroupsHtml}
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
  <div class="sidebar-overlay ${state.sidebarOpen ? '' : 'hidden'}" id="sidebar-overlay"></div>
  <nav class="mobile-bottom-nav" id="mobile-bottom-nav">
    ${bottomItems.map(item => `
      <a class="mbn-item ${state.currentPage === item.page ? 'active' : ''}" data-page="${item.page}" href="#${item.page}">
        <span class="mbn-icon">${item.icon}</span>
        <span class="mbn-label">${t(item.key)}</span>
      </a>
    `).join('')}
    <button class="mbn-item" id="mbn-more-btn">
      <span class="mbn-icon">☰</span>
      <span class="mbn-label">${isAr ? 'المزيد' : 'More'}</span>
    </button>
  </nav>`;
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
      if (window.innerWidth <= 1024) {
        setSidebarState(false);
      }
    });
  });

  // Theme & Lang toggles
  document.getElementById('toggle-theme-btn')?.addEventListener('click', () => { toggleTheme(); renderApp(); });
  document.getElementById('toggle-lang-btn')?.addEventListener('click', () => { toggleLang(); renderApp(); });

  // Mobile bottom nav
  document.querySelectorAll('.mbn-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });
  document.getElementById('mbn-more-btn')?.addEventListener('click', () => {
    setSidebarState(true);
  });

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
      el.addEventListener('click', async () => {
        const page = el.dataset.page;
        const id   = el.dataset.id;
        const type = el.dataset.type;
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        dropdown.classList.add('hidden');
        // Navigate — for profile pages pass id in hash
        if (type === 'student' && id) {
          const { showStudentCardModal } = await import('./pages/students.js?v=20260502-search-cards');
          showStudentCardModal(id);
          return;
        }

        if (type === 'teacher' && id) {
          const { showTeacherCard } = await import('./pages/teachers.js?v=20260502-search-cards');
          showTeacherCard(id);
          return;
        }

        if (type === 'parent' && id) {
          const { showParentCardModal } = await import('./pages/parentProfile.js?v=20260502-search-cards');
          showParentCardModal(id);
          return;
        }

        navigate(page);
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
