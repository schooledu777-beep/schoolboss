import { state, applyTheme, applyLang } from './state.js';
import { registerRoute, initRouter } from './router.js';
import { renderAuthPage, attachAuthEvents, initAuth } from './auth.js?v=20260628-perf2';
import { renderSidebar, renderHeader, attachLayoutEvents } from './components.js?v=20260628-perf2';
import { syncService } from './services/syncService.js?v=20260628-perf2';

applyTheme();
applyLang();

function lazyPage(load, renderName, eventsName) {
  return async () => {
    const module = await load();
    return {
      render: module[renderName],
      events: eventsName ? module[eventsName] : null,
    };
  };
}

const pageLoaders = {
  dashboard: lazyPage(
    () => import('./pages/dashboard.js?v=20260628-perf2'),
    'renderDashboard',
    'attachDashboardEvents'
  ),
  students: lazyPage(() => import('./pages/students.js?v=20260628-perf1'), 'renderStudents', 'attachStudentEvents'),
  teachers: lazyPage(() => import('./pages/teachers.js?v=20260628-perf1'), 'renderTeachers', 'attachTeacherEvents'),
  parents: lazyPage(() => import('./pages/parents.js?v=20260628-perf1'), 'renderParents', 'attachParentEvents'),
  classes: lazyPage(() => import('./pages/classes.js?v=20260628-perf1'), 'renderClasses', 'attachClassEvents'),
  attendance: lazyPage(() => import('./pages/attendance.js?v=20260628-perf1'), 'renderAttendance', 'attachAttendanceEvents'),
  grades: lazyPage(() => import('./pages/reportCards.js?v=20260628-perf1'), 'renderReportCards', 'attachReportCardsEvents'),
  subjects: lazyPage(() => import('./pages/subjects.js?v=20260628-perf1'), 'renderSubjects', 'attachSubjectEvents'),
  'annual-plan': lazyPage(() => import('./pages/annualPlan.js?v=20260628-perf1'), 'renderAnnualPlan', 'attachAnnualPlanEvents'),
  schedule: lazyPage(() => import('./pages/schedule.js?v=20260628-perf1'), 'renderSchedule', 'attachScheduleEvents'),
  finance: lazyPage(() => import('./pages/finance.js?v=20260628-perf1'), 'renderFinance', 'attachFinanceEvents'),
  announcements: lazyPage(() => import('./pages/communications.js?v=20260628-perf1'), 'renderAnnouncements', 'attachAnnouncementEvents'),
  messages: lazyPage(() => import('./pages/communications.js?v=20260628-perf1'), 'renderMessages', 'attachMessageEvents'),
  settings: lazyPage(() => import('./pages/communications.js?v=20260628-perf1'), 'renderSettings', 'attachSettingsEvents'),
  admissions: lazyPage(() => import('./pages/admissions.js?v=20260628-perf1'), 'renderAdmissions', 'attachAdmissionsEvents'),
  'academic-alerts': lazyPage(() => import('./pages/academicAlerts.js?v=20260628-perf1'), 'renderAcademicAlerts', 'attachAcademicAlertsEvents'),
  hr: lazyPage(() => import('./pages/hr.js?v=20260628-perf1'), 'renderHR', 'attachHREvents'),
  library: lazyPage(() => import('./pages/library.js?v=20260628-perf1'), 'renderLibrary', 'attachLibraryEvents'),
  hostel: lazyPage(() => import('./pages/hostel.js?v=20260628-perf1'), 'renderHostel', 'attachHostelEvents'),
  transportation: lazyPage(() => import('./pages/transportation.js?v=20260628-perf1'), 'renderTransportation', 'attachTransportationEvents'),
  'student-profile': lazyPage(() => import('./pages/studentProfile.js?v=20260628-perf1'), 'renderStudentProfile', 'attachStudentProfileEvents'),
  'parent-profile': lazyPage(() => import('./pages/parentProfile.js?v=20260628-perf1'), 'renderParentProfile', 'attachParentProfileEvents'),
  'report-cards': lazyPage(() => import('./pages/reportCards.js?v=20260628-perf1'), 'renderReportCards', 'attachReportCardsEvents'),
  calendar: lazyPage(() => import('./pages/calendar.js?v=20260628-perf1'), 'renderCalendar', 'attachCalendarEvents'),
  homework: lazyPage(() => import('./pages/homeworkPage.js?v=20260628-perf1'), 'renderHomework', 'attachHomeworkEvents'),
  clinic: lazyPage(() => import('./pages/clinicPage.js?v=20260628-perf1'), 'renderClinic', 'attachClinicEvents'),
  exams: lazyPage(() => import('./pages/examsPage.js?v=20260628-perf1'), 'renderExams', 'attachExamsEvents'),
  analytics: lazyPage(() => import('./pages/analytics.js?v=20260628-perf1'), 'renderAnalytics', 'attachAnalyticsEvents'),
  'audit-log': lazyPage(() => import('./pages/auditLog.js?v=20260628-perf1'), 'renderAuditLog', 'attachAuditLogEvents'),
  inventory: lazyPage(() => import('./pages/inventory.js?v=20260628-perf1'), 'renderInventory', 'attachInventoryEvents'),
  'setup-wizard': lazyPage(() => import('./pages/setupWizard.js?v=20260628-perf2'), 'renderSetupWizard', 'attachSetupWizardEvents'),
  'notification-outbox': lazyPage(
    () => import('./pages/notificationOutbox.js?v=20260628-perf1'),
    'renderNotificationOutbox',
    'attachNotificationOutboxEvents'
  ),
  'super-admin': lazyPage(() => import('./pages/superAdmin.js?v=20260628-perf2'), 'renderSuperAdmin', 'attachSuperAdminEvents'),
};

