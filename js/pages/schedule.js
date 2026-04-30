import { state, t } from '../state.js';
import { db, collection, addDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast } from '../ui.js';

const days = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
};
const periods = [1, 2, 3, 4, 5, 6, 7];
const subjectAccents = ['purple', 'cyan', 'green', 'amber', 'red'];

export function renderSchedule() {
  const role = state.profile?.role;
  const canEdit = role === 'admin';
  let availableClasses = state.classes;

  if (role === 'teacher') {
    availableClasses = state.classes.filter(c => c.teacherId === state.profile?.uid || (c.teacherIds || []).includes(state.profile?.uid));
  } else if (role === 'student') {
    availableClasses = state.classes.filter(c => (c.studentIds || []).includes(state.profile?.uid));
  } else if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    availableClasses = state.classes.filter(c => c.studentIds?.some(id => kidIds.includes(id)));
  }

  const classId = availableClasses[0]?.id || '';

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('schedule')}</h2>
        <p class="text-muted">${state.lang === 'ar' ? 'جدول أسبوعي واضح مع أوقات ثابتة' : 'Weekly schedule with a fixed time column'}</p>
      </div>
      <div class="header-actions">
        ${canEdit ? `<button class="btn btn-outline" id="manage-master-sched-btn">⚙️ ${state.lang === 'ar' ? 'الأوقات' : 'Timeslots'}</button>` : ''}
        ${canEdit ? `<button class="btn btn-primary" id="add-schedule-btn">+ ${t('add')}</button>` : ''}
      </div>
    </div>

    <div class="schedule-toolbar glass-card">
      <div class="schedule-toolbar-main">
        <span class="schedule-toolbar-icon">📅</span>
        <div>
          <span class="schedule-toolbar-label">${state.lang === 'ar' ? 'الجدول الأسبوعي' : 'Weekly Schedule'}</span>
          <strong>${state.lang === 'ar' ? 'اختر الصف لعرض الحصص' : 'Choose a class to view periods'}</strong>
        </div>
      </div>
      <select id="sched-class" class="form-select schedule-class-select">
        ${availableClasses.map(c => `<option value="${c.id}" ${c.id === classId ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>

    <div id="schedule-grid" class="schedule-container glass-card">
      ${renderScheduleGrid(classId, canEdit)}
    </div>
  </div>`;
}

function getSlots() {
  if (state.timeslots.length > 0) {
    return [...state.timeslots].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }
  return periods.map(p => ({ id: p, startTime: `${t('period')} ${p}`, endTime: '' }));
}

function renderScheduleGrid(classId, canEdit) {
  const lang = state.lang;
  const dayNames = days[lang] || days.ar;
  const schedules = state.schedules.filter(s => s.classId === classId);
  const slots = getSlots();
  const selectedClass = state.classes.find(c => c.id === classId);
  const filledCount = schedules.length;
  const totalSlots = slots.length * dayNames.length;

  if (!classId) {
    return `<div class="empty-state"><p class="text-muted">${lang === 'ar' ? 'لا توجد صفوف متاحة لعرض الجدول' : 'No classes available for schedule view'}</p></div>`;
  }

  return `
  <div class="schedule-board-head">
    <div>
      <span class="schedule-eyebrow">${lang === 'ar' ? 'الصف الحالي' : 'Selected Class'}</span>
      <h3>${selectedClass?.name || (lang === 'ar' ? 'صف غير محدد' : 'Unknown class')}</h3>
    </div>
    <div class="schedule-metrics">
      <span><strong>${filledCount}</strong>${lang === 'ar' ? 'حصة' : 'Periods'}</span>
      <span><strong>${totalSlots}</strong>${lang === 'ar' ? 'خانة' : 'Slots'}</span>
    </div>
  </div>

  <div class="schedule-grid-shell">
    <div class="schedule-grid-board" style="--schedule-days:${dayNames.length}">
      <div class="schedule-grid-corner">${lang === 'ar' ? 'الوقت' : 'Time'}</div>
      ${dayNames.map((day, dayIndex) => `
        <div class="schedule-grid-day">
          <span>${day}</span>
          <small>${schedules.filter(s => s.dayOfWeek === dayIndex).length}</small>
        </div>
      `).join('')}

      ${slots.map((slot, slotIndex) => {
        const slotId = slot.id;
        const slotLabel = slot.endTime ? `${slot.startTime} - ${slot.endTime}` : slot.startTime;
        return `
          <div class="schedule-grid-time">
            <strong>${slotIndex + 1}</strong>
            <span>${slotLabel}</span>
          </div>
          ${dayNames.map((day, dayIndex) => {
            const entry = schedules.find(s => (s.timeslotId === slotId || s.period === slotId) && s.dayOfWeek === dayIndex);
            const teacher = entry ? state.teachers.find(tc => tc.id === entry.teacherId) : null;
            const accent = subjectAccents[Math.abs((entry?.subject || '').length + dayIndex + slotIndex) % subjectAccents.length];
            return `
            <div class="schedule-grid-cell ${entry ? 'has-entry' : 'is-empty'}" data-day="${dayIndex}" data-slot="${slotId}">
              ${entry ? `
                <article class="schedule-lesson accent-${accent}">
                  <div class="schedule-lesson-top">
                    <strong>${entry.subject || ''}</strong>
                    ${canEdit ? `<button class="sched-del-btn" data-id="${entry.id}" title="${t('delete')}">×</button>` : ''}
                  </div>
                  <span>${teacher?.name || (lang === 'ar' ? 'معلم غير محدد' : 'No teacher')}</span>
                </article>
              ` : canEdit ? `
                <button class="sched-add-placeholder" type="button">
                  <span class="plus-icon">+</span>
                  <small>${lang === 'ar' ? 'إضافة حصة' : 'Add period'}</small>
                </button>
              ` : `<div class="schedule-empty-readonly">${lang === 'ar' ? 'فارغ' : 'Free'}</div>`}
            </div>`;
          }).join('')}
        `;
      }).join('')}
    </div>
  </div>`;
}

function refreshCurrentSchedule() {
  const classSelect = document.getElementById('sched-class');
  const grid = document.getElementById('schedule-grid');
  if (grid) grid.innerHTML = renderScheduleGrid(classSelect?.value || '', state.profile?.role === 'admin');
  attachScheduleCellEvents();
}

export function attachScheduleEvents() {
  document.getElementById('sched-class')?.addEventListener('change', refreshCurrentSchedule);
  document.getElementById('add-schedule-btn')?.addEventListener('click', () => showScheduleForm());
  document.getElementById('manage-master-sched-btn')?.addEventListener('click', () => showMasterDataModal());
  refreshCurrentSchedule();
}

function attachScheduleCellEvents() {
  document.querySelectorAll('.sched-add-placeholder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cell = e.target.closest('.schedule-grid-cell');
      showScheduleForm(null, Number(cell.dataset.day), cell.dataset.slot);
    });
  });

  document.querySelectorAll('.sched-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(t('delete'), t('confirmDelete'), async () => {
        try {
          await deleteDoc(doc(db, 'schedules', btn.dataset.id));
          state.schedules = state.schedules.filter(s => s.id !== btn.dataset.id);
          refreshCurrentSchedule();
          showToast(t('deletedSuccess'), 'success');
        } catch (err) {
          console.error(err);
          showToast(t('errorOccurred'), 'error');
        }
      });
    });
  });
}

