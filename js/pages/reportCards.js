import { state, t } from '../state.js';
import { showModal, closeModal, showToast } from '../ui.js';

// ========================= REPORT CARDS =========================

export function renderReportCards() {
  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';
  const isStudent = role === 'student';

  // Filter available classes
  let classes = state.classes;
  if (isTeacher) {
    classes = classes.filter(c => c.teacherId === state.profile?.uid);
  }

  // Filter available students
  let students = state.students;
  if (isParent) {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    students = students.filter(s => kidIds.includes(s.id));
  }
  if (isStudent) {
    students = students.filter(s => s.id === state.profile?.uid);
  }

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📄 ${isAr ? 'كشف الدرجات' : 'Report Cards'}</h2>
      <div class="header-actions">
        <button class="btn btn-primary" id="generate-report-btn">
          ${isAr ? '📊 إنشاء كشف' : '📊 Generate Report'}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <select id="rc-class-filter" class="form-select">
        <option value="">${isAr ? '-- اختر الصف --' : '-- Select Class --'}</option>
        ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <select id="rc-student-filter" class="form-select">
        <option value="">${isAr ? 'كل الطلاب' : 'All Students'}</option>
        ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      <select id="rc-term-filter" class="form-select">
        <option value="all">${isAr ? 'كل الفصول' : 'All Terms'}</option>
        <option value="term1">${isAr ? 'الفصل الأول' : 'Term 1'}</option>
        <option value="term2">${isAr ? 'الفصل الثاني' : 'Term 2'}</option>
        <option value="term3">${isAr ? 'الفصل الثالث' : 'Term 3'}</option>
      </select>
      <select id="rc-year-filter" class="form-select">
        <option value="2025-2026">2025-2026</option>
        <option value="2024-2025">2024-2025</option>
      </select>
    </div>

    <!-- Results Area -->
    <div id="rc-results">
      <div class="empty-state glass-card">
        <span class="empty-icon">📋</span>
        <h3>${isAr ? 'اختر صفاً لعرض كشف الدرجات' : 'Select a class to view report cards'}</h3>
        <p class="text-muted">${isAr ? 'يمكنك تصفية النتائج حسب الطالب والفصل الدراسي' : 'You can filter by student and term'}</p>
      </div>
    </div>
  </div>`;
}

export function attachReportCardsEvents() {
  document.getElementById('rc-class-filter')?.addEventListener('change', renderResults);
  document.getElementById('rc-student-filter')?.addEventListener('change', renderResults);
  document.getElementById('rc-term-filter')?.addEventListener('change', renderResults);
  document.getElementById('rc-year-filter')?.addEventListener('change', renderResults);
  document.getElementById('generate-report-btn')?.addEventListener('click', () => {
    const classId = document.getElementById('rc-class-filter')?.value;
    if (!classId) {
      showToast(state.lang === 'ar' ? 'يرجى اختيار صف أولاً' : 'Please select a class first', 'warning');
      return;
    }
    renderResults();
  });
}

function renderResults() {
  const isAr = state.lang === 'ar';
  const classId = document.getElementById('rc-class-filter')?.value;
  const studentId = document.getElementById('rc-student-filter')?.value;
  const term = document.getElementById('rc-term-filter')?.value || 'all';

  if (!classId && !studentId) return;

  // Get students for selected class
  let targetStudents = state.students;
  if (classId) {
    const cls = state.classes.find(c => c.id === classId);
    const classStudentIds = cls?.studentIds || state.students.filter(s => s.classId === classId).map(s => s.id);
    targetStudents = state.students.filter(s => classStudentIds.includes(s.id));
  }
  if (studentId) {
    targetStudents = targetStudents.filter(s => s.id === studentId);
  }

  if (targetStudents.length === 0) {
    document.getElementById('rc-results').innerHTML = `
      <div class="empty-state glass-card">
        <span class="empty-icon">👥</span>
        <h3>${isAr ? 'لا يوجد طلاب في هذا الصف' : 'No students in this class'}</h3>
      </div>`;
    return;
  }

  const cards = targetStudents.map(student => buildStudentReport(student, term)).join('');
  document.getElementById('rc-results').innerHTML = `
    <div style="display:flex;justify-content:flex-end;gap:.75rem;margin-bottom:1rem;">
      <button class="btn btn-outline" id="print-all-btn">🖨️ ${isAr ? 'طباعة الكل' : 'Print All'}</button>
    </div>
    <div id="all-reports">${cards}</div>`;

  document.getElementById('print-all-btn')?.addEventListener('click', printAllReports);
  document.querySelectorAll('.print-single-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.student;
      printSingleReport(sid);
    });
  });
}

function buildStudentReport(student, term) {
  const isAr = state.lang === 'ar';
  const cls = state.classes.find(c => c.id === student.classId) || state.classes.find(c => (c.studentIds||[]).includes(student.id));

  // Get grades for this student
  let grades = state.grades.filter(g => g.studentId === student.id);
  if (term !== 'all') {
    grades = grades.filter(g => (g.term || 'term1') === term);
  }

  // Group by subject
  const subjectMap = {};
  grades.forEach(g => {
    if (!subjectMap[g.subject]) subjectMap[g.subject] = [];
    subjectMap[g.subject].push(g);
  });

  const subjects = Object.keys(subjectMap);
  let totalPct = 0;
  let subjectCount = 0;

  const subjectRows = subjects.map(subj => {
    const subjGrades = subjectMap[subj];
    const totalScore = subjGrades.reduce((s, g) => s + (g.score || 0), 0);
    const totalMax = subjGrades.reduce((s, g) => s + (g.maxScore || 100), 0);
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    totalPct += pct;
    subjectCount++;
    const grade = getLetterGrade(pct, isAr);
    const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#3b82f6' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <tr>
        <td style="font-weight:600;">${subj}</td>
        <td>${totalScore}</td>
        <td>${totalMax}</td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="flex:1;height:6px;background:var(--border);border-radius:4px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
            </div>
            <span style="color:${color};font-weight:700;min-width:36px;">${pct}%</span>
          </div>
        </td>
        <td><span style="font-weight:700;color:${color};">${grade}</span></td>
      </tr>`;
  }).join('');

  const avg = subjectCount > 0 ? Math.round(totalPct / subjectCount) : 0;
  const avgGrade = getLetterGrade(avg, isAr);
  const avgColor = avg >= 90 ? '#10b981' : avg >= 75 ? '#3b82f6' : avg >= 60 ? '#f59e0b' : '#ef4444';
  const status = avg >= 50 ? (isAr ? 'ناجح ✅' : 'Pass ✅') : (isAr ? 'راسب ❌' : 'Fail ❌');

  // Attendance summary
  const studentAttendance = state.attendance.filter(a => a.studentId === student.id);
  const presentDays = studentAttendance.filter(a => a.status === 'present').length;
  const totalDays = studentAttendance.length;
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  return `
  <div class="report-card glass-card" id="report-${student.id}" style="margin-bottom:1.5rem;padding:0;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,var(--primary),var(--secondary));padding:1.5rem;color:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
        <div>
          <h3 style="margin:0;font-size:1.25rem;">${student.name}</h3>
          <p style="margin:.25rem 0 0;opacity:.85;font-size:.9rem;">${cls?.name || '—'} | ${isAr ? 'رقم الطالب:' : 'ID:'} ${student.studentId || student.id.slice(0,6)}</p>
        </div>
        <div style="text-align:center;">
          <div style="font-size:2rem;font-weight:800;background:rgba(255,255,255,.2);border-radius:12px;padding:.5rem 1.25rem;">${avg}%</div>
          <div style="font-size:.8rem;opacity:.85;margin-top:.25rem;">${isAr ? 'المعدل العام' : 'Overall Average'}</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:1.5rem;">
      <!-- Quick Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:1.5rem;">
        <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:12px;">
          <div style="font-size:1.5rem;font-weight:700;color:${avgColor};">${avgGrade}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${isAr ? 'التقدير' : 'Grade'}</div>
        </div>
        <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:12px;">
          <div style="font-size:1.5rem;font-weight:700;">${status}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${isAr ? 'الحالة' : 'Status'}</div>
        </div>
        <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:12px;">
          <div style="font-size:1.5rem;font-weight:700;color:${attendancePct >= 75 ? '#10b981' : '#ef4444'};">${attendancePct}%</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${isAr ? 'الحضور' : 'Attendance'}</div>
        </div>
        <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:12px;">
          <div style="font-size:1.5rem;font-weight:700;">${subjects.length}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${isAr ? 'المواد' : 'Subjects'}</div>
        </div>
      </div>

      <!-- Grades Table -->
      ${subjects.length > 0 ? `
      <div class="table-responsive" style="margin-bottom:1rem;">
        <table class="data-table">
          <thead><tr>
            <th>${isAr ? 'المادة' : 'Subject'}</th>
            <th>${isAr ? 'الدرجة' : 'Score'}</th>
            <th>${isAr ? 'من' : 'Max'}</th>
            <th>${isAr ? 'النسبة' : 'Percentage'}</th>
            <th>${isAr ? 'التقدير' : 'Grade'}</th>
          </tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>
      </div>` : `<p class="text-muted text-center">${isAr ? 'لا توجد درجات مسجلة' : 'No grades recorded'}</p>`}

      <!-- Actions -->
      <div style="display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-outline print-single-btn" data-student="${student.id}">
          🖨️ ${isAr ? 'طباعة' : 'Print'}
        </button>
        <button class="btn btn-primary" onclick="window.exportReportPDF('${student.id}')">
          📥 ${isAr ? 'تصدير PDF' : 'Export PDF'}
        </button>
      </div>
    </div>
  </div>`;
}

