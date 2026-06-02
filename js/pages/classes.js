import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { tCol, tDoc } from '../db.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML, renderAvatar } from '../ui.js';
import { recordAudit } from './auditLog.js';
import { showStudentCardModal } from './students.js?v=20260506-custom-fields';
import { awardBehaviorPoints, renderBehaviorBadge, renderQuickBehaviorActions } from '../services/behaviorService.js?v=20260506-behavior';

function getClassStudents(cls) {
  const explicitIds = cls.studentIds || [];
  return (state.students || []).filter(s => explicitIds.includes(s.id) || s.classId === cls.id);
}

function getClassTeachers(cls) {
  const ids = [cls.teacherId, ...(cls.teacherIds || [])].filter(Boolean);
  return (state.teachers || []).filter(tch => ids.includes(tch.id));
}

function getClassStats(cls) {
  const students = getClassStudents(cls);
  const studentIds = students.map(s => s.id);
  const schedules = (state.schedules || []).filter(s => s.classId === cls.id);
  const attendance = (state.attendance || []).filter(a => a.classId === cls.id || studentIds.includes(a.studentId));
  const grades = (state.grades || []).filter(g => studentIds.includes(g.studentId));
  const homework = (state.homework || []).filter(h => h.classId === cls.id);
  const subjects = [...new Set([
    ...schedules.map(s => s.subject),
    ...grades.map(g => g.subject),
    ...homework.map(h => h.subject)
  ].filter(Boolean))];
  const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const gradeTotal = grades.reduce((sum, g) => sum + Number(g.score || 0), 0);
  const gradeMax = grades.reduce((sum, g) => sum + Number(g.maxScore || 100), 0);
  const gradeAvg = grades.length && gradeMax > 0 ? Math.round((gradeTotal / gradeMax) * 100) : 0;
  const totalPoints = students.reduce((sum, s) => sum + Number(s.total_points || 0), 0);
  return { students, schedules, attendance, grades, homework, subjects, attendanceRate, gradeAvg, totalPoints };
}

function badgeType(value) {
  if (value >= 85) return 'success';
  if (value >= 60) return 'warning';
  return 'danger';
}

