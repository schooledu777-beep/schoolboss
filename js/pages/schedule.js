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
    <div class="page-header">
        <h2>${t('schedule')}</h2>
        <div class="header-actions">
            ${canEdit ? `<button class="btn btn-outline" id="manage-master-sched-btn">⚙️ ${state.lang==='ar'?'البيانات الأساسية':'Master Data'}</button>` : ''}
            ${canEdit ? `<button class="btn btn-primary" id="add-schedule-btn">+ ${t('add')}</button>` : ''}
        </div>
    </div>
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
  const activeTimeslots = state.timeslots.sort((a,b) => a.startTime.localeCompare(b.startTime));

  return `
  <div class="schedule-table-wrap">
    <table class="schedule-table">
      <thead><tr><th>${lang==='ar'?'الوقت':'Time'}</th>${dayNames.map(d => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>
        ${(activeTimeslots.length > 0 ? activeTimeslots : periods).map((p, pi) => {
          const slotLabel = p.startTime ? `${p.startTime} - ${p.endTime}` : p;
          const slotId = p.id || p;
          return `<tr><td class="period-cell">${slotLabel}</td>${dayNames.map((d, di) => {
            const entry = schedules.find(s => (s.timeslotId === slotId || s.period === p) && s.dayOfWeek === di);
            const classroom = state.classrooms.find(c => c.id === entry?.classroomId);
            return `<td class="schedule-cell ${entry ? 'has-entry' : ''}" data-day="${di}" data-slot="${slotId}">
              ${entry ? `
                <div class="sched-entry">
                  <strong>${entry.subject||''}</strong>
                  <small>${state.teachers.find(tc=>tc.id===entry.teacherId)?.name||''}</small>
                  ${classroom ? `<span class="badge badge-secondary" style="font-size:0.7rem">${classroom.name}</span>` : ''}
                  ${canEdit?`<button class="btn-icon sched-del" data-id="${entry.id}">✕</button>`:''}
                </div>` : (canEdit ? '<span class="sched-add">+</span>' : '')}
            </td>`;
          }).join('')}</tr>`}).join('')}
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
  document.getElementById('manage-master-sched-btn')?.addEventListener('click', () => showMasterDataModal());
  attachScheduleCellEvents();
}

function attachScheduleCellEvents() {
  document.querySelectorAll('.sched-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cell = e.target.closest('.schedule-cell');
      showScheduleForm(null, Number(cell.dataset.day), cell.dataset.slot);
    });
  });
  document.querySelectorAll('.sched-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'schedules',btn.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
    });
  });
}

function showScheduleForm(entry = null, dayOfWeek = 0, timeslotId = '') {
  const classId = document.getElementById('sched-class')?.value || '';
  showModal(state.lang==='ar'?'إضافة حصة':'Add Period', `
    <form id="sched-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'المادة':'Subject'}</label>
        <select id="schf-subject" class="form-select" required>
            ${state.subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'المعلم':'Teacher'}</label>
        <select id="schf-teacher" class="form-select" required>${state.teachers.map(tc=>`<option value="${tc.id}" ${entry?.teacherId===tc.id?'selected':''}>${tc.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'القاعة':'Classroom'}</label>
        <select id="schf-classroom" class="form-select" required>
            ${state.classrooms.map(c => `<option value="${c.id}">${c.name} (${c.capacity})</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'الفترة':'Timeslot'}</label>
        <select id="schf-timeslot" class="form-select" required>
            ${state.timeslots.map(t => `<option value="${t.id}" ${timeslotId===t.id?'selected':''}>${t.startTime} - ${t.endTime}</option>`).join('')}
        </select>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
    
  document.getElementById('sched-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const tid = document.getElementById('schf-teacher').value;
    const tsid = document.getElementById('schf-timeslot').value;
    const crid = document.getElementById('schf-classroom').value;

    // Double-booking validation
    const teacherConflict = state.schedules.find(s => s.teacherId === tid && s.dayOfWeek === dayOfWeek && s.timeslotId === tsid);
    const classroomConflict = state.schedules.find(s => s.classroomId === crid && s.dayOfWeek === dayOfWeek && s.timeslotId === tsid);

    if (teacherConflict) return showToast(state.lang==='ar'?'المعلم مشغول في هذا الوقت':'Teacher is busy at this time', 'error');
    if (classroomConflict) return showToast(state.lang==='ar'?'القاعة محجوزة في هذا الوقت':'Classroom is occupied at this time', 'error');

    const data = { 
        classId, 
        dayOfWeek, 
        timeslotId: tsid, 
        classroomId: crid,
        subject: document.getElementById('schf-subject').value, 
        teacherId: tid 
    };
    try { 
        await addDoc(collection(db, 'schedules'), data); 
        closeModal(); 
        showToast(t('savedSuccess'), 'success'); 
    } catch(e) { showToast(t('errorOccurred'), 'error'); }
  });
}

