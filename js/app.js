// ERP Sync - 2026-04-28
import { state, applyTheme, applyLang } from './state.js';
import { hideLoading } from './ui.js';
import { registerRoute, initRouter } from './router.js';
import { renderAuthPage, attachAuthEvents, initAuth } from './auth.js';
import { renderSidebar, renderHeader, attachLayoutEvents } from './components.js';
import { syncService } from './services/syncService.js';
import { academicService } from './services/academicService.js';
import { libraryService } from './services/libraryService.js';

// Import all page renderers
import { renderDashboard, attachDashboardEvents } from './pages/dashboard.js';
import { renderStudents, attachStudentEvents } from './pages/students.js';
import { renderTeachers, attachTeacherEvents } from './pages/teachers.js';
import { renderParents, attachParentEvents } from './pages/parents.js';
import { renderClasses, attachClassEvents } from './pages/classes.js';
import { renderAttendance, attachAttendanceEvents } from './pages/attendance.js';
import { renderGrades, attachGradeEvents } from './pages/grades.js';
import { renderSubjects, attachSubjectEvents } from './pages/subjects.js';
import { renderSchedule, attachScheduleEvents } from './pages/schedule.js?v=20260430-schedule-grid';
import { renderFinance, attachFinanceEvents } from './pages/finance.js';
import { renderAnnouncements, attachAnnouncementEvents, renderMessages, attachMessageEvents, renderSettings, attachSettingsEvents } from './pages/communications.js';
import { renderAdmissions, attachAdmissionsEvents } from './pages/admissions.js';
import { renderAcademicAlerts, attachAcademicAlertsEvents } from './pages/academicAlerts.js';
import { renderHR, attachHREvents } from './pages/hr.js';
import { renderLibrary, attachLibraryEvents } from './pages/library.js';
import { renderHostel, attachHostelEvents } from './pages/hostel.js';
import { renderStudentProfile, attachStudentProfileEvents } from './pages/studentProfile.js';
import { renderParentProfile, attachParentProfileEvents } from './pages/parentProfile.js';
import { attachTeacherProfileEvents } from './pages/teacherProfile.js?v=20260430-fix-loading';

// ========================= APPLY INITIAL SETTINGS =========================
applyTheme();
applyLang();

// ========================= PAGE REGISTRY =========================
const pages = {
  dashboard:      { render: renderDashboard, events: attachDashboardEvents },
  students:       { render: renderStudents, events: attachStudentEvents },
  teachers:       { render: renderTeachers, events: attachTeacherEvents },
  parents:        { render: renderParents, events: attachParentEvents },
  classes:        { render: renderClasses, events: attachClassEvents },
  attendance:     { render: renderAttendance, events: attachAttendanceEvents },
  grades:         { render: renderGrades, events: attachGradeEvents },
  subjects:       { render: renderSubjects, events: attachSubjectEvents },
  schedule:       { render: renderSchedule, events: attachScheduleEvents },
  finance:        { render: renderFinance, events: attachFinanceEvents },
  announcements:  { render: renderAnnouncements, events: attachAnnouncementEvents },
  messages:       { render: renderMessages, events: attachMessageEvents },
  admissions:     { render: renderAdmissions, events: attachAdmissionsEvents },
  'academic-alerts': { render: renderAcademicAlerts, events: attachAcademicAlertsEvents },
  hr:             { render: renderHR, events: attachHREvents },
  library:         { render: renderLibrary, events: attachLibraryEvents },
  hostel:          { render: renderHostel, events: attachHostelEvents },
  'student-profile': { render: renderStudentProfile, events: attachStudentProfileEvents },
  'parent-profile': { render: renderParentProfile, events: attachParentProfileEvents },
  settings:        { render: renderSettings, events: (renderApp) => attachSettingsEvents(renderApp) },
};

pages['my-children'] = pages.dashboard;

// ========================= RENDER APP =========================
let currentLayout = null; // Track current layout type (auth or app)

