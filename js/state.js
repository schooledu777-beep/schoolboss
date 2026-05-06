import { translations } from './i18n.js';

// ========================= GLOBAL STATE =========================
export const state = {
  user: null,
  profile: null,
  loading: true,
  currentPage: 'dashboard',
  lang: localStorage.getItem('sms-lang') || 'ar',
  theme: localStorage.getItem('sms-theme') || 'dark',
  sidebarOpen: window.innerWidth > 1024,
  schoolType: 'private', 
  setup: {
    completed: true,
    currentStep: 1,
    totalSteps: 3,
    loading: true
  },
  // Data caches
  students: [],
  teachers: [],
  parents: [],
  classes: [],
  attendance: [],
  grades: [],
  schedules: [],
  exams: [],
  fees: [],
  announcements: [],
  messages: [],
  homework: [],
  rewards: [],
  clinic: [],
  library: [],
  buses: [],
  routes: [],
  routeStudents: [],
  transportFees: [],
  subjects: [],
  roles: [],
  assessmentTypes: [],
  subjectWeights: [],
  academicAlerts: [],
  annualPlans: [],
  timeslots: [],
  classrooms: [],
  teacherAvailability: [],
  staff: [],
  leaves: [],
  salarySlips: [],
  books: [],
  borrowingRecords: [],
  buildings: [],
  rooms: [],
  bedAllocations: [],
  notificationLogs: [],
  transfers: [],
  schoolSettings: [],
  // ── NEW COLLECTIONS ──────────────────────────────────────────────
  calendarEvents: [],
  examSchedule: [],
  clinicVisits: [],
  healthRecords: [],
  discounts: [],
  inventory: [],
  auditLogs: [],
  modules: {
    admissions: { enabled: true, monetized: false },
    finance: { enabled: true, monetized: false },
    logistics: { enabled: true, monetized: true },
    clinic: { enabled: true, monetized: false },
    communications: { enabled: true, monetized: false },
    hr: { enabled: true, monetized: false },
    library: { enabled: true, monetized: false },
    hostel: { enabled: true, monetized: false },
    inventory: { enabled: true, monetized: false },
    training_center: { enabled: false, monetized: false },
    transportation: { enabled: true, monetized: false }
  },
  customFields: {
    student: [],
    teacher: []
  },
  // Listeners & Observers
  unsubscribers: [],
  _observers: [],

  // Observer Methods
  subscribe(callback) {
    this._observers.push(callback);
    return () => this._observers = this._observers.filter(cb => cb !== callback);
  },

  notify() {
    this._observers.forEach(callback => callback(this));
  },

  // State Update Helper
  update(newData) {
    Object.assign(this, newData);
    this.notify();
  }
};

// ========================= TRANSLATIONS =========================
export const t = (key) => {
  const lang = state.lang;
  return translations[key]?.[lang] || key;
};

// ========================= SETTINGS =========================
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('sms-theme', state.theme);
}

export function applyLang() {
  const dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('lang', state.lang);
  document.documentElement.setAttribute('dir', dir);
  localStorage.setItem('sms-lang', state.lang);
}

export function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  state.notify();
}

export function toggleLang() {
  state.lang = state.lang === 'ar' ? 'en' : 'ar';
  applyLang();
  state.notify();
}
