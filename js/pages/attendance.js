import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, doc, getDocs, query, where } from '../firebase-config.js';
import { showToast } from '../ui.js';
import { academicService } from '../services/academicService.js';

export function renderAttendance() {
  const role = state.profile?.role;
  const todayStr = new Date().toISOString().split('T')[0];
  let classes = state.classes;
  if (role === 'teacher') {
    classes = state.classes.filter(c => c.teacherId === state.profile?.uid || (c.teacherIds||[]).includes(state.profile?.uid));
  } else if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    classes = state.classes.filter(c => c.studentIds?.some(id => kidIds.includes(id)));
  } else if (role === 'student') {
    classes = state.classes.filter(c => c.studentIds?.includes(state.profile?.uid));
  }
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('attendance')}</h2></div>
    <div class="filter-bar glass-card">
      <div class="form-group"><label>${state.lang==='ar'?'الفصل':'Class'}</label>
        <select id="att-class" class="form-select"><option value="">${state.lang==='ar'?'اختر فصلاً':'Select Class'}</option>${classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'التاريخ':'Date'}</label>
        <input type="date" id="att-date" class="form-input" value="${todayStr}">
      </div>
      <button class="btn btn-primary" id="load-att-btn">${state.lang==='ar'?'تحميل':'Load'}</button>
    </div>
    <div id="att-list" class="glass-card" style="padding:1.5rem;">
      <p class="text-muted text-center">${state.lang==='ar'?'اختر فصلاً وتاريخاً لعرض الحضور':'Select a class and date to load attendance'}</p>
    </div>
    ${role !== 'parent' && role !== 'student' ? `<div style="margin-top:1rem;text-align:center;"><button class="btn btn-primary btn-lg" id="save-att-btn" style="display:none">${t('save')}</button></div>` : ''}
  </div>`;
}

export function attachAttendanceEvents() {
  document.getElementById('load-att-btn')?.addEventListener('click', loadAttendance);
  document.getElementById('save-att-btn')?.addEventListener('click', saveAttendance);
}

async function loadAttendance() {
  const classId = document.getElementById('att-class')?.value;
  const date = document.getElementById('att-date')?.value;
  const container = document.getElementById('att-list');
  if (!classId || !date || !container) return;

  const cls = state.classes.find(c => c.id === classId);
  const studentIds = cls?.studentIds || [];
  let students = state.students.filter(s => studentIds.includes(s.id));

  const role = state.profile?.role;
  if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    students = students.filter(s => kidIds.includes(s.id));
  } else if (role === 'student') {
    students = students.filter(s => s.id === state.profile?.uid);
  }

  // Check existing attendance for this date/class
  const existing = state.attendance.filter(a => a.classId === classId && a.date === date);
  const canEdit = role === 'admin' || role === 'teacher';

  if (students.length === 0) {
    container.innerHTML = `<p class="text-muted text-center">${t('noData')}</p>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table"><thead><tr><th>#</th><th>${t('fullName')}</th>
    ${canEdit ? `<th>${t('present')}</th><th>${t('absent')}</th><th>${t('late')}</th><th>${t('excused')}</th>` : `<th>${state.lang==='ar'?'الحالة':'Status'}</th>`}
    </tr></thead><tbody>
    ${students.map((s, i) => {
      const rec = existing.find(a => a.studentId === s.id);
      const status = rec?.status || '';
      if (canEdit) {
        return `<tr><td>${i+1}</td><td>${s.name}</td>
          <td><input type="radio" name="att-${s.id}" value="present" ${status==='present'?'checked':''}></td>
          <td><input type="radio" name="att-${s.id}" value="absent" ${status==='absent'?'checked':''}></td>
          <td><input type="radio" name="att-${s.id}" value="late" ${status==='late'?'checked':''}></td>
          <td><input type="radio" name="att-${s.id}" value="excused" ${status==='excused'?'checked':''}></td></tr>`;
      } else {
        const statusLabels = { present: '✅ '+t('present'), absent: '❌ '+t('absent'), late: '⏰ '+t('late'), excused: '📋 '+t('excused') };
        return `<tr><td>${i+1}</td><td>${s.name}</td><td>${statusLabels[status]||'—'}</td></tr>`;
      }
    }).join('')}
    </tbody></table>`;

  if (canEdit) {
    const saveBtn = document.getElementById('save-att-btn');
    if (saveBtn) saveBtn.style.display = 'inline-flex';
  }
}

async function saveAttendance() {
  const classId = document.getElementById('att-class')?.value;
  const date = document.getElementById('att-date')?.value;
  if (!classId || !date) return;

  const cls = state.classes.find(c => c.id === classId);
  const studentIds = cls?.studentIds || [];
  const btn = document.getElementById('save-att-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>'; }

  try {
    for (const sid of studentIds) {
      const radio = document.querySelector(`input[name="att-${sid}"]:checked`);
      if (!radio) continue;
      const existing = state.attendance.find(a => a.classId === classId && a.date === date && a.studentId === sid);
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status: radio.value, teacherId: state.profile?.uid });
      } else {
        await addDoc(collection(db, 'attendance'), { studentId: sid, classId, date, status: radio.value, teacherId: state.profile?.uid, createdAt: new Date().toISOString() });
      }
      // Trigger academic alerts check for this student
      academicService.processAcademicAlerts(sid);
    }
    showToast(t('savedSuccess'), 'success');
  } catch(e) { showToast(t('errorOccurred'), 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = t('save'); }
}