export function renderClasses() {
  const isAdmin = state.profile?.role === 'admin';
  const totalStudents = (state.classes || []).reduce((sum, c) => sum + getClassStudents(c).length, 0);
  const assignedClasses = (state.classes || []).filter(c => c.teacherId || (c.teacherIds || []).length).length;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('classes')}</h2>
        <p class="text-muted">${state.lang === 'ar' ? 'ملفات تفصيلية للصفوف والطلاب والمعلمين والجداول' : 'Detailed class profiles with students, teachers, and schedules'}</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" id="add-class-btn">+ ${t('add')}</button>` : ''}
    </div>

    <div class="class-summary-grid">
      <div class="class-summary-card glass-card"><span>${state.lang === 'ar' ? 'إجمالي الصفوف' : 'Total Classes'}</span><strong>${state.classes.length}</strong></div>
      <div class="class-summary-card glass-card"><span>${t('students')}</span><strong>${totalStudents}</strong></div>
      <div class="class-summary-card glass-card"><span>${state.lang === 'ar' ? 'صفوف لها معلم' : 'Assigned Teachers'}</span><strong>${assignedClasses}</strong></div>
    </div>

    <div class="filter-bar glass-card">
      <input type="text" id="class-search" class="form-input" placeholder="🔍 ${t('search')}...">
    </div>

    <div class="classes-grid classes-grid-redesign" id="classes-grid">
      ${renderClassCards(state.classes || [])}
    </div>
  </div>`;
}

function renderClassCards(classes) {
  if (!classes.length) {
    return `<div class="full-width text-center py-5"><p class="text-muted">${t('noData')}</p></div>`;
  }

  return classes.map((cls, index) => {
    const stats = getClassStats(cls);
    const teachers = getClassTeachers(cls);
    const colorClass = ['class-accent-purple', 'class-accent-cyan', 'class-accent-green', 'class-accent-amber', 'class-accent-red'][index % 5];
    const searchText = `${cls.name || ''} ${cls.grade || ''} ${cls.section || ''} ${teachers.map(tch => tch.name).join(' ')}`.toLowerCase();
    return `
    <div class="class-card glass-card ${colorClass} clickable-row class-profile-card" data-id="${cls.id}" data-search="${escapeHTML(searchText)}">
      <div class="class-header">
        <div>
          <span class="class-kicker">${escapeHTML(cls.grade || (state.lang === 'ar' ? 'صف' : 'Grade'))}</span>
          <h3>${escapeHTML(cls.name || '')}</h3>
        </div>
        <span class="class-count">${stats.students.length}</span>
      </div>
      <div class="class-body">
        <div class="class-stat">
          <span>👨‍🏫</span>
          <div><small>${state.lang === 'ar' ? 'المعلم' : 'Teacher'}</small><strong>${escapeHTML(teachers[0]?.name || (state.lang === 'ar' ? 'غير محدد' : 'Not Assigned'))}</strong></div>
        </div>
        <div class="class-stat">
          <span>📚</span>
          <div><small>${state.lang === 'ar' ? 'المواد' : 'Subjects'}</small><strong>${stats.subjects.length}</strong></div>
        </div>
        <div class="class-roster">
          ${stats.students.slice(0, 5).map(s => `<span title="${escapeHTML(s.name)}">${escapeHTML((s.name || '?').slice(0, 2).toUpperCase())}</span>`).join('')}
          ${stats.students.length > 5 ? `<span class="more">+${stats.students.length - 5}</span>` : ''}
          ${stats.students.length === 0 ? `<em>${state.lang === 'ar' ? 'لا يوجد طلاب بعد' : 'No students yet'}</em>` : ''}
        </div>
      </div>
      <div class="class-actions">
        <button class="btn btn-sm btn-outline open-class" data-id="${cls.id}">${state.lang === 'ar' ? 'فتح' : 'Open'}</button>
        ${state.profile?.role === 'admin' ? `<button class="btn btn-sm btn-outline edit-class" data-id="${cls.id}">${state.lang === 'ar' ? 'تعديل' : 'Edit'}</button>` : ''}
        ${state.profile?.role === 'admin' ? `<button class="btn btn-sm btn-danger delete-class" data-id="${cls.id}">${state.lang === 'ar' ? 'حذف' : 'Delete'}</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

export function attachClassEvents() {
  document.getElementById('add-class-btn')?.addEventListener('click', () => showClassForm());

  document.getElementById('class-search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.class-profile-card').forEach(card => {
      card.style.display = !q || card.dataset.search.includes(q) || card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  attachClassActionEvents();
}

function attachClassActionEvents(scope = document) {
  scope.querySelectorAll('.class-profile-card, .open-class').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('.edit-class,.delete-class')) return;
    const id = el.dataset.id || e.target.closest('[data-id]')?.dataset.id;
    const cls = state.classes.find(c => c.id === id);
    if (cls) showClassProfile(cls);
  }));

  scope.querySelectorAll('.edit-class').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const cls = state.classes.find(c => c.id === btn.dataset.id);
    if (cls) showClassForm(cls);
  }));

  scope.querySelectorAll('.delete-class').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try {
        const cls = state.classes.find(c => c.id === btn.dataset.id);
        await deleteDoc(tDoc('classes',btn.dataset.id));
        await recordAudit('delete', 'classes', `حذف صف: ${cls?.name || btn.dataset.id}`);
        closeModal();
        showToast(t('deletedSuccess'), 'success');
      } catch {
        showToast(t('errorOccurred'), 'error');
      }
    });
  }));
}

function showClassProfile(cls) {
  const isAdmin = state.profile?.role === 'admin';
  const stats = getClassStats(cls);
  const teachers = getClassTeachers(cls);
  const scheduleRows = stats.schedules.slice(0, 12).map(s => {
    const teacher = state.teachers.find(t => t.id === s.teacherId);
    return `<tr><td>${s.dayName || s.dayOfWeek || '—'}</td><td>${s.startTime || ''}${s.endTime ? ` - ${s.endTime}` : ''}</td><td>${escapeHTML(s.subject || '—')}</td><td>${escapeHTML(teacher?.name || s.teacherName || '—')}</td></tr>`;
  }).join('');
  const attendanceRows = stats.attendance.slice(0, 12).map(a => {
    const student = state.students.find(s => s.id === a.studentId);
    return `<tr><td>${escapeHTML(student?.name || '—')}</td><td>${a.date || '—'}</td><td><span class="badge badge-${a.status === 'absent' ? 'danger' : 'success'}">${a.status || '—'}</span></td></tr>`;
  }).join('');
  const gradeRows = stats.grades.slice(0, 12).map(g => {
    const student = state.students.find(s => s.id === g.studentId);
    const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
    return `<tr><td>${escapeHTML(student?.name || '—')}</td><td>${escapeHTML(g.subject || '—')}</td><td>${g.score || 0}/${g.maxScore || 100}</td><td><span class="badge badge-${badgeType(pct)}">${pct}%</span></td></tr>`;
  }).join('');

  showModal(
    state.lang === 'ar' ? `ملف الصف ${cls.name}` : `${cls.name} Profile`,
    `
    <div class="class-profile">
      <div class="sp-header class-profile-header">
        <div>
          <h3>${escapeHTML(cls.name || '')}</h3>
          <p class="text-muted">${escapeHTML(cls.grade || '—')} | ${escapeHTML(cls.section || '—')}</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${isAdmin ? `<button class="btn btn-sm btn-outline" id="class-edit-btn">✏️ ${t('edit')}</button>` : ''}
          <button class="btn btn-sm btn-outline" id="class-attendance-btn">📋 ${state.lang === 'ar' ? 'الحضور' : 'Attendance'}</button>
          <button class="btn btn-sm btn-outline" id="class-schedule-btn">📅 ${state.lang === 'ar' ? 'الجدول' : 'Schedule'}</button>
        </div>
      </div>

      <div class="sp-widgets-grid">
        <div class="sp-widget widget-blue"><span class="sp-widget-title">${t('students')}</span><span class="sp-widget-value">${stats.students.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'المعلمون' : 'Teachers'}</span><span class="sp-widget-value">${teachers.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'الحضور' : 'Attendance'}</span><span class="sp-widget-value">${stats.attendance.length ? `${stats.attendanceRate}%` : '—'}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'المتوسط' : 'Average'}</span><span class="sp-widget-value">${stats.grades.length ? `${stats.gradeAvg}%` : '—'}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'نقاط السلوك' : 'Behavior Points'}</span><span class="sp-widget-value">${stats.totalPoints}</span></div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">👨‍🏫 ${state.lang === 'ar' ? 'المعلمون' : 'Teachers'}</h4>
        <div class="class-linked-grid">
          ${teachers.map(tch => `<div class="class-linked-card">${renderAvatar(tch.name, tch.photoURL, 'avatar-sm')}<div><strong>${escapeHTML(tch.name || '')}</strong><p class="text-muted text-sm">${escapeHTML((tch.subjects || []).join(', ') || tch.email || '')}</p></div></div>`).join('') || `<p class="text-muted">${t('noData')}</p>`}
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">🎓 ${t('students')}</h4>
        <div class="class-student-grid behavior-class-grid">
          ${stats.students.map(s => `
            <div class="class-student-card behavior-student-card" data-student-id="${s.id}">
              <button class="behavior-student-open" data-student-id="${s.id}">
                ${renderAvatar(s.name, s.photoURL, 'avatar-sm')}
                <span>${escapeHTML(s.name || '')}</span>
                ${renderBehaviorBadge(s, true)}
              </button>
              ${renderQuickBehaviorActions(s.id)}
            </div>
          `).join('') || `<p class="text-muted">${t('noData')}</p>`}
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">📅 ${state.lang === 'ar' ? 'آخر الحصص في الجدول' : 'Recent Schedule'}</h4>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>${state.lang === 'ar' ? 'اليوم' : 'Day'}</th><th>${state.lang === 'ar' ? 'الوقت' : 'Time'}</th><th>${state.lang === 'ar' ? 'المادة' : 'Subject'}</th><th>${state.lang === 'ar' ? 'المعلم' : 'Teacher'}</th></tr></thead><tbody>${scheduleRows || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table></div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">📋 ${state.lang === 'ar' ? 'آخر الحضور' : 'Recent Attendance'}</h4>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>${state.lang === 'ar' ? 'الطالب' : 'Student'}</th><th>${state.lang === 'ar' ? 'التاريخ' : 'Date'}</th><th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th></tr></thead><tbody>${attendanceRows || `<tr><td colspan="3" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table></div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">📝 ${state.lang === 'ar' ? 'آخر الدرجات' : 'Recent Grades'}</h4>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>${state.lang === 'ar' ? 'الطالب' : 'Student'}</th><th>${state.lang === 'ar' ? 'المادة' : 'Subject'}</th><th>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</th><th>${state.lang === 'ar' ? 'النسبة' : 'Percent'}</th></tr></thead><tbody>${gradeRows || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table></div>
      </div>
    </div>`,
    { wide: true }
  );

  document.getElementById('class-edit-btn')?.addEventListener('click', () => showClassForm(cls));
  document.getElementById('class-attendance-btn')?.addEventListener('click', () => {
    closeModal();
    window.location.hash = 'attendance';
  });
  document.getElementById('class-schedule-btn')?.addEventListener('click', () => {
    closeModal();
    window.location.hash = 'schedule';
  });
  document.querySelectorAll('.behavior-student-open').forEach(btn => {
    btn.addEventListener('click', () => showStudentCardModal(btn.dataset.studentId));
  });
  document.querySelectorAll('.behavior-quick-action').forEach(btn => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await awardBehaviorPoints(btn.dataset.studentId, Number(btn.dataset.points), btn.dataset.category);
        showToast(state.lang === 'ar' ? 'تم تسجيل النقاط' : 'Points recorded', 'success');
      } catch (error) {
        console.error(error);
        showToast(t('errorOccurred'), 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  });
}

