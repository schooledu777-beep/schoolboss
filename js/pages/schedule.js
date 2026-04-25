import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast } from '../ui.js';

const days = { ar: ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday'] };
const periods = [1,2,3,4,5,6,7];

export function renderSchedule() {
  const role = state.profile?.role;
  const canEdit = role === 'admin';

  // Pick which class schedule to show
  let classId = '';
  let availableClasses = state.classes;
  if (role === 'teacher') {
    availableClasses = state.classes.filter(c => c.teacherId === state.profile?.uid || (c.teacherIds||[]).includes(state.profile?.uid));
    classId = availableClasses[0]?.id || '';
  } else if (role === 'student') {
    availableClasses = state.classes.filter(c => (c.studentIds||[]).includes(state.profile?.uid));
    classId = availableClasses[0]?.id || '';
  } else if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    availableClasses = state.classes.filter(c => c.studentIds?.some(id => kidIds.includes(id)));
    classId = availableClasses[0]?.id || '';
  }

  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('schedule')}</h2>${canEdit ? `<button class="btn btn-primary" id="add-schedule-btn">+ ${t('add')}</button>` : ''}</div>
    <div class="filter-bar glass-card">
      <select id="sched-class" class="form-select">
        ${availableClasses.map(c => `<option value="${c.id}" ${c.id===classId?'selected':''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div id="schedule-grid" class="schedule-container glass-card">
      ${renderScheduleGrid(classId, canEdit)}
    </div>
  </div>`;
}

function renderScheduleGrid(classId, canEdit) {
  const lang = state.lang;
  const dayNames = days[lang] || days.ar;
  const schedules = state.schedules.filter(s => s.classId === classId);

  return `
  <div class="schedule-table-wrap">
    <table class="schedule-table">
      <thead><tr><th>${lang==='ar'?'الحصة':'Period'}</th>${dayNames.map(d => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>
        ${periods.map(p => `<tr><td class="period-cell">${p}</td>${dayNames.map((d, di) => {
          const entry = schedules.find(s => s.period === p && s.dayOfWeek === di);
          return `<td class="schedule-cell ${entry ? 'has-entry' : ''}" data-day="${di}" data-period="${p}">
            ${entry ? `<div class="sched-entry"><strong>${entry.subject||''}</strong><small>${state.teachers.find(tc=>tc.id===entry.teacherId)?.name||''}</small>${canEdit?`<button class="btn-icon sched-del" data-id="${entry.id}">✕</button>`:''}</div>` : (canEdit ? '<span class="sched-add">+</span>' : '')}
          </td>`;
        }).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

export function attachScheduleEvents() {
  document.getElementById('sched-class')?.addEventListener('change', e => {
    const grid = document.getElementById('schedule-grid');
    if (grid) grid.innerHTML = renderScheduleGrid(e.target.value, state.profile?.role === 'admin');
    attachScheduleCellEvents();
  });
  document.getElementById('add-schedule-btn')?.addEventListener('click', () => showScheduleForm());
  attachScheduleCellEvents();
}

function attachScheduleCellEvents() {
  document.querySelectorAll('.sched-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cell = e.target.closest('.schedule-cell');
      showScheduleForm(null, Number(cell.dataset.day), Number(cell.dataset.period));
    });
  });
  document.querySelectorAll('.sched-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'schedules',btn.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
    });
  });
}

function showScheduleForm(entry = null, dayOfWeek = 0, period = 1) {
  const classId = document.getElementById('sched-class')?.value || '';
  showModal(state.lang==='ar'?'إضافة حصة':'Add Period', `
    <form id="sched-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'المادة':'Subject'}</label><input type="text" id="schf-subject" class="form-input" value="${entry?.subject||''}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'المعلم':'Teacher'}</label>
        <select id="schf-teacher" class="form-select">${state.teachers.map(tc=>`<option value="${tc.id}" ${entry?.teacherId===tc.id?'selected':''}>${tc.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'الوقت':'Time'}</label><input type="text" id="schf-time" class="form-input" value="${entry?.time||''}" placeholder="08:00 - 08:45"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('sched-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { classId, dayOfWeek, period, subject: document.getElementById('schf-subject').value.trim(), teacherId: document.getElementById('schf-teacher').value, time: document.getElementById('schf-time').value.trim() };
    try { await addDoc(collection(db,'schedules'),data); closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