pageLoaders['my-children'] = pageLoaders.dashboard;

const pageCache = new Map();
let currentLayout = null;
let renderSequence = 0;

async function getPage(path) {
  const resolvedPath = pageLoaders[path] ? path : 'dashboard';
  if (!pageCache.has(resolvedPath)) {
    const loadingPage = pageLoaders[resolvedPath]().catch(error => {
      pageCache.delete(resolvedPath);
      throw error;
    });
    pageCache.set(resolvedPath, loadingPage);
  }
  return pageCache.get(resolvedPath);
}

function isSetupLocked() {
  if (!state.isSuperAdmin && state.profile?.role === 'admin' && state.setup?.completed === false) return true;
  return !state.isSuperAdmin && !state.tenantId;
}

function renderPageLoading() {
  return `
    <div class="page-content" style="display:grid;place-items:center;min-height:45vh">
      <div class="loader-ring" aria-label="${state.lang === 'ar' ? 'جاري تحميل الصفحة' : 'Loading page'}"></div>
    </div>`;
}

async function renderApp() {
  const sequence = ++renderSequence;
  const app = document.getElementById('app');
  if (!app) return;

  if (!state.user || !state.profile) {
    if (currentLayout !== 'auth') {
      app.innerHTML = renderAuthPage();
      attachAuthEvents();
      currentLayout = 'auth';
    }
    return;
  }

  const requestedHash = window.location.hash.slice(1) || 'dashboard';
  let basePath = requestedHash.split('?')[0];

  if (isSetupLocked() || (basePath === 'setup-wizard' && state.profile?.role === 'admin')) {
    const setupPage = await getPage('setup-wizard');
    if (sequence !== renderSequence) return;
    app.innerHTML = setupPage.render();
    currentLayout = 'setup';
    setupPage.events?.();
    return;
  }

  const adminOnlyPages = ['admissions', 'settings', 'hr'];
  if (adminOnlyPages.includes(basePath) && state.profile.role !== 'admin') {
    basePath = 'dashboard';
    window.location.hash = 'dashboard';
  }
  if (basePath === 'super-admin' && !state.isSuperAdmin) {
    basePath = 'dashboard';
    window.location.hash = 'dashboard';
  }

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

  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  if (!pageCache.has(basePath)) mainContent.innerHTML = renderPageLoading();

  try {
    const page = await getPage(basePath);
    if (sequence !== renderSequence) return;
    mainContent.innerHTML = page.render();
    if (typeof page.events === 'function') {
      if (basePath === 'settings') page.events(renderApp);
      else page.events();
    }
  } catch (error) {
    console.error('[App] Page load error:', error);
    mainContent.innerHTML = renderErrorBoundary(error, basePath, state.lang);
  }
}

function renderErrorBoundary(error, page, lang) {
  return `
  <div class="page-content animate-in" style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
    <div class="glass-card" style="padding:2.5rem;text-align:center;max-width:480px;">
      <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
      <h3 style="color:var(--danger);margin-bottom:.75rem;">
        ${lang === 'ar' ? 'حدث خطأ في تحميل الصفحة' : 'Page failed to load'}
      </h3>
      <p class="text-muted" style="margin-bottom:1.5rem;font-size:.85rem;">
        ${lang === 'ar' ? `الصفحة: ${page}` : `Page: ${page}`}<br>
        <code style="opacity:.6;">${error?.message || ''}</code>
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

Object.keys(pageLoaders).forEach(path => {
  registerRoute(path, () => {
    state.currentPage = path;
    syncService.syncPage(path);
    void renderApp();
  });
});

initRouter();

let renderTimer = null;
let rendering = false;
state.subscribe(() => {
  if (!state.user || !state.profile || rendering) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    rendering = true;
    try {
      await renderApp();
    } finally {
      rendering = false;
    }
  }, 50);
});

initAuth(
  () => {
    const route = isSetupLocked() ? 'setup-wizard' : (window.location.hash.slice(1) || 'dashboard');
    state.currentPage = route;
    syncService.syncPage(route);

    void renderApp();

    const runBackgroundTasks = () => {
      void import('./services/exportService.js');
      if (state.profile?.role === 'admin') {
        void Promise.all([
          import('./services/academicService.js'),
          import('./services/libraryService.js'),
        ]).then(([academicModule, libraryModule]) => {
          academicModule.academicService.seedAssessmentTypes();
          libraryModule.libraryService.processOverdueFees();
        }).catch(error => console.warn('[App] Background admin services failed:', error));
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runBackgroundTasks, { timeout: 3000 });
    } else {
      window.setTimeout(runBackgroundTasks, 1000);
    }
  },
  () => {
    syncService.stopAll();
    currentLayout = null;
    pageCache.clear();
    void renderApp();
  }
);
