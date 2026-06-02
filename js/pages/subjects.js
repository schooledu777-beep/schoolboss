import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { tCol, tDoc } from '../db.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML, renderAvatar } from '../ui.js';
import { uploadFile } from '../services/uploadService.js?v=20260502-photo-sync';

function subjectName(subject) {
  return subject?.name || '';
}

function subjectMatches(value, subject) {
  return String(value || '').trim().toLowerCase() === subjectName(subject).trim().toLowerCase();
}

function getSubjectStats(subject) {
  const name = subjectName(subject);
  const teachers = (state.teachers || []).filter(tch => {
    const subjects = Array.isArray(tch.subjects) ? tch.subjects : [tch.subject].filter(Boolean);
    return subjects.some(s => subjectMatches(s, subject));
  });
  const schedules = (state.schedules || []).filter(s => subjectMatches(s.subject, subject));
  const classIds = [...new Set(schedules.map(s => s.classId).filter(Boolean))];
  const classes = (state.classes || []).filter(c => classIds.includes(c.id));
  const grades = (state.grades || []).filter(g => subjectMatches(g.subject, subject));
  const homework = (state.homework || []).filter(h => subjectMatches(h.subject, subject));
  const exams = (state.exams || []).filter(e => subjectMatches(e.subject, subject));
  const total = grades.reduce((sum, g) => sum + Number(g.score || 0), 0);
  const max = grades.reduce((sum, g) => sum + Number(g.maxScore || 100), 0);
  const avg = grades.length && max > 0 ? Math.round((total / max) * 100) : 0;
  return { teachers, schedules, classes, grades, homework, exams, avg };
}

function badgeType(percent) {
  if (percent >= 85) return 'success';
  if (percent >= 60) return 'warning';
  return 'danger';
}

function isAllowedMaterialFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return type.startsWith('image/') || type === 'application/pdf' || name.endsWith('.pdf');
}

