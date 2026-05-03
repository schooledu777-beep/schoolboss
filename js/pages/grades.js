import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, checkValid, escapeHTML, renderAvatar } from '../ui.js';
import { academicService } from '../services/academicService.js';
import { recordAudit } from './auditLog.js';

function getVisibleGradeContext() {
  const role = state.profile?.role;
  let students = [...(state.students || [])];
  let grades = [...(state.grades || [])];

  if (role === 'student') {
    students = students.filter(s => s.id === state.profile?.uid);
    grades = grades.filter(g => g.studentId === state.profile?.uid);
  }

  if (role === 'parent') {
    const kidIds = state.profile?.studentIds || students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    students = students.filter(s => kidIds.includes(s.id));
    grades = grades.filter(g => kidIds.includes(g.studentId));
  }

  if (role === 'teacher') {
    const myClassIds = state.classes
      .filter(c => c.teacherId === state.profile?.uid || (c.teacherIds || []).includes(state.profile?.uid))
      .map(c => c.id);
    students = students.filter(s =>
      myClassIds.includes(s.classId) ||
      myClassIds.some(cid => (state.classes.find(c => c.id === cid)?.studentIds || []).includes(s.id))
    );
    const studentIds = students.map(s => s.id);
    grades = grades.filter(g => studentIds.includes(g.studentId));
  }

  return { students, grades };
}

function getPct(score, maxScore) {
  return maxScore > 0 ? Math.round((Number(score || 0) / Number(maxScore || 100)) * 100) : 0;
}

function getBadgeType(pct) {
  if (pct >= 85) return 'success';
  if (pct >= 60) return 'warning';
  return 'danger';
}

function getAssessmentLabel(type) {
  const item = (state.assessmentTypes || []).find(x => String(x.name).toLowerCase() === String(type || '').toLowerCase());
  return item ? (state.lang === 'ar' ? item.ar : item.name) : (type || (state.lang === 'ar' ? 'غير محدد' : 'Unspecified'));
}

function getAssessmentTypes() {
  const defaults = [
    { name: 'quiz', ar: 'اختبار قصير' },
    { name: 'homework', ar: 'واجب' },
    { name: 'oral', ar: 'شفهي' },
    { name: 'practical', ar: 'عملي' },
    { name: 'participation', ar: 'مشاركة' },
    { name: 'midterm', ar: 'منتصف الفصل' },
    { name: 'final', ar: 'نهائي' }
  ];
  const custom = Array.isArray(state.assessmentTypes) ? state.assessmentTypes : [];
  const map = new Map();

  [...custom, ...defaults].forEach(type => {
    const name = String(type?.name || '').trim().toLowerCase();
    if (!name || map.has(name)) return;
    map.set(name, { name, ar: type.ar || type.name || name });
  });

  return [...map.values()];
}

function formatGradeDate(date) {
  return date ? new Date(date).toLocaleDateString(state.lang === 'ar' ? 'ar-SA' : 'en-US') : '—';
}

function getGradeRemark(percent) {
  if (percent >= 90) return state.lang === 'ar' ? 'ممتاز' : 'Excellent';
  if (percent >= 80) return state.lang === 'ar' ? 'جيد جدا' : 'Very Good';
  if (percent >= 70) return state.lang === 'ar' ? 'جيد' : 'Good';
  if (percent >= 60) return state.lang === 'ar' ? 'مقبول' : 'Pass';
  return state.lang === 'ar' ? 'بحاجة لمتابعة' : 'Needs Follow-up';
}