function showClassForm(cls = null) {
  const isEdit = !!cls;
  showModal(isEdit ? (state.lang === 'ar' ? 'تعديل الصف' : 'Edit Level') : (state.lang === 'ar' ? 'إضافة صف' : 'Add Level'), `
    <form id="class-form" class="form-grid">
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'الصف' : 'Level/Grade'}</label>
        <input type="text" id="cf-grade" class="form-input" value="${escapeHTML(cls?.grade || '')}" placeholder="${state.lang === 'ar' ? 'مثلاً: الصف الأول' : 'e.g. First Grade'}" required>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'الشعبة' : 'Section'}</label>
        <input type="text" id="cf-section" class="form-input" value="${escapeHTML(cls?.section || '')}" placeholder="${state.lang === 'ar' ? 'مثلاً: A' : 'e.g. A'}" required>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'الاسم المعروض' : 'Display Name'}</label>
        <input type="text" id="cf-name" class="form-input" value="${escapeHTML(cls?.name || '')}" readonly>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'المعلم المسؤول' : 'Teacher'}</label>
        <select id="cf-teacher" class="form-select">
          <option value="">—</option>
          ${state.teachers.map(tch => `<option value="${tch.id}" ${cls?.teacherId === tch.id ? 'selected' : ''}>${escapeHTML(tch.name || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'اختيار الطلاب' : 'Select Students'}</label>
        <select id="cf-students" class="form-select" multiple size="8" style="height:150px;">
          ${state.students.map(s => `<option value="${s.id}" ${(cls?.studentIds || []).includes(s.id) || s.classId === cls?.id ? 'selected' : ''}>${escapeHTML(s.name || '')}</option>`).join('')}
        </select>
        <small class="text-muted">${state.lang === 'ar' ? 'استخدم Ctrl للاختيار المتعدد' : 'Use Ctrl for multi-select'}</small>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  const gradeInp = document.getElementById('cf-grade');
  const sectionInp = document.getElementById('cf-section');
  const nameInp = document.getElementById('cf-name');
  const updateName = () => {
    nameInp.value = [gradeInp.value.trim(), sectionInp.value.trim()].filter(Boolean).join(' - ');
  };
  gradeInp.addEventListener('input', updateName);
  sectionInp.addEventListener('input', updateName);
  if (!nameInp.value) updateName();

  document.getElementById('class-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';
    const studentIds = Array.from(document.getElementById('cf-students').selectedOptions).map(o => o.value);
    const data = {
      name: nameInp.value.trim(),
      grade: gradeInp.value.trim(),
      section: sectionInp.value.trim(),
      teacherId: document.getElementById('cf-teacher').value,
      studentIds,
      updatedAt: new Date().toISOString()
    };
    try {
      if (isEdit) {
        await updateDoc(tDoc('classes',cls.id), data);
        await Promise.all(state.students.map(s => {
          if (studentIds.includes(s.id)) return updateDoc(tDoc('students',s.id), { classId: cls.id }).catch(() => {});
          if (s.classId === cls.id && !studentIds.includes(s.id)) return updateDoc(tDoc('students',s.id), { classId: '' }).catch(() => {});
          return Promise.resolve();
        }));
        await recordAudit('update', 'classes', `تعديل صف: ${data.name}`);
      } else {
        data.createdAt = new Date().toISOString();
        const ref = await addDoc(tCol('classes'), data);
        await Promise.all(studentIds.map(id => updateDoc(tDoc('students',id), { classId: ref.id }).catch(() => {})));
        await recordAudit('create', 'classes', `إضافة صف جديد: ${data.name}`);
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}