function getMaterialType(file) {
  const name = String(file?.name || '').toLowerCase();
  if (String(file?.type || '').startsWith('image/')) return file.type;
  if (String(file?.type || '').toLowerCase() === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf';
  return file?.type || 'application/octet-stream';
}

function materialIcon(material) {
  return String(material?.type || '').startsWith('image/') ? '🖼️' : '📄';
}

function renderSubjectMaterials(materials = []) {
  if (!materials.length) {
    return `<span class="text-muted">${state.lang === 'ar' ? 'لا توجد ملفات مرفوعة' : 'No uploaded files'}</span>`;
  }

  return materials.map(m => `
    <a class="btn btn-sm btn-outline subject-material-link" href="${escapeHTML(m.url || '#')}" target="_blank" rel="noopener" title="${escapeHTML(m.name || 'file')}">
      ${materialIcon(m)} ${escapeHTML(m.name || 'file')}
    </a>
  `).join('');
}

export function renderSubjects() {
  const isAdmin = state.profile?.role === 'admin';
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('subjects')}</h2>
      ${isAdmin ? `<button class="btn btn-primary" id="add-subject-btn">+ ${t('add')}</button>` : ''}
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="subject-search" class="form-input" placeholder="🔍 ${t('search')}...">
    </div>
    <div class="table-responsive glass-card table-cards">
      <table class="data-table" id="subjects-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${t('subjectName')}</th>
            <th>${t('subjectCode')}</th>
            <th>${state.lang === 'ar' ? 'المعلمون' : 'Teachers'}</th>
            <th>${state.lang === 'ar' ? 'الصفوف' : 'Classes'}</th>
            <th>${state.lang === 'ar' ? 'متوسط الدرجات' : 'Grade Avg'}</th>
            <th>${state.lang === 'ar' ? 'ملفات' : 'Files'}</th>
            ${isAdmin ? `<th>${state.lang === 'ar' ? 'إجراءات' : 'Actions'}</th>` : ''}
          </tr>
        </thead>
        <tbody id="subjects-tbody">
          ${renderSubjectsRows(state.subjects || [])}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderSubjectsRows(subjects) {
  const isAdmin = state.profile?.role === 'admin';
  if (!subjects.length) return `<tr><td colspan="${isAdmin ? 8 : 7}" class="text-center py-4">${t('noData')}</td></tr>`;

  return subjects.map((sub, i) => {
    const stats = getSubjectStats(sub);
    const searchText = `${sub.name || ''} ${sub.code || ''} ${sub.description || ''}`.toLowerCase();
    return `
      <tr class="clickable-row subject-row" data-id="${sub.id}" data-search="${escapeHTML(searchText)}">
        <td>${i + 1}</td>
        <td>
          <div style="font-weight:800;color:var(--primary-light)">${escapeHTML(sub.name || '')}</div>
          <div class="text-muted text-sm">${escapeHTML((sub.description || '').slice(0, 72)) || '—'}</div>
          ${sub.isOnline ? `<span class="badge badge-info">🌐 ${state.lang === 'ar' ? 'أونلاين' : 'Online'}</span>` : ''}
        </td>
        <td><span class="badge badge-info">${escapeHTML(sub.code || '-')}</span></td>
        <td>${stats.teachers.length}</td>
        <td>${stats.classes.length}</td>
        <td><span class="badge badge-${badgeType(stats.avg)}">${stats.grades.length ? `${stats.avg}%` : '—'}</span></td>
        <td>${(sub.materials || []).length}</td>
        ${isAdmin ? `<td>
          <button class="btn btn-sm btn-outline edit-subject" data-id="${sub.id}">✏️</button>
          <button class="btn btn-sm btn-danger delete-subject" data-id="${sub.id}">🗑️</button>
        </td>` : ''}
      </tr>`;
  }).join('');
}

export function attachSubjectEvents() {
  document.getElementById('add-subject-btn')?.addEventListener('click', () => showSubjectForm());

  document.getElementById('subject-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = (state.subjects || []).filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
    const tbody = document.getElementById('subjects-tbody');
    if (tbody) tbody.innerHTML = renderSubjectsRows(filtered);
    attachActionEvents();
  });

  attachActionEvents();
}

function attachActionEvents() {
  document.querySelectorAll('.subject-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('button,a')) return;
      const subject = (state.subjects || []).find(s => s.id === row.dataset.id);
      if (subject) showSubjectProfile(subject);
    });
  });

  document.querySelectorAll('.edit-subject').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const subject = (state.subjects || []).find(s => s.id === btn.dataset.id);
      if (subject) showSubjectForm(subject);
    });
  });

  document.querySelectorAll('.delete-subject').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showConfirm(t('delete'), t('confirmDelete'), async () => {
        try {
          await deleteDoc(tDoc('subjects',btn.dataset.id));
          closeModal();
          showToast(t('deletedSuccess'), 'success');
        } catch (err) {
          console.error(err);
          showToast(t('errorOccurred'), 'error');
        }
      }, 'danger');
    });
  });
}