function summarizeStudentGrades(studentId, grades) {
  const list = grades.filter(g => g.studentId === studentId);
  const total = list.reduce((sum, g) => sum + Number(g.score || 0), 0);
  const max = list.reduce((sum, g) => sum + Number(g.maxScore || 100), 0);
  const avg = list.length && max > 0 ? Math.round((total / max) * 100) : 0;
  const subjects = new Set(list.map(g => g.subject).filter(Boolean)).size;
  const latest = [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  return { list, total, max, avg, subjects, latest };
}

function buildGradeReportHtml(student, cls, studentGrades, summary) {
  const isAr = state.lang === 'ar';
  const bySubject = {};
  studentGrades.forEach(g => {
    const subject = g.subject || (isAr ? 'بدون مادة' : 'No Subject');
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(g);
  });

  const subjectRows = Object.entries(bySubject).map(([subject, items], index) => {
    const total = items.reduce((sum, g) => sum + Number(g.score || 0), 0);
    const max = items.reduce((sum, g) => sum + Number(g.maxScore || 100), 0);
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(subject)}</td>
        <td>${items.length}</td>
        <td>${total} / ${max || 0}</td>
        <td><strong>${pct}%</strong></td>
        <td>${escapeHTML(getGradeRemark(pct))}</td>
      </tr>`;
  }).join('');

  const detailRows = studentGrades.map((g, index) => {
    const pct = getPct(g.score, g.maxScore);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(g.subject || '—')}</td>
        <td>${escapeHTML(getAssessmentLabel(g.examType))}</td>
        <td>${Number(g.score || 0)} / ${Number(g.maxScore || 100)}</td>
        <td>${pct}%</td>
        <td>${formatGradeDate(g.date)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="grade-report-page" dir="${isAr ? 'rtl' : 'ltr'}">
      <div class="grade-report-hero">
        <div class="grade-report-brand">
          <img src="assets/edumanage-mark.svg" alt="EduManage">
          <div>
            <h1>${isAr ? 'كشف درجات الطالب' : 'Student Grade Report'}</h1>
            <p>EduManage Pro</p>
          </div>
        </div>
        <div class="grade-report-date">${formatGradeDate(new Date().toISOString())}</div>
      </div>

      <div class="grade-report-student">
        <div>
          <span>${isAr ? 'اسم الطالب' : 'Student Name'}</span>
          <strong>${escapeHTML(student.name || '—')}</strong>
        </div>
        <div>
          <span>${isAr ? 'الصف' : 'Class'}</span>
          <strong>${escapeHTML(cls?.name || '—')}</strong>
        </div>
        <div>
          <span>${isAr ? 'البريد الإلكتروني' : 'Email'}</span>
          <strong>${escapeHTML(student.email || '—')}</strong>
        </div>
      </div>

      <div class="grade-report-summary">
        <div><span>${isAr ? 'عدد النتائج' : 'Results'}</span><strong>${summary.list.length}</strong></div>
        <div><span>${isAr ? 'عدد المواد' : 'Subjects'}</span><strong>${summary.subjects}</strong></div>
        <div><span>${isAr ? 'المجموع' : 'Total'}</span><strong>${summary.total} / ${summary.max || 0}</strong></div>
        <div><span>${isAr ? 'المتوسط العام' : 'Average'}</span><strong>${summary.list.length ? `${summary.avg}%` : '—'}</strong></div>
      </div>

      <section>
        <h2>${isAr ? 'ملخص المواد' : 'Subject Summary'}</h2>
        <table>
          <thead><tr><th>#</th><th>${isAr ? 'المادة' : 'Subject'}</th><th>${isAr ? 'الاختبارات' : 'Tests'}</th><th>${isAr ? 'الدرجة' : 'Score'}</th><th>${isAr ? 'النسبة' : 'Percent'}</th><th>${isAr ? 'التقدير' : 'Remark'}</th></tr></thead>
          <tbody>${subjectRows || `<tr><td colspan="6">${isAr ? 'لا توجد نتائج' : 'No results'}</td></tr>`}</tbody>
        </table>
      </section>

      <section>
        <h2>${isAr ? 'تفاصيل الاختبارات' : 'Assessment Details'}</h2>
        <table>
          <thead><tr><th>#</th><th>${isAr ? 'المادة' : 'Subject'}</th><th>${isAr ? 'نوع الاختبار' : 'Type'}</th><th>${isAr ? 'الدرجة' : 'Score'}</th><th>${isAr ? 'النسبة' : 'Percent'}</th><th>${isAr ? 'التاريخ' : 'Date'}</th></tr></thead>
          <tbody>${detailRows || `<tr><td colspan="6">${isAr ? 'لا توجد نتائج' : 'No results'}</td></tr>`}</tbody>
        </table>
      </section>

      <div class="grade-report-footer">
        <span>${isAr ? 'تم إنشاء الكشف آليا من نظام EduManage Pro' : 'Generated automatically by EduManage Pro'}</span>
        <span>${escapeHTML(getGradeRemark(summary.avg))}</span>
      </div>
    </div>`;
}

async function downloadStudentGradeReport(student, cls, studentGrades, summary) {
  if (typeof window.html2pdf !== 'function') {
    showToast(state.lang === 'ar' ? 'أداة تصدير PDF غير متاحة حاليا' : 'PDF export is not available right now', 'error');
    return;
  }

  const holder = document.createElement('div');
  holder.className = 'grade-report-pdf-host';
  holder.innerHTML = buildGradeReportHtml(student, cls, studentGrades, summary);
  document.body.appendChild(holder);

  const safeName = String(student.name || 'student').replace(/[\\/:*?"<>|]/g, '-').trim() || 'student';
  const filename = `${safeName}-grade-report-${new Date().toISOString().split('T')[0]}.pdf`;

  try {
    await window.html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(holder.querySelector('.grade-report-page'))
      .save();
  } catch (err) {
    console.error('[Grades] PDF export error:', err);
    showToast(state.lang === 'ar' ? 'تعذر إنشاء ملف PDF' : 'Could not create PDF', 'error');
  } finally {
    holder.remove();
  }
}

export function renderGrades() {
  const role = state.profile?.role;
  const canEdit = role === 'admin' || role === 'teacher';
  const { students, grades } = getVisibleGradeContext();

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('grades')}</h2>
      <div class="header-actions">
        <button class="btn btn-outline" onclick="window.exportGrades?.()">📤 ${state.lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}</button>
        ${canEdit ? `<button class="btn btn-outline" id="manage-weights-btn">⚖️ ${state.lang === 'ar' ? 'إدارة الأوزان' : 'Manage Weights'}</button>` : ''}
        ${canEdit ? `<button class="btn btn-primary" id="add-grade-btn">+ ${t('add')}</button>` : ''}
      </div>
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="grade-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="grade-class-filter" class="form-select">
        <option value="">${state.lang === 'ar' ? 'كل الصفوف' : 'All Levels'}</option>
        ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="table-responsive glass-card table-cards">
      <table class="data-table" id="grades-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${state.lang === 'ar' ? 'الطالب' : 'Student'}</th>
            <th>${state.lang === 'ar' ? 'الصف' : 'Class'}</th>
            <th>${state.lang === 'ar' ? 'عدد النتائج' : 'Results'}</th>
            <th>${state.lang === 'ar' ? 'المواد' : 'Subjects'}</th>
            <th>${state.lang === 'ar' ? 'المتوسط' : 'Average'}</th>
            <th>${state.lang === 'ar' ? 'آخر نتيجة' : 'Latest'}</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((student, i) => {
            const cls = state.classes.find(c => c.id === student.classId || (c.studentIds || []).includes(student.id));
            const summary = summarizeStudentGrades(student.id, grades);
            const latestPct = summary.latest ? getPct(summary.latest.score, summary.latest.maxScore) : 0;
            const searchText = `${student.name || ''} ${student.email || ''} ${cls?.name || ''}`.toLowerCase();
            return `
            <tr class="clickable-row grade-student-row" data-student-id="${student.id}" data-class-id="${student.classId || ''}" data-search="${escapeHTML(searchText)}">
              <td>${i + 1}</td>
              <td><div class="user-cell">${renderAvatar(student.name, student.photoURL, 'avatar-xs')}<span style="font-weight:700;color:var(--primary-light)">${escapeHTML(student.name || '')}</span></div></td>
              <td>${escapeHTML(cls?.name || '—')}</td>
              <td><span class="badge badge-info">${summary.list.length}</span></td>
              <td>${summary.subjects}</td>
              <td><span class="badge badge-${getBadgeType(summary.avg)}">${summary.list.length ? `${summary.avg}%` : '—'}</span></td>
              <td>${summary.latest ? `${escapeHTML(summary.latest.subject || '')} <span class="badge badge-${getBadgeType(latestPct)}">${latestPct}%</span>` : '—'}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="7" class="text-center text-muted">${t('noData')}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachGradeEvents() {
  document.getElementById('add-grade-btn')?.addEventListener('click', () => showGradeForm());
  document.getElementById('manage-weights-btn')?.addEventListener('click', () => showWeightForm());
  attachGradeActionEvents(document);

  document.querySelectorAll('.grade-student-row').forEach(row => {
    row.addEventListener('click', () => showStudentGradesModal(row.dataset.studentId));
  });

  const applyFilters = () => {
    const q = (document.getElementById('grade-search')?.value || '').trim().toLowerCase();
    const classId = document.getElementById('grade-class-filter')?.value || '';
    document.querySelectorAll('.grade-student-row').forEach(row => {
      const matchText = !q || row.dataset.search.includes(q) || row.textContent.toLowerCase().includes(q);
      const matchClass = !classId || row.dataset.classId === classId;
      row.style.display = matchText && matchClass ? '' : 'none';
    });
  };

  document.getElementById('grade-search')?.addEventListener('input', applyFilters);
  document.getElementById('grade-class-filter')?.addEventListener('change', applyFilters);
}

function attachGradeActionEvents(scope = document) {
  scope.querySelectorAll('.edit-grade').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const g = state.grades.find(x => x.id === b.dataset.id);
    if (g) showGradeForm(g);
  }));

  scope.querySelectorAll('.delete-grade').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try {
        const g = state.grades.find(x => x.id === b.dataset.id);
        await deleteDoc(doc(db, 'grades', b.dataset.id));
        await recordAudit('delete', 'grades', `حذف درجة: ${g?.subject || ''} - ${state.students.find(s => s.id === g?.studentId)?.name || ''}`);
        closeModal();
        showToast(t('deletedSuccess'), 'success');
      } catch (e) {
        showToast(t('errorOccurred'), 'error');
      }
    });
  }));
}

function showStudentGradesModal(studentId) {
  const role = state.profile?.role;
  const canEdit = role === 'admin' || role === 'teacher';
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const { grades } = getVisibleGradeContext();
  const studentGrades = grades
    .filter(g => g.studentId === studentId)
    .sort((a, b) => String(a.subject || '').localeCompare(String(b.subject || '')) || new Date(b.date || 0) - new Date(a.date || 0));
  const summary = summarizeStudentGrades(studentId, grades);
  const cls = state.classes.find(c => c.id === student.classId || (c.studentIds || []).includes(student.id));
  const bySubject = {};

  studentGrades.forEach(g => {
    const subject = g.subject || (state.lang === 'ar' ? 'بدون مادة' : 'No Subject');
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(g);
  });

  const subjectSections = Object.entries(bySubject).map(([subject, items]) => {
    const subjectTotal = items.reduce((sum, g) => sum + Number(g.score || 0), 0);
    const subjectMax = items.reduce((sum, g) => sum + Number(g.maxScore || 100), 0);
    const subjectPct = subjectMax > 0 ? Math.round((subjectTotal / subjectMax) * 100) : 0;
    return `
      <div class="sp-section-card grade-subject-card">
        <div class="grade-subject-head">
          <h4 class="sp-section-title">${escapeHTML(subject)}</h4>
          <span class="badge badge-${getBadgeType(subjectPct)}">${subjectPct}%</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'نوع الامتحان' : 'Exam Type'}</th>
                <th>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</th>
                <th>${state.lang === 'ar' ? 'النسبة' : 'Percent'}</th>
                <th>${state.lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                ${canEdit ? `<th>${state.lang === 'ar' ? 'إجراءات' : 'Actions'}</th>` : ''}
              </tr>
            </thead>
            <tbody>${items.map(g => {
              const pct = getPct(g.score, g.maxScore);
              return `
                <tr>
                  <td>${escapeHTML(getAssessmentLabel(g.examType))}</td>
                  <td>${Number(g.score || 0)} / ${Number(g.maxScore || 100)}</td>
                  <td><span class="badge badge-${getBadgeType(pct)}">${pct}%</span></td>
                  <td>${g.date ? new Date(g.date).toLocaleDateString(state.lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}</td>
                  ${canEdit ? `<td><button class="btn btn-sm btn-outline edit-grade" data-id="${g.id}">✏️</button> <button class="btn btn-sm btn-danger delete-grade" data-id="${g.id}">🗑️</button></td>` : ''}
                </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  showModal(
    state.lang === 'ar' ? `نتائج ${student.name}` : `${student.name} Results`,
    `
    <div class="student-grade-profile">
      <div class="sp-header" style="border-radius:var(--radius);">
        <div class="sp-user-info">
          ${renderAvatar(student.name, student.photoURL, 'avatar-lg')}
          <div class="sp-user-details">
            <h3>${escapeHTML(student.name || '')}</h3>
            <p>${escapeHTML(cls?.name || '—')} | ${escapeHTML(student.email || '—')}</p>
          </div>
        </div>
        <div class="grade-record-actions">
          <div class="sp-status-badge">${state.lang === 'ar' ? 'سجل الدرجات' : 'Grade Record'}</div>
          <button class="btn btn-sm btn-primary" id="print-student-grade-pdf">📄 ${state.lang === 'ar' ? 'طباعة PDF' : 'Print PDF'}</button>
        </div>
      </div>
      <div class="sp-widgets-grid">
        <div class="sp-widget widget-blue"><span class="sp-widget-title">${state.lang === 'ar' ? 'عدد النتائج' : 'Results'}</span><span class="sp-widget-value">${summary.list.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'عدد المواد' : 'Subjects'}</span><span class="sp-widget-value">${summary.subjects}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'المتوسط العام' : 'Average'}</span><span class="sp-widget-value">${summary.list.length ? `${summary.avg}%` : '—'}</span></div>
      </div>
      ${subjectSections || `<div class="empty-state"><p class="text-muted">${t('noData')}</p></div>`}
    </div>`,
    { wide: true }
  );

  attachGradeActionEvents(document.getElementById('confirm-dialog'));
  document.getElementById('print-student-grade-pdf')?.addEventListener('click', () => {
    downloadStudentGradeReport(student, cls, studentGrades, summary);
  });
}

function showGradeForm(grade = null) {
  const isEdit = !!grade;
  const role = state.profile?.role;
  const availableStudents = role === 'teacher' ? getVisibleGradeContext().students : state.students;

  showModal(isEdit ? (state.lang === 'ar' ? 'تعديل درجة' : 'Edit Grade') : (state.lang === 'ar' ? 'إضافة درجة' : 'Add Grade'), `
    <form id="grade-form" class="form-grid">
      <div class="form-group"><label>${state.lang === 'ar' ? 'الطالب' : 'Student'}</label>
        <select id="gf-student" class="form-select" required>${availableStudents.map(s => `<option value="${s.id}" ${grade?.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'المادة' : 'Subject'}</label><input type="text" id="gf-subject" class="form-input" value="${grade?.subject || ''}" required></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'نوع الامتحان' : 'Exam Type'}</label>
        <select id="gf-type" class="form-select">
          ${getAssessmentTypes().map(type => `<option value="${type.name}" ${grade?.examType === type.name ? 'selected' : ''}>${state.lang === 'ar' ? type.ar : type.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</label><input type="number" id="gf-score" class="form-input" value="${grade?.score || ''}" required min="0"></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الدرجة الكاملة' : 'Max Score'}</label><input type="number" id="gf-max" class="form-input" value="${grade?.maxScore || 100}" required min="1"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);

  document.getElementById('grade-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const score = Number(document.getElementById('gf-score').value);
    const maxScore = Number(document.getElementById('gf-max').value);

    if (!checkValid({
      student: { value: document.getElementById('gf-student').value, required: true, label: state.lang === 'ar' ? 'الطالب' : 'Student' },
      subject: { value: document.getElementById('gf-subject').value.trim(), required: true, label: state.lang === 'ar' ? 'المادة' : 'Subject' },
      score: { value: score, required: true, min: 0, max: maxScore, label: state.lang === 'ar' ? 'الدرجة' : 'Score' },
      maxScore: { value: maxScore, required: true, min: 1, label: state.lang === 'ar' ? 'الدرجة الكاملة' : 'Max Score' },
    }, state.lang)) return;

    const data = {
      studentId: document.getElementById('gf-student').value,
      subject: document.getElementById('gf-subject').value.trim(),
      examType: document.getElementById('gf-type').value,
      score,
      maxScore,
      teacherId: state.profile?.uid,
      date: new Date().toISOString().split('T')[0]
    };
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'grades', grade.id), data);
        await recordAudit('update', 'grades', `تعديل درجة: ${data.subject} - ${state.students.find(s => s.id === data.studentId)?.name || ''} - ${data.score}/${data.maxScore}`);
      } else {
        await addDoc(collection(db, 'grades'), data);
        await recordAudit('create', 'grades', `إضافة درجة: ${data.subject} - ${state.students.find(s => s.id === data.studentId)?.name || ''} - ${data.score}/${data.maxScore}`);
      }
      academicService.processAcademicAlerts(data.studentId);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Grades] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}

function showWeightForm() {
  showModal(state.lang === 'ar' ? 'أوزان المواد' : 'Subject Weights', `
    <div class="weight-manager">
      <form id="weight-form" class="form-grid">
        <div class="form-group"><label>${state.lang === 'ar' ? 'المادة' : 'Subject'}</label>
          <select id="wf-subject" class="form-select" required>
            ${state.subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>${state.lang === 'ar' ? 'نوع التقييم' : 'Assessment Type'}</label>
          <select id="wf-type" class="form-select" required>
            ${getAssessmentTypes().map(type => `<option value="${type.name}">${state.lang === 'ar' ? type.ar : type.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>${state.lang === 'ar' ? 'الوزن (%)' : 'Weight (%)'}</label><input type="number" id="wf-weight" class="form-input" required min="1" max="100"></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">${t('add')}</button></div>
      </form>
      <div class="table-responsive" style="margin-top: 1.5rem;">
        <table class="data-table">
          <thead><tr><th>${state.lang === 'ar' ? 'المادة' : 'Subject'}</th><th>${state.lang === 'ar' ? 'النوع' : 'Type'}</th><th>${state.lang === 'ar' ? 'الوزن' : 'Weight'}</th><th></th></tr></thead>
          <tbody id="weights-list">
            ${(state.subjectWeights || []).map(w => `
              <tr><td>${w.subject}</td><td>${w.examType}</td><td>${w.weight}%</td><td><button class="btn btn-sm btn-danger delete-weight" data-id="${w.id}">🗑️</button></td></tr>
            `).join('') || `<tr><td colspan="4" class="text-center">${t('noData')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById('weight-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      subject: document.getElementById('wf-subject').value,
      examType: document.getElementById('wf-type').value,
      weight: Number(document.getElementById('wf-weight').value),
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'subject_weights'), data);
      showToast(t('savedSuccess'), 'success');
      showWeightForm();
    } catch (e) {
      showToast(t('errorOccurred'), 'error');
    }
  });

  document.querySelectorAll('.delete-weight').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteDoc(doc(db, 'subject_weights', btn.dataset.id));
        showToast(t('deletedSuccess'), 'success');
        showWeightForm();
      } catch (e) {
        showToast(t('errorOccurred'), 'error');
      }
    });
  });
}
