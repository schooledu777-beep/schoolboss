import { state } from '../state.js';
import { formatCurrency } from '../ui.js';

// ========================= UNIVERSAL EXPORT SERVICE =========================
// CSV export for all major data tables

function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map(r =>
    r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `${filename}_${new Date().toISOString().split('T')[0]}.csv` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Students ────────────────────────────────────────────────────────
export function exportStudents() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الاسم', 'رقم الطالب', 'الصف', 'الجنس', 'البريد الإلكتروني', 'الهاتف', 'ولي الأمر', 'تاريخ التسجيل']
    : ['#', 'Name', 'Student ID', 'Class', 'Gender', 'Email', 'Phone', 'Parent', 'Enrollment Date'];

  const rows = state.students.map((s, i) => {
    const cls    = state.classes.find(c => c.id === s.classId || (c.studentIds||[]).includes(s.id));
    const parent = state.parents.find(p => p.id === s.parentId);
    return [i + 1, s.name, s.studentId || '', cls?.name || '', s.gender || '', s.email || '', s.phone || '', parent?.name || '', s.createdAt?.split('T')[0] || ''];
  });

  downloadCSV(isAr ? 'الطلاب' : 'students', headers, rows);
}

// ── Teachers ────────────────────────────────────────────────────────
export function exportTeachers() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الاسم', 'التخصص', 'البريد الإلكتروني', 'الهاتف', 'الخبرة (سنوات)']
    : ['#', 'Name', 'Subject', 'Email', 'Phone', 'Experience (years)'];

  const rows = state.teachers.map((t, i) =>
    [i + 1, t.name, t.subject || '', t.email || '', t.phone || '', t.experience || '']
  );
  downloadCSV(isAr ? 'المعلمون' : 'teachers', headers, rows);
}

// ── Grades ──────────────────────────────────────────────────────────
export function exportGrades() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الطالب', 'الصف', 'المادة', 'نوع الامتحان', 'الدرجة', 'من', 'النسبة%', 'التاريخ']
    : ['#', 'Student', 'Class', 'Subject', 'Exam Type', 'Score', 'Max', 'Percentage%', 'Date'];

  const rows = state.grades.map((g, i) => {
    const student = state.students.find(s => s.id === g.studentId);
    const cls     = student ? state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(student.id)) : null;
    const pct     = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
    return [i + 1, student?.name || '', cls?.name || '', g.subject || '', g.examType || '', g.score, g.maxScore, pct + '%', g.date || ''];
  });
  downloadCSV(isAr ? 'الدرجات' : 'grades', headers, rows);
}

// ── Attendance ──────────────────────────────────────────────────────
export function exportAttendance() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الطالب', 'الصف', 'التاريخ', 'الحالة']
    : ['#', 'Student', 'Class', 'Date', 'Status'];

  const statusLabels = { present: { ar: 'حاضر', en: 'Present' }, absent: { ar: 'غائب', en: 'Absent' }, late: { ar: 'متأخر', en: 'Late' }, excused: { ar: 'مستأذن', en: 'Excused' } };
  const rows = state.attendance.map((a, i) => {
    const student = state.students.find(s => s.id === a.studentId);
    const cls     = student ? state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(student.id)) : null;
    const sl      = statusLabels[a.status] || { ar: a.status, en: a.status };
    return [i + 1, student?.name || '', cls?.name || '', a.date || '', isAr ? sl.ar : sl.en];
  });
  downloadCSV(isAr ? 'الحضور' : 'attendance', headers, rows);
}

// ── Finance ─────────────────────────────────────────────────────────
export function exportFinance() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الطالب', 'الصف', 'نوع الرسوم', 'المبلغ', 'المدفوع', 'المتبقي', 'تاريخ الاستحقاق', 'الحالة']
    : ['#', 'Student', 'Class', 'Fee Type', 'Amount', 'Paid', 'Remaining', 'Due Date', 'Status'];

  const today = new Date().toISOString().split('T')[0];
  const rows  = state.fees.map((f, i) => {
    const student   = state.students.find(s => s.id === f.studentId);
    const cls       = student ? state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(student.id)) : null;
    const paid      = f.paidAmount || 0;
    const remaining = (f.amount || 0) - paid;
    const isOverdue = f.dueDate && f.dueDate < today && remaining > 0;
    const status    = paid >= (f.amount||0) ? (isAr ? 'مدفوع' : 'Paid') : isOverdue ? (isAr ? 'متأخر' : 'Overdue') : (isAr ? 'غير مدفوع' : 'Unpaid');
    return [i + 1, student?.name || '', cls?.name || '', f.feeType || '', f.amount || 0, paid, remaining, f.dueDate || '', status];
  });
  downloadCSV(isAr ? 'الرسوم' : 'finance', headers, rows);
}

// ── Homework ────────────────────────────────────────────────────────
export function exportHomework() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'العنوان', 'المادة', 'الصف', 'تاريخ التسليم', 'الأولوية', 'الحالة']
    : ['#', 'Title', 'Subject', 'Class', 'Due Date', 'Priority', 'Status'];

  const rows = (state.homework || []).map((h, i) => {
    const cls = state.classes.find(c => c.id === h.classId);
    return [i + 1, h.title, h.subject || '', cls?.name || '', h.dueDate || '', h.priority || '', h.status || 'active'];
  });
  downloadCSV(isAr ? 'الواجبات' : 'homework', headers, rows);
}

// ── Exams ────────────────────────────────────────────────────────────
export function exportExams() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'المادة', 'الصف', 'التاريخ', 'وقت البداية', 'القاعة', 'المدة', 'الدرجة', 'الحالة']
    : ['#', 'Subject', 'Class', 'Date', 'Start Time', 'Room', 'Duration', 'Max Score', 'Status'];

  const rows = (state.examSchedule || []).map((e, i) => {
    const cls = state.classes.find(c => c.id === e.classId);
    return [i + 1, e.subject || '', cls?.name || '', e.date || '', e.startTime || '', e.room || '', e.duration || '', e.maxScore || '', e.status || ''];
  });
  downloadCSV(isAr ? 'الامتحانات' : 'exams', headers, rows);
}

// ── Clinic Visits ────────────────────────────────────────────────────
export function exportClinicVisits() {
  const isAr = state.lang === 'ar';
  const headers = isAr
    ? ['#', 'الطالب', 'التاريخ', 'الوقت', 'نوع الزيارة', 'الأعراض', 'الإجراء', 'إخطار ولي الأمر']
    : ['#', 'Student', 'Date', 'Time', 'Visit Type', 'Reason', 'Action', 'Parent Notified'];

  const rows = (state.clinicVisits || []).map((v, i) => {
    const student = state.students.find(s => s.id === v.studentId);
    return [i + 1, student?.name || '', v.date || '', v.time || '', v.type || '', v.reason || '', v.action || '', v.parentNotified || ''];
  });
  downloadCSV(isAr ? 'زيارات_العيادة' : 'clinic_visits', headers, rows);
}

// ── Convenience: add export button HTML to any page ─────────────────
export function exportButtonHTML(handler, label) {
  return `<button class="btn btn-outline" onclick="${handler}()">📥 ${label}</button>`;
}

// ── Make exporters globally available ───────────────────────────────
window.exportStudents    = exportStudents;
window.exportTeachers    = exportTeachers;
window.exportGrades      = exportGrades;
window.exportAttendance  = exportAttendance;
window.exportFinance     = exportFinance;
window.exportHomework    = exportHomework;
window.exportExams       = exportExams;
window.exportClinicVisits = exportClinicVisits;