function showSubjectProfile(subject) {
  const isAdmin = state.profile?.role === 'admin';
  const canManageMaterials = ['admin', 'teacher'].includes(state.profile?.role);
  const stats = getSubjectStats(subject);
  const scheduleRows = stats.schedules.slice(0, 12).map(s => {
    const cls = state.classes.find(c => c.id === s.classId);
    const teacher = state.teachers.find(tch => tch.id === s.teacherId);
    return `<tr>
      <td>${cls?.name || '—'}</td>
      <td>${teacher?.name || s.teacherName || '—'}</td>
      <td>${s.dayName || s.dayOfWeek || '—'}</td>
      <td>${s.startTime || ''}${s.endTime ? ` - ${s.endTime}` : ''}</td>
    </tr>`;
  }).join('');

  const gradeRows = stats.grades.slice(0, 12).map(g => {
    const student = state.students.find(s => s.id === g.studentId);
    const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
    return `<tr>
      <td>${student?.name || '—'}</td>
      <td>${g.examType || '—'}</td>
      <td>${g.score || 0} / ${g.maxScore || 100}</td>
      <td><span class="badge badge-${badgeType(pct)}">${pct}%</span></td>
    </tr>`;
  }).join('');

  showModal(
    state.lang === 'ar' ? `ملف مادة ${subject.name}` : `${subject.name} Profile`,
    `
    <div class="subject-profile">
      <div class="sp-header subject-profile-header">
        <div>
          <h3>${escapeHTML(subject.name || '')}</h3>
          <p class="text-muted">${escapeHTML(subject.code || '—')} | ${escapeHTML(subject.description || (state.lang === 'ar' ? 'لا يوجد وصف' : 'No description'))}</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${isAdmin ? `<button class="btn btn-sm btn-outline" id="subject-edit-btn">✏️ ${t('edit')}</button>` : ''}
          ${isAdmin ? `<button class="btn btn-sm btn-primary" id="subject-add-grade-btn">+ ${state.lang === 'ar' ? 'درجة' : 'Grade'}</button>` : ''}
          <button class="btn btn-sm btn-outline" id="subject-open-schedule">📅 ${state.lang === 'ar' ? 'الجداول' : 'Schedule'}</button>
        </div>
      </div>

      <div class="sp-widgets-grid">
        <div class="sp-widget widget-blue"><span class="sp-widget-title">${state.lang === 'ar' ? 'المعلمون' : 'Teachers'}</span><span class="sp-widget-value">${stats.teachers.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'الصفوف' : 'Classes'}</span><span class="sp-widget-value">${stats.classes.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'الدرجات' : 'Grades'}</span><span class="sp-widget-value">${stats.grades.length}</span></div>
        <div class="sp-widget widget-dark"><span class="sp-widget-title">${state.lang === 'ar' ? 'المتوسط' : 'Average'}</span><span class="sp-widget-value">${stats.grades.length ? `${stats.avg}%` : '—'}</span></div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">👨‍🏫 ${state.lang === 'ar' ? 'المعلمون المرتبطون' : 'Linked Teachers'}</h4>
        <div class="subject-linked-grid">
          ${stats.teachers.map(tch => `<div class="subject-linked-card">${renderAvatar(tch.name, tch.photoURL, 'avatar-sm')}<div><strong>${escapeHTML(tch.name || '')}</strong><p class="text-muted text-sm">${escapeHTML(tch.email || '')}</p></div></div>`).join('') || `<p class="text-muted">${t('noData')}</p>`}
        </div>
      </div>

      <div class="sp-section-card">
        <div class="subject-materials-toolbar">
        <h4 class="sp-section-title">📎 ${state.lang === 'ar' ? 'ملفات وملازم المادة' : 'Subject Materials'}</h4>
          ${canManageMaterials ? `
            <label class="btn btn-sm btn-primary subject-upload-label" id="subject-material-upload-label">
              + ${state.lang === 'ar' ? '\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0623\u0648 PDF' : 'Upload image/PDF'}
              <input type="file" id="subject-material-upload" accept="image/*,.pdf,application/pdf" multiple hidden>
            </label>
          ` : ''}
        </div>
        <div class="subject-materials" id="subject-materials-list">
          ${renderSubjectMaterials(subject.materials || [])}
        </div>
        ${canManageMaterials ? `<p class="text-muted text-sm subject-upload-hint">${state.lang === 'ar' ? '\u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u062f\u0639\u0648\u0645\u0629: \u0627\u0644\u0635\u0648\u0631 \u0648\u0645\u0644\u0641\u0627\u062a PDF \u0641\u0642\u0637.' : 'Supported files: images and PDF only.'}</p>` : ''}
      </div>
      <div class="sp-section-card">
        <h4 class="sp-section-title">📅 ${state.lang === 'ar' ? 'آخر الحصص المجدولة' : 'Recent Scheduled Lessons'}</h4>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>${state.lang === 'ar' ? 'الصف' : 'Class'}</th><th>${state.lang === 'ar' ? 'المعلم' : 'Teacher'}</th><th>${state.lang === 'ar' ? 'اليوم' : 'Day'}</th><th>${state.lang === 'ar' ? 'الوقت' : 'Time'}</th></tr></thead><tbody>${scheduleRows || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table></div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">📝 ${state.lang === 'ar' ? 'آخر النتائج' : 'Recent Grades'}</h4>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>${state.lang === 'ar' ? 'الطالب' : 'Student'}</th><th>${state.lang === 'ar' ? 'النوع' : 'Type'}</th><th>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</th><th>${state.lang === 'ar' ? 'النسبة' : 'Percent'}</th></tr></thead><tbody>${gradeRows || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table></div>
      </div>
    </div>`,
    { wide: true }
  );

  document.getElementById('subject-edit-btn')?.addEventListener('click', () => showSubjectForm(subject));
  document.getElementById('subject-open-schedule')?.addEventListener('click', () => {
    closeModal();
    window.location.hash = 'schedule';
  });
  document.getElementById('subject-add-grade-btn')?.addEventListener('click', () => {
    closeModal();
    showSubjectGradeForm(subject);
  });

  document.getElementById('subject-material-upload')?.addEventListener('change', async e => {
    const input = e.currentTarget;
    const files = [...(input.files || [])];
    if (!files.length) return;

    const invalidFiles = files.filter(file => !isAllowedMaterialFile(file));
    if (invalidFiles.length) {
      showToast(state.lang === 'ar' ? 'يمكن رفع الصور وملفات PDF فقط' : 'Only images and PDF files are allowed', 'error');
      input.value = '';
      return;
    }

    const label = document.getElementById('subject-material-upload-label');
    const oldLabel = label?.innerHTML;
    if (label) {
      label.classList.add('disabled');
      label.innerHTML = `<span class="spinner-sm"></span> ${state.lang === 'ar' ? 'جاري الرفع...' : 'Uploading...'}`;
    }

    try {
      const uploadedMaterials = [];
      for (const file of files) {
        const url = await uploadFile(file, 'subjects/materials');
        uploadedMaterials.push({
          name: file.name,
          url,
          type: getMaterialType(file),
          size: file.size || 0,
          uploadedAt: new Date().toISOString(),
          uploadedBy: state.profile?.uid || null
        });
      }

      const materials = [...(subject.materials || []), ...uploadedMaterials];
      await updateDoc(tDoc('subjects',subject.id), {
        materials,
        isOnline: true,
        updatedAt: new Date().toISOString()
      });
      subject.materials = materials;
      subject.isOnline = true;

      const list = document.getElementById('subject-materials-list');
      if (list) list.innerHTML = renderSubjectMaterials(materials);
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(err?.message || t('errorOccurred'), 'error', 5000);
    } finally {
      input.value = '';
      if (label && oldLabel) {
        label.classList.remove('disabled');
        label.innerHTML = oldLabel;
      }
    }
  });
}