function showScheduleForm(entry = null, dayOfWeek = 0, timeslotId = '') {
  const classId = document.getElementById('sched-class')?.value || '';
  showModal(state.lang === 'ar' ? 'إضافة حصة' : 'Add Period', `
    <form id="sched-form" class="form-grid">
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'المادة' : 'Subject'}</label>
        <select id="schf-subject" class="form-select" required>
          ${state.subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'المعلم' : 'Teacher'}</label>
        <select id="schf-teacher" class="form-select" required>
          ${state.teachers.map(tc => `<option value="${tc.id}" ${entry?.teacherId === tc.id ? 'selected' : ''}>${tc.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'الفترة' : 'Timeslot'}</label>
        <select id="schf-timeslot" class="form-select" required>
          ${state.timeslots.map(ts => `<option value="${ts.id}" ${timeslotId === ts.id ? 'selected' : ''}>${ts.startTime} - ${ts.endTime}</option>`).join('')}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('sched-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const teacherId = document.getElementById('schf-teacher').value;
    const selectedTimeslotId = document.getElementById('schf-timeslot').value;
    const teacherConflict = state.schedules.find(s => s.teacherId === teacherId && s.dayOfWeek === dayOfWeek && s.timeslotId === selectedTimeslotId);
    if (teacherConflict) {
      showToast(state.lang === 'ar' ? 'المعلم مشغول في هذا الوقت' : 'Teacher is busy at this time', 'error');
      return;
    }

    const data = {
      classId,
      dayOfWeek,
      timeslotId: selectedTimeslotId,
      subject: document.getElementById('schf-subject').value,
      teacherId
    };

    try {
      const ref = await addDoc(collection(db, 'schedules'), data);
      state.schedules.push({ id: ref.id, ...data });
      closeModal();
      refreshCurrentSchedule();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
    }
  });
}

function showMasterDataModal() {
  showModal(state.lang === 'ar' ? 'أوقات الحصص' : 'Schedule Timeslots', `
    <div id="timeslots-tab" class="tab-content active">
      <h4 style="margin-bottom:1rem">${t('timeslots')}</h4>
      <form id="ts-form" class="form-grid" style="margin-bottom:1.5rem">
        <div class="form-group">
          <label>${state.lang === 'ar' ? 'وقت البداية' : 'Start Time'}</label>
          <input type="time" id="ts-start" class="form-input" required>
        </div>
        <div class="form-group">
          <label>${state.lang === 'ar' ? 'وقت النهاية' : 'End Time'}</label>
          <input type="time" id="ts-end" class="form-input" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${t('add')}</button>
        </div>
      </form>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>${state.lang === 'ar' ? 'البداية' : 'Start'}</th><th>${state.lang === 'ar' ? 'النهاية' : 'End'}</th><th></th></tr></thead>
          <tbody>${state.timeslots.map(ts => `<tr><td>${ts.startTime}</td><td>${ts.endTime}</td><td><button class="btn btn-sm btn-danger del-ts" data-id="${ts.id}">🗑️</button></td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById('ts-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const startTime = document.getElementById('ts-start').value;
      const endTime = document.getElementById('ts-end').value;
      const ref = await addDoc(collection(db, 'timeslots'), { startTime, endTime });
      state.timeslots.push({ id: ref.id, startTime, endTime });
      closeModal();
      refreshCurrentSchedule();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
    }
  });

  document.querySelectorAll('.del-ts').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await deleteDoc(doc(db, 'timeslots', btn.dataset.id));
      state.timeslots = state.timeslots.filter(ts => ts.id !== btn.dataset.id);
      showMasterDataModal();
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
    }
  }));
}
