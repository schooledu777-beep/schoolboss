// ========================= GLOBAL STATE =========================
export const state = {
  user: null,
  profile: null,
  loading: true,
  currentPage: 'dashboard',
  lang: localStorage.getItem('sms-lang') || 'ar',
  theme: localStorage.getItem('sms-theme') || 'dark',
  sidebarOpen: window.innerWidth > 768,
  schoolType: 'private', // 'private' or 'public'
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
  subjects: [],
  roles: [],
  modules: {
    finance: { enabled: true, monetized: false },
    logistics: { enabled: true, monetized: true },
    clinic: { enabled: true, monetized: false },
    communications: { enabled: true, monetized: false },
    inventory: { enabled: false, monetized: true },
    training_center: { enabled: false, monetized: false }
  },
  customFields: {
    student: [],
    teacher: []
  },
  // Listeners
  unsubscribers: []
};

// ========================= TRANSLATIONS =========================
export const t = (key) => {
  const lang = state.lang;
  return translations[key]?.[lang] || key;
};

export const translations = {
  // App
  appName: { ar: 'EduManage Pro', en: 'EduManage Pro' },
  appSubtitle: { ar: 'نظام إدارة المدارس', en: 'School Management System' },
  loading: { ar: 'جاري التحميل...', en: 'Loading...' },
  // Auth
  login: { ar: 'تسجيل الدخول', en: 'Login' },
  register: { ar: 'إنشاء حساب', en: 'Register' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  fullName: { ar: 'الاسم الكامل', en: 'Full Name' },
  loginWithGoogle: { ar: 'تسجيل الدخول بـ Google', en: 'Login with Google' },
  noAccount: { ar: 'لا تملك حساباً؟', en: "Don't have an account?" },
  hasAccount: { ar: 'لديك حساب؟', en: 'Already have an account?' },
  registerNow: { ar: 'سجل الآن', en: 'Register Now' },
  loginNow: { ar: 'سجل دخول', en: 'Login Now' },
  // Nav
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  parents: { ar: 'أولياء الأمور', en: 'Parents' },
  students: { ar: 'الطلاب', en: 'Students' },
  teachers: { ar: 'المعلمون', en: 'Teachers' },
  classes: { ar: 'الفصول', en: 'Classes' },
  subjects: { ar: 'المواد الدراسية', en: 'Subjects' },
  attendance: { ar: 'الحضور والغياب', en: 'Attendance' },
  grades: { ar: 'الدرجات', en: 'Grades' },
  schedule: { ar: 'الجدول الدراسي', en: 'Schedule' },
  exams: { ar: 'الامتحانات', en: 'Exams' },
  finance: { ar: 'النظام المالي', en: 'Finance' },
  announcements: { ar: 'الإعلانات', en: 'Announcements' },
  messages: { ar: 'الرسائل', en: 'Messages' },
  homework: { ar: 'الواجبات', en: 'Homework' },
  rewards: { ar: 'المكافآت', en: 'Rewards' },
  clinic: { ar: 'العيادة', en: 'Clinic' },
  library: { ar: 'المكتبة', en: 'Library' },
  busTracking: { ar: 'تتبع الحافلات', en: 'Bus Tracking' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  myClasses: { ar: 'فصولي', en: 'My Classes' },
  myChildren: { ar: 'أبنائي', en: 'My Children' },
  mySchedule: { ar: 'جدولي', en: 'My Schedule' },
  myGrades: { ar: 'درجاتي', en: 'My Grades' },
  myHomework: { ar: 'واجباتي', en: 'My Homework' },
  myRewards: { ar: 'مكافآتي', en: 'My Rewards' },
  materials: { ar: 'المواد الدراسية', en: 'Materials' },
  profile: { ar: 'الملف الشخصي', en: 'Profile' },
  // Roles
  admin: { ar: 'مدير', en: 'Admin' },
  teacher: { ar: 'معلم', en: 'Teacher' },
  parent: { ar: 'ولي أمر', en: 'Parent' },
  student: { ar: 'طالب', en: 'Student' },
  // School Type
  publicSchool: { ar: 'مدرسة حكومية', en: 'Public School' },
  privateSchool: { ar: 'مدرسة خاصة', en: 'Private School' },
  schoolType: { ar: 'نوع المدرسة', en: 'School Type' },
  // Actions
  add: { ar: 'إضافة', en: 'Add' },
  edit: { ar: 'تعديل', en: 'Edit' },
  delete: { ar: 'حذف', en: 'Delete' },
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  confirm: { ar: 'تأكيد', en: 'Confirm' },
  search: { ar: 'بحث', en: 'Search' },
  filter: { ar: 'تصفية', en: 'Filter' },
  export: { ar: 'تصدير', en: 'Export' },
  refresh: { ar: 'تحديث', en: 'Refresh' },
  close: { ar: 'إغلاق', en: 'Close' },
  present: { ar: 'حاضر', en: 'Present' },
  absent: { ar: 'غائب', en: 'Absent' },
  late: { ar: 'متأخر', en: 'Late' },
  excused: { ar: 'مستأذن', en: 'Excused' },
  // Stats
  totalStudents: { ar: 'إجمالي الطلاب', en: 'Total Students' },
  totalTeachers: { ar: 'إجمالي المعلمين', en: 'Total Teachers' },
  totalClasses: { ar: 'إجمالي الفصول', en: 'Total Classes' },
  attendanceRate: { ar: 'نسبة الحضور', en: 'Attendance Rate' },
  todayAttendance: { ar: 'حضور اليوم', en: "Today's Attendance" },
  revenue: { ar: 'الإيرادات', en: 'Revenue' },
  pending: { ar: 'متأخرات', en: 'Pending' },
  // Subjects
  subjectName: { ar: 'اسم المادة', en: 'Subject Name' },
  subjectCode: { ar: 'رمز المادة', en: 'Subject Code' },
  description: { ar: 'الوصف', en: 'Description' },
  // Messages
  confirmDelete: { ar: 'هل أنت متأكد من الحذف؟', en: 'Are you sure you want to delete?' },
  savedSuccess: { ar: 'تم الحفظ بنجاح', en: 'Saved successfully' },
  deletedSuccess: { ar: 'تم الحذف بنجاح', en: 'Deleted successfully' },
  errorOccurred: { ar: 'حدث خطأ', en: 'An error occurred' },
  noData: { ar: 'لا توجد بيانات', en: 'No data available' },
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
}

export function toggleLang() {
  state.lang = state.lang === 'ar' ? 'en' : 'ar';
  applyLang();
}