function showSubjectGradeForm(subject) {
  showModal(state.lang === 'ar' ? `إضافة درجة - ${subject.name}` : `Add Grade - ${subject.name}`, `
    <form id="subject-grade-form" class="form-grid">
      <div class="form-group"><label>${state.lang === 'ar' ? 'الطالب' : 'Student'}</label><select id="sg-student" class="form-select" required>${state.students.map(s => `<option value="${s.id}">${escapeHTML(s.name || '')}</option>`).join('')}</select></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'نوع الامتحان' : 'Exam Type'}</label><input id="sg-type" class="form-input" value="quiz"></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</label><input id="sg-score" class="form-input" type="number" min="0" required></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'من' : 'Max'}</label><input id="sg-max" class="form-input" type="number" min="1" value="100" required></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>
  `);
  document.getElementById('subject-grade-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await addDoc(tCol('grades'), {
        studentId: document.getElementById('sg-student').value,
        subject: subject.name,
        examType: document.getElementById('sg-type').value.trim() || 'quiz',
        score: Number(document.getElementById('sg-score').value),
        maxScore: Number(document.getElementById('sg-max').value) || 100,
        teacherId: state.profile?.uid,
        date: new Date().toISOString().split('T')[0]
      });
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
    }
  });
}

function showSubjectForm(subject = null) {
  const isEdit = !!subject;
  const title = isEdit ? `${t('edit')} ${t('subjects')}` : `${t('add')} ${t('subjects')}`;

  showModal(title, `
    <form id="subject-form" class="form-grid">
      <div class="form-group full-width"><label>${t('subjectName')}</label><input type="text" id="sf-name" class="form-input" value="${escapeHTML(subject?.name || '')}" required></div>
      <div class="form-group full-width"><label>${t('subjectCode')}</label><input type="text" id="sf-code" class="form-input" value="${escapeHTML(subject?.code || '')}" required placeholder="MATH101"></div>
      <div class="form-group full-width"><label>${t('description')}</label><textarea id="sf-desc" class="form-input" rows="3">${escapeHTML(subject?.description || '')}</textarea></div>
      <div class="form-group full-width">
        <label class="toggle-label" style="display:inline-flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="sf-online" ${subject?.isOnline ? 'checked' : ''}>
          <span>${state.lang === 'ar' ? 'مادة أونلاين وتدعم رفع الملفات' : 'Online subject with materials'}</span>
        </label>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'ملفات وملازم المادة' : 'Subject Files'}</label>
        <input type="file" id="sf-materials" class="form-input" accept="image/*,.pdf,application/pdf" multiple>
        <div id="existing-materials" class="subject-materials" style="margin-top:.75rem">
          ${(subject?.materials || []).map(m => `<span class="badge badge-info" data-url="${escapeHTML(m.url)}" data-name="${escapeHTML(m.name)}">📄 ${escapeHTML(m.name)} <button type="button" class="btn-icon remove-material" style="font-size:.75rem">×</button></span>`).join('')}
        </div>
      </div>
      <div class="form-actions full-width">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>
  `);

  document.querySelectorAll('.remove-material').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.badge')?.remove());
  });

  document.getElementById('subject-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      const existingMaterials = [...document.querySelectorAll('#existing-materials .badge')].map(el => ({
        url: el.dataset.url,
        name: el.dataset.name
      })).filter(m => m.url);
      const uploadedMaterials = [];
      const files = [...document.getElementById('sf-materials').files];
      const invalidFiles = files.filter(file => !isAllowedMaterialFile(file));
      if (invalidFiles.length) {
        showToast(state.lang === 'ar' ? 'يمكن رفع الصور وملفات PDF فقط' : 'Only images and PDF files are allowed', 'error');
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        return;
      }

      for (const file of files) {
        const url = await uploadFile(file, 'subjects/materials');
        uploadedMaterials.push({ name: file.name, url, type: getMaterialType(file), size: file.size || 0 });
      }

      const data = {
        name: document.getElementById('sf-name').value.trim(),
        code: document.getElementById('sf-code').value.trim().toUpperCase(),
        description: document.getElementById('sf-desc').value.trim(),
        isOnline: document.getElementById('sf-online').checked,
        materials: [...existingMaterials, ...uploadedMaterials],
        updatedAt: new Date().toISOString()
      };

      if (isEdit) await updateDoc(tDoc('subjects',subject.id), data);
      else await addDoc(tCol('subjects'), { ...data, createdAt: new Date().toISOString() });

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