function getLetterGrade(pct, isAr) {
  if (pct >= 95) return isAr ? 'ممتاز+' : 'A+';
  if (pct >= 90) return isAr ? 'ممتاز' : 'A';
  if (pct >= 85) return isAr ? 'جيد جداً+' : 'B+';
  if (pct >= 80) return isAr ? 'جيد جداً' : 'B';
  if (pct >= 75) return isAr ? 'جيد+' : 'C+';
  if (pct >= 70) return isAr ? 'جيد' : 'C';
  if (pct >= 65) return isAr ? 'مقبول+' : 'D+';
  if (pct >= 60) return isAr ? 'مقبول' : 'D';
  if (pct >= 50) return isAr ? 'ضعيف' : 'E';
  return isAr ? 'راسب' : 'F';
}

function printSingleReport(studentId) {
  const el = document.getElementById(`report-${studentId}`);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head>
    <meta charset="utf-8">
    <title>Report Card</title>
    <style>
      body { font-family: 'Tajawal', Arial, sans-serif; direction: ${state.lang === 'ar' ? 'rtl' : 'ltr'}; margin: 0; padding: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: ${state.lang === 'ar' ? 'right' : 'left'}; }
      th { background: #6366f1; color: white; }
      .report-card { max-width: 800px; margin: auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${el.outerHTML}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  w.document.close();
}

function printAllReports() {
  const el = document.getElementById('all-reports');
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head>
    <meta charset="utf-8">
    <title>Report Cards</title>
    <style>
      body { font-family: 'Tajawal', Arial, sans-serif; direction: ${state.lang === 'ar' ? 'rtl' : 'ltr'}; margin: 0; padding: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 8px 12px; border: 1px solid #ddd; }
      th { background: #6366f1; color: white; }
      .report-card { page-break-after: always; margin-bottom: 2rem; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; }
      button { display: none !important; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>${el.outerHTML}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  w.document.close();
}

// Global PDF export
window.exportReportPDF = function(studentId) {
  const el = document.getElementById(`report-${studentId}`);
  if (!el) return;
  if (window.html2pdf) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('button').forEach(b => b.remove());
    window.html2pdf().set({
      margin: 10,
      filename: `report_${studentId}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(clone).save();
  } else {
    printSingleReport(studentId);
  }
};