function showMasterDataModal() {
    showModal(state.lang==='ar'?'البيانات الأساسية للجدول':'Schedule Master Data', `
        <div class="tabs">
            <button class="tab-btn active" data-tab="timeslots-tab">${t('timeslots')}</button>
            <button class="tab-btn" data-tab="classrooms-tab">${t('classrooms')}</button>
        </div>
        <div id="timeslots-tab" class="tab-content active">
            <form id="ts-form" class="form-grid" style="margin-bottom:1rem">
                <input type="time" id="ts-start" class="form-input" required>
                <input type="time" id="ts-end" class="form-input" required>
                <button type="submit" class="btn btn-primary">${t('add')}</button>
            </form>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>${state.lang==='ar'?'البداية':'Start'}</th><th>${state.lang==='ar'?'النهاية':'End'}</th><th></th></tr></thead>
                    <tbody>${state.timeslots.map(t => `<tr><td>${t.startTime}</td><td>${t.endTime}</td><td><button class="btn btn-sm btn-danger del-ts" data-id="${t.id}">🗑️</button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
        <div id="classrooms-tab" class="tab-content" style="display:none">
            <form id="cr-form" class="form-grid" style="margin-bottom:1rem">
                <input type="text" id="cr-name" class="form-input" placeholder="${state.lang==='ar'?'اسم القاعة':'Name'}" required>
                <input type="number" id="cr-cap" class="form-input" placeholder="${state.lang==='ar'?'السعة':'Capacity'}" required>
                <button type="submit" class="btn btn-primary">${t('add')}</button>
            </form>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>${state.lang==='ar'?'الاسم':'Name'}</th><th>${state.lang==='ar'?'السعة':'Capacity'}</th><th></th></tr></thead>
                    <tbody>${state.classrooms.map(c => `<tr><td>${c.name}</td><td>${c.capacity}</td><td><button class="btn btn-sm btn-danger del-cr" data-id="${c.id}">🗑️</button></td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `);

    // Tab events
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).style.display = 'block';
        });
    });

    document.getElementById('ts-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await addDoc(collection(db, 'timeslots'), { startTime: document.getElementById('ts-start').value, endTime: document.getElementById('ts-end').value });
        showMasterDataModal();
    });

    document.getElementById('cr-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        await addDoc(collection(db, 'classrooms'), { name: document.getElementById('cr-name').value, capacity: Number(document.getElementById('cr-cap').value) });
        showMasterDataModal();
    });

    document.querySelectorAll('.del-ts').forEach(b => b.addEventListener('click', async () => { await deleteDoc(doc(db,'timeslots',b.dataset.id)); showMasterDataModal(); }));
    document.querySelectorAll('.del-cr').forEach(b => b.addEventListener('click', async () => { await deleteDoc(doc(db,'classrooms',b.dataset.id)); showMasterDataModal(); }));
}