function renderApp() {
  const app = document.getElementById('app');
  
  // Handle Auth State
  if (!state.user || !state.profile) {
    if (currentLayout !== 'auth') {
      app.innerHTML = renderAuthPage();
      attachAuthEvents();
      currentLayout = 'auth';
    }
    return;
  }

  // Determine current page
  const currentHash = window.location.hash.slice(1) || 'dashboard';
  const basePath = currentHash.split('?')[0];
  let page = pages[basePath] || pages.dashboard;

  // Route Guard
  const adminOnlyPages = ['admissions', 'settings', 'hr'];
  if (adminOnlyPages.includes(basePath) && state.profile.role !== 'admin') {
    page = pages.dashboard;
    window.location.hash = 'dashboard';
  }

  // Render Full Layout if needed
  if (currentLayout !== 'app') {
    app.innerHTML = `
      <div class="app-layout ${state.sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}">
        ${renderSidebar()}
        <div class="main-area">
          ${renderHeader()}
          <main class="main-content" id="main-content"></main>
        </div>
      </div>`;
    attachLayoutEvents(renderApp);
    currentLayout = 'app';
  }

  // Render Page Content — محاطة بـ Error Boundary
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    try {
      mainContent.innerHTML = page.render();
    } catch (renderErr) {
      console.error('[App] Page render error:', renderErr);
      mainContent.innerHTML = renderErrorBoundary(renderErr, basePath, state.lang);
      return;
    }

    try {
      // Attach Page Events
      if (typeof page.events === 'function') {
        if (basePath === 'settings') page.events(renderApp);
        else page.events();
      }
      // Global profile events (tab switching etc)
      attachStudentProfileEvents();
      attachParentProfileEvents();
      attachTeacherProfileEvents();
    } catch (eventsErr) {
      console.error('[App] Page events error:', eventsErr);
    }
  }
}

/** Renders a friendly error page when a page crashes */
function renderErrorBoundary(err, page, lang) {
  return `
  <div class="page-content animate-in" style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
    <div class="glass-card" style="padding:2.5rem;text-align:center;max-width:480px;">
      <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
      <h3 style="color:var(--danger);margin-bottom:.75rem;">
        ${lang === 'ar' ? 'حدث خطأ في تحميل الصفحة' : 'Page failed to load'}
      </h3>
      <p class="text-muted" style="margin-bottom:1.5rem;font-size:.85rem;">
        ${lang === 'ar' ? `الصفحة: ${page}` : `Page: ${page}`}<br>
        <code style="opacity:.6;">${err?.message || ''}</code>
      </p>
      <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="window.location.hash='dashboard'">
          ${lang === 'ar' ? '🏠 الرئيسية' : '🏠 Dashboard'}
        </button>
        <button class="btn btn-outline" onclick="window.location.reload()">
          ${lang === 'ar' ? '🔄 إعادة التحميل' : '🔄 Reload'}
        </button>
      </div>
    </div>
  </div>`;
}

// ========================= INITIALIZATION =========================

// Register all routes
Object.keys(pages).forEach(path => {
  registerRoute(path, () => {
    state.currentPage = path;
    syncService.syncPage(path); // Sync only when route changes
    renderApp();
  });
});

// Start Router
initRouter();

// Subscribe to state changes — only re-render page CONTENT, not full app
let _isRendering = false;
let _renderTimer = null;
state.subscribe(() => {
  if (!state.user || !state.profile) return;
  if (_isRendering) return; // Guard against recursive renders
  // Debounce rapid state updates to avoid excessive DOM thrashing
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(() => {
    _isRendering = true;
    try {
      const mainContent = document.getElementById('main-content');
      if (!mainContent) return;
      const currentHash = window.location.hash.slice(1) || 'dashboard';
      const basePath = currentHash.split('?')[0];
      const page = pages[basePath] || pages.dashboard;
      try {
        mainContent.innerHTML = page.render();
      } catch (renderErr) {
        console.error('[App] State-triggered render error:', renderErr);
        mainContent.innerHTML = renderErrorBoundary(renderErr, basePath, state.lang);
        return;
      }
      try {
        if (typeof page.events === 'function') {
          if (basePath === 'settings') page.events(renderApp);
          else page.events();
        }
        attachStudentProfileEvents();
        attachParentProfileEvents();
        attachTeacherProfileEvents();
      } catch (evErr) {
        console.error('[App] State-triggered events error:', evErr);
      }
    } finally {
      _isRendering = false;
    }
  }, 50);
});

// Init Auth
initAuth(
  () => { // onLogin
    const route = window.location.hash.slice(1) || 'dashboard';
    state.currentPage = route;
    syncService.syncPage(route); // Initial sync on login
    if (state.profile?.role === 'admin') {
        academicService.seedAssessmentTypes();
        libraryService.processOverdueFees();
    }
    renderApp();
  },
  () => { // onLogout
    syncService.stopAll();
    currentLayout = null;
    renderApp();
  }
);
