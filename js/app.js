// ERP Sync - 2026-04-25
import { state, applyTheme, applyLang } from './state.js';
import { db, collection, onSnapshot } from './firebase-config.js';
import { hideLoading } from './ui.js';
import { registerRoute, initRouter, handleRoute, navigate } from './router.js';
import { renderAuthPage, attachAuthEvents, initAuth } from './auth.js';
import { renderSidebar, renderHeader, attachLayoutEvents } from './components.js';
import { renderDashboard, attachDashboardEvents } from './pages/dashboard.js';
import { renderStudents, attachStudentEvents } from './pages/students.js';
import { renderTeachers, attachTeacherEvents } from './pages/teachers.js';
import { renderParents, attachParentEvents } from './pages/parents.js';
import { renderClasses, attachClassEvents } from './pages/classes.js';
import { renderAttendance, attachAttendanceEvents } from './pages/attendance.js';
import { renderGrades, attachGradeEvents } from './pages/grades.js';
import { renderSubjects, attachSubjectEvents } from './pages/subjects.js';
import { renderSchedule, attachScheduleEvents } from './pages/schedule.js';
import { renderFinance, attachFinanceEvents } from './pages/finance.js';
import { renderAnnouncements, attachAnnouncementEvents, renderMessages, attachMessageEvents, renderSettings, attachSettingsEvents } from './pages/communications.js';
import { renderAdmissions, attachAdmissionsEvents } from './pages/admissions.js';
import { renderAcademicAlerts, attachAcademicAlertsEvents } from './pages/academicAlerts.js';
import { renderHR, attachHREvents } from './pages/hr.js';
import { renderLibrary, attachLibraryEvents } from './pages/library.js';
import { renderHostel, attachHostelEvents } from './pages/hostel.js';
import { renderStudentProfile, attachStudentProfileEvents } from './pages/studentProfile.js';
import { academicService } from './services/academicService.js';
import { libraryService } from './services/libraryService.js';

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
  settings:        { render: renderSettings, events: (renderApp) => attachSettingsEvents(renderApp) },
  // Placeholder pages for future features
  exams:          { render: () => placeholderPage('📑', 'exams'), events: () => {} },
  homework:       { render: () => placeholderPage('📚', 'homework'), events: () => {} },
  rewards:        { render: () => placeholderPage('⭐', 'rewards'), events: () => {} },
  clinic:         { render: () => placeholderPage('🏥', 'clinic'), events: () => {} },
  library:        { render: () => placeholderPage('📖', 'library'), events: () => {} },
  'bus-tracking': { render: () => placeholderPage('🚌', 'busTracking'), events: () => {} },
  'my-children':  { render: renderDashboard, events: attachDashboardEvents },
  materials:      { render: () => placeholderPage('📖', 'materials'), events: () => {} },
};

function placeholderPage(icon, key) {
  return `<div class="page-content animate-in"><div class="empty-state glass-card"><span class="empty-icon">${icon}</span><h3>${state.lang === 'ar' ? 'قريباً' : 'Coming Soon'}</h3><p class="text-muted">${state.lang === 'ar' ? 'هذه الميزة قيد التطوير' : 'This feature is under development'}</p></div></div>`;
}

// ========================= RENDER APP =========================
function renderApp() {
  const app = document.getElementById('app');
  if (!state.user || !state.profile) {
    app.innerHTML = renderAuthPage();
    attachAuthEvents();
    return;
  }

  const currentHash = window.location.hash.slice(1) || 'dashboard';
  const basePath = currentHash.split('?')[0];
  let page = pages[basePath] || pages.dashboard;

  // Route Guard for Admin-only pages
  const adminOnlyPages = ['admissions', 'settings'];
  if (adminOnlyPages.includes(basePath) && state.profile.role !== 'admin') {
    page = pages.dashboard;
    window.location.hash = 'dashboard';
  }

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <div class="main-area">
        ${renderHeader()}
        <main class="main-content" id="main-content">
          ${page.render()}
        </main>
      </div>
    </div>`;

  attachLayoutEvents(renderApp);
  attachStudentProfileEvents(); // Ensure profile tab switching works
  if (typeof page.events === 'function') {
    if (basePath === 'settings') page.events(renderApp);
    else page.events();
  }
}

// ========================= REGISTER ROUTES =========================
Object.keys(pages).forEach(path => {
  registerRoute(path, () => {
    state.currentPage = path;
    renderApp();
  });
});

// ========================= DATA LISTENERS =========================
function startListeners() {
  const collections = [
    { name: 'students', key: 'students' },
    { name: 'teachers', key: 'teachers' },
    { name: 'parents', key: 'parents' },
    { name: 'classes', key: 'classes' },
    { name: 'subjects', key: 'subjects' },
    { name: 'attendance', key: 'attendance' },
    { name: 'grades', key: 'grades' },
    { name: 'schedules', key: 'schedules' },
    { name: 'fees', key: 'fees' },
    { name: 'announcements', key: 'announcements' },
    { name: 'messages', key: 'messages' },
    { name: 'homework', key: 'homework' },
    { name: 'rewards', key: 'rewards' },
    { name: 'assessment_types', key: 'assessmentTypes' },
    { name: 'subject_weights', key: 'subjectWeights' },
    { name: 'academic_alerts', key: 'academicAlerts' },
    { name: 'timeslots', key: 'timeslots' },
    { name: 'classrooms', key: 'classrooms' },
    { name: 'teacher_availability', key: 'teacherAvailability' },
    { name: 'leaves', key: 'leaves' },
    { name: 'salary_slips', key: 'salarySlips' },
    { name: 'books', key: 'books' },
    { name: 'borrowing_records', key: 'borrowingRecords' },
    { name: 'rooms', key: 'rooms' },
    { name: 'bed_allocations', key: 'bedAllocations' },
    { name: 'notification_logs', key: 'notificationLogs' },
  ];

  collections.forEach(({ name, key }) => {
    try {
      const unsub = onSnapshot(collection(db, name), (snap) => {
        state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Re-render only if the current page is relevant to this collection
        const relevantPages = [name, 'dashboard', state.currentPage];
        if (state.user && state.profile && relevantPages.includes(state.currentPage)) {
          renderApp();
        }
      }, (err) => {
        console.warn(`Listener error for ${name}:`, err);
        state[key] = [];
      });
      state.unsubscribers.push(unsub);
    } catch(e) {
      console.warn(`Failed to listen to ${name}:`, e);
    }
  });
}

// ========================= INIT =========================
initRouter();
initAuth(
  () => { // onLogin
    startListeners();
    const route = window.location.hash.slice(1) || 'dashboard';
    state.currentPage = route;
    if (state.profile?.role === 'admin') {
        academicService.seedAssessmentTypes();
        libraryService.processOverdueFees();
    }
    renderApp();
  },
  () => { // onLogout
    renderApp();
  }
);
