import { state, t } from '../state.js';
import { db, collection, addDoc, deleteDoc, doc, writeBatch } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast } from '../ui.js';

const days = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
};

const fallbackPeriods = [1, 2, 3, 4, 5, 6, 7];
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
        <p class="text-muted">${state.lang === 'ar' ? 'جدولة ذكية تراعي أوقات الحصص والاستراحات وتفضيلات المعلمين' : 'Smart scheduling with lessons, breaks, and teacher preferences'}</p>
      </div>
      <div class="header-actions">
        ${canEdit ? `<button class="btn btn-outline" id="manage-master-sched-btn">⚙ ${state.lang === 'ar' ? 'الأوقات' : 'Timeslots'}</button>` : ''}
        ${canEdit ? `<button class="btn btn-outline" id="add-break-btn">☕ ${state.lang === 'ar' ? 'إضافة استراحة' : 'Add Break'}</button>` : ''}
        ${canEdit ? `<button class="btn btn-success" id="smart-schedule-btn">✨ ${state.lang === 'ar' ? 'إنشاء ذكي' : 'Smart Generate'}</button>` : ''}
        ${canEdit ? `<button class="btn btn-primary" id="add-schedule-btn">+ ${state.lang === 'ar' ? 'إضافة حصة' : t('add')}</button>` : ''}
      </div>
    </div>

    <div class="schedule-toolbar glass-card">
      <div class="schedule-toolbar-main">
        <span class="schedule-toolbar-icon">📅</span>
        <div>
          <span class="schedule-toolbar-label">${state.lang === 'ar' ? 'الجدول الأسبوعي' : 'Weekly Schedule'}</span>
          <strong>${state.lang === 'ar' ? 'اختر الصف ثم أضف الحصص أو ولّدها حسب تفضيلات المعلمين' : 'Choose a class, then add or generate periods from teacher preferences'}</strong>
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
    return [...state.timeslots].sort((a, b) => {
      const orderDiff = Number(a.order ?? 0) - Number(b.order ?? 0);
      return orderDiff || String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });
  }
  return fallbackPeriods.map(p => ({ id: String(p), startTime: `${t('period')} ${p}`, endTime: '' }));
}

function getDayNames() {
  return days[state.lang] || days.ar;
}

function sameSlot(entry, slotId) {
  return String(entry.timeslotId ?? entry.period ?? '') === String(slotId);
}

function renderScheduleGrid(classId, canEdit) {
  const lang = state.lang;
  const dayNames = getDayNames();
  const schedules = state.schedules.filter(s => s.classId === classId);
  const slots = getSlots();
  const selectedClass = state.classes.find(c => c.id === classId);
  const lessonCount = schedules.filter(s => s.type !== 'break').length;
  const breakCount = schedules.filter(s => s.type === 'break').length;
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
      <span><strong>${lessonCount}</strong>${lang === 'ar' ? 'حصة' : 'Lessons'}</span>
      <span><strong>${breakCount}</strong>${lang === 'ar' ? 'استراحة' : 'Breaks'}</span>
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
            const entry = schedules.find(s => sameSlot(s, slotId) && s.dayOfWeek === dayIndex);
            const teacher = entry ? state.teachers.find(tc => tc.id === entry.teacherId) : null;
            const accent = subjectAccents[Math.abs((entry?.subject || '').length + dayIndex + slotIndex) % subjectAccents.length];
            const isBreak = entry?.type === 'break';
            return `
            <div class="schedule-grid-cell ${entry ? 'has-entry' : 'is-empty'}" data-day="${dayIndex}" data-slot="${slotId}">
              ${entry ? `
                <article class="schedule-lesson ${isBreak ? 'schedule-break' : `accent-${accent}`}">
                  <div class="schedule-lesson-top">
                    <strong>${isBreak ? `☕ ${entry.subject || (lang === 'ar' ? 'استراحة' : 'Break')}` : (entry.subject || '')}</strong>
                    ${canEdit ? `<button class="sched-del-btn" data-id="${entry.id}" title="${t('delete')}">×</button>` : ''}
                  </div>
                  <span>${isBreak ? (entry.note || (lang === 'ar' ? 'وقت راحة بين الحصص' : 'Break time')) : (teacher?.name || (lang === 'ar' ? 'معلم غير محدد' : 'No teacher'))}</span>
                </article>
              ` : canEdit ? `
                <div class="sched-empty-actions">
                  <button class="sched-add-placeholder" type="button" data-kind="lesson">
                    <span class="plus-icon">+</span>
                    <small>${lang === 'ar' ? 'حصة' : 'Lesson'}</small>
                  </button>
                  <button class="sched-add-placeholder sched-break-placeholder" type="button" data-kind="break">
                    <span class="plus-icon">☕</span>
                    <small>${lang === 'ar' ? 'استراحة' : 'Break'}</small>
                  </button>
                </div>
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
  document.getElementById('add-break-btn')?.addEventListener('click', () => showBreakForm());
  document.getElementById('smart-schedule-btn')?.addEventListener('click', () => showSmartScheduleModal());
  document.getElementById('manage-master-sched-btn')?.addEventListener('click', () => showMasterDataModal());
  refreshCurrentSchedule();
}

function attachScheduleCellEvents() {
  document.querySelectorAll('.sched-add-placeholder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cell = e.target.closest('.schedule-grid-cell');
      if (!cell) return;
      if (btn.dataset.kind === 'break') {
        showBreakForm(Number(cell.dataset.day), cell.dataset.slot);
      } else {
        showScheduleForm(null, Number(cell.dataset.day), cell.dataset.slot);
      }
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

function renderDayOptions(selectedDay = 0) {
  return getDayNames().map((day, index) => `<option value="${index}" ${Number(selectedDay) === index ? 'selected' : ''}>${day}</option>`).join('');
}

function renderTimeslotOptions(selectedTimeslotId = '') {
  return getSlots().map(ts => {
    const label = ts.endTime ? `${ts.startTime} - ${ts.endTime}` : ts.startTime;
    return `<option value="${ts.id}" ${String(selectedTimeslotId) === String(ts.id) ? 'selected' : ''}>${label}</option>`;
  }).join('');
}

function showScheduleForm(entry = null, dayOfWeek = 0, timeslotId = '') {
  const classId = document.getElementById('sched-class')?.value || '';
  showModal(state.lang === 'ar' ? 'إضافة حصة' : 'Add Lesson', `
    <form id="sched-form" class="form-grid">
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'اليوم' : 'Day'}</label>
        <select id="schf-day" class="form-select" required>${renderDayOptions(dayOfWeek)}</select>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'الفترة' : 'Timeslot'}</label>
        <select id="schf-timeslot" class="form-select" required>${renderTimeslotOptions(timeslotId)}</select>
      </div>
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
      <div class="schedule-helper-note full-width" id="teacher-pref-note"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  const updatePreferenceNote = () => {
    const teacherId = document.getElementById('schf-teacher')?.value;
    const selectedDay = Number(document.getElementById('schf-day')?.value || 0);
    const selectedTimeslotId = document.getElementById('schf-timeslot')?.value || '';
    const pref = getTeacherPreference(teacherId, selectedDay, selectedTimeslotId);
    const note = document.getElementById('teacher-pref-note');
    if (!note) return;
    note.className = `schedule-helper-note full-width pref-${pref || 'neutral'}`;
    note.textContent = preferenceMessage(pref);
  };

  ['schf-teacher', 'schf-day', 'schf-timeslot'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updatePreferenceNote);
  });
  updatePreferenceNote();

  document.getElementById('sched-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const teacherId = document.getElementById('schf-teacher').value;
    const selectedDay = Number(document.getElementById('schf-day').value);
    const selectedTimeslotId = document.getElementById('schf-timeslot').value;
    const teacherConflict = state.schedules.find(s => s.teacherId === teacherId && s.dayOfWeek === selectedDay && sameSlot(s, selectedTimeslotId));
    if (teacherConflict) {
      showToast(state.lang === 'ar' ? 'المعلم مشغول في هذا الوقت' : 'Teacher is busy at this time', 'error');
      return;
    }

    const data = {
      classId,
      dayOfWeek: selectedDay,
      timeslotId: selectedTimeslotId,
      subject: document.getElementById('schf-subject').value,
      teacherId,
      type: 'lesson'
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

function showBreakForm(dayOfWeek = 0, timeslotId = '') {
  const classId = document.getElementById('sched-class')?.value || '';
  showModal(state.lang === 'ar' ? 'إضافة استراحة' : 'Add Break', `
    <form id="break-form" class="form-grid">
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'اليوم' : 'Day'}</label>
        <select id="break-day" class="form-select" required>${renderDayOptions(dayOfWeek)}</select>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'الفترة' : 'Timeslot'}</label>
        <select id="break-timeslot" class="form-select" required>${renderTimeslotOptions(timeslotId)}</select>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'اسم الاستراحة' : 'Break Name'}</label>
        <input id="break-name" class="form-input" value="${state.lang === 'ar' ? 'استراحة' : 'Break'}" required>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'ملاحظة' : 'Note'}</label>
        <input id="break-note" class="form-input" value="${state.lang === 'ar' ? 'وقت راحة بين الحصص' : 'Break time'}">
      </div>
      <div class="form-actions full-width">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('break-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const selectedDay = Number(document.getElementById('break-day').value);
    const selectedTimeslotId = document.getElementById('break-timeslot').value;
    const cellTaken = state.schedules.find(s => s.classId === classId && s.dayOfWeek === selectedDay && sameSlot(s, selectedTimeslotId));
    if (cellTaken) {
      showToast(state.lang === 'ar' ? 'هذه الخانة مستخدمة بالفعل' : 'This slot is already used', 'error');
      return;
    }

    const data = {
      classId,
      dayOfWeek: selectedDay,
      timeslotId: selectedTimeslotId,
      subject: document.getElementById('break-name').value.trim(),
      note: document.getElementById('break-note').value.trim(),
      type: 'break'
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

function showSmartScheduleModal() {
  const classId = document.getElementById('sched-class')?.value || '';
  const selectedClass = state.classes.find(c => c.id === classId);
  showModal(state.lang === 'ar' ? 'إنشاء جدول ذكي' : 'Smart Schedule Generator', `
    <div class="smart-schedule-panel">
      <div class="smart-schedule-icon">✨</div>
      <div>
        <h4>${selectedClass?.name || ''}</h4>
        <p class="text-muted">${state.lang === 'ar'
          ? 'سيتم ملء الخانات الفارغة فقط. النظام يتجنب تعارض المعلمين ويراعي تفضيلاتهم: المفضل أولاً، ثم المناسب، ويتجنب غير المناسب.'
          : 'Only empty slots will be filled. The system avoids teacher conflicts and ranks preferred slots first, then suitable ones, while avoiding unsuitable slots.'}</p>
      </div>
    </div>
    <div class="schedule-smart-options">
      <label class="smart-check">
        <input type="checkbox" id="smart-avoid-repeat" checked>
        <span>${state.lang === 'ar' ? 'تخفيف تكرار نفس المادة في اليوم الواحد' : 'Reduce repeating the same subject in one day'}</span>
      </label>
      <label class="smart-check">
        <input type="checkbox" id="smart-use-preferences" checked>
        <span>${state.lang === 'ar' ? 'استخدام تفضيلات المعلمين في بطاقة المعلم' : 'Use teacher profile preferences'}</span>
      </label>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
      <button type="button" class="btn btn-success" id="run-smart-schedule">${state.lang === 'ar' ? 'ابدأ الإنشاء' : 'Generate'}</button>
    </div>`);

  document.getElementById('run-smart-schedule')?.addEventListener('click', async () => {
    const options = {
      avoidRepeat: document.getElementById('smart-avoid-repeat')?.checked !== false,
      usePreferences: document.getElementById('smart-use-preferences')?.checked !== false
    };
    await generateSmartSchedule(classId, options);
  });
}

function getTeacherSubjects(teacher) {
  if (Array.isArray(teacher.subjects)) return teacher.subjects.filter(Boolean);
  if (typeof teacher.subjects === 'string') return teacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
  if (teacher.subject) return [teacher.subject];
  return [];
}

function getTeacherPreference(teacherId, dayOfWeek, timeslotId) {
  const teacher = state.teachers.find(tch => tch.id === teacherId);
  return teacher?.preferences?.grid?.[`${dayOfWeek}_${timeslotId}`] || null;
}

function preferenceMessage(pref) {
  if (state.lang === 'ar') {
    if (pref === 'preferred') return 'هذا الوقت مفضل لدى المعلم.';
    if (pref === 'suitable') return 'هذا الوقت مناسب للمعلم.';
    if (pref === 'unsuitable') return 'تنبيه: المعلم وضع هذا الوقت كغير مناسب.';
    return 'لا توجد تفضيلات مسجلة لهذا الوقت.';
  }
  if (pref === 'preferred') return 'This slot is preferred by the teacher.';
  if (pref === 'suitable') return 'This slot is suitable for the teacher.';
  if (pref === 'unsuitable') return 'Warning: the teacher marked this slot as unsuitable.';
  return 'No preference is recorded for this slot.';
}

function buildCandidates() {
  const candidates = [];
  state.teachers.forEach(teacher => {
    getTeacherSubjects(teacher).forEach(subject => {
      candidates.push({ teacherId: teacher.id, teacherName: teacher.name, subject });
    });
  });
  return candidates;
}

function scoreCandidate(candidate, classId, dayOfWeek, timeslotId, options, draftEntries) {
  const schedules = [...state.schedules, ...draftEntries];
  const teacherBusy = schedules.some(s => s.teacherId === candidate.teacherId && s.dayOfWeek === dayOfWeek && sameSlot(s, timeslotId));
  if (teacherBusy) return -Infinity;

  const cellTaken = schedules.some(s => s.classId === classId && s.dayOfWeek === dayOfWeek && sameSlot(s, timeslotId));
  if (cellTaken) return -Infinity;

  const pref = options.usePreferences ? getTeacherPreference(candidate.teacherId, dayOfWeek, timeslotId) : null;
  if (pref === 'unsuitable') return -Infinity;

  let score = 10;
  if (pref === 'preferred') score += 12;
  else if (pref === 'suitable') score += 6;
  else score += 2;

  const teacherDayLoad = schedules.filter(s => s.teacherId === candidate.teacherId && s.dayOfWeek === dayOfWeek).length;
  const teacherTotalLoad = schedules.filter(s => s.teacherId === candidate.teacherId).length;
  score -= teacherDayLoad * 2;
  score -= teacherTotalLoad * 0.15;

  const subjectDayCount = schedules.filter(s => s.classId === classId && s.dayOfWeek === dayOfWeek && s.subject === candidate.subject).length;
  const subjectTotalCount = schedules.filter(s => s.classId === classId && s.subject === candidate.subject).length;
  if (options.avoidRepeat) score -= subjectDayCount * 7;
  score -= subjectTotalCount * 0.4;

  return score;
}

async function generateSmartSchedule(classId, options) {
  const slots = getSlots();
  const dayNames = getDayNames();
  const candidates = buildCandidates();

  if (!classId) {
    showToast(state.lang === 'ar' ? 'اختر صفاً أولاً' : 'Choose a class first', 'error');
    return;
  }

  if (slots.length === 0) {
    showToast(state.lang === 'ar' ? 'أضف أوقات الحصص أولاً' : 'Add timeslots first', 'error');
    return;
  }

  if (candidates.length === 0) {
    showToast(state.lang === 'ar' ? 'لا توجد مواد مرتبطة بالمعلمين. افتح بطاقة المعلم وأضف المواد أولاً.' : 'No subjects are linked to teachers. Add teacher subjects first.', 'error');
    return;
  }

  const draftEntries = [];
  dayNames.forEach((_, dayOfWeek) => {
    slots.forEach(slot => {
      const timeslotId = String(slot.id);
      const alreadyUsed = state.schedules.some(s => s.classId === classId && s.dayOfWeek === dayOfWeek && sameSlot(s, timeslotId));
      if (alreadyUsed) return;

      const ranked = candidates
        .map(candidate => ({ candidate, score: scoreCandidate(candidate, classId, dayOfWeek, timeslotId, options, draftEntries) }))
        .filter(item => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score);

      if (ranked[0]) {
        draftEntries.push({
          classId,
          dayOfWeek,
          timeslotId,
          subject: ranked[0].candidate.subject,
          teacherId: ranked[0].candidate.teacherId,
          type: 'lesson',
          generatedBy: 'smart-schedule'
        });
      }
    });
  });

  if (draftEntries.length === 0) {
    showToast(state.lang === 'ar' ? 'لا توجد خانات فارغة مناسبة للتوليد' : 'No suitable empty slots to generate', 'info');
    return;
  }

  try {
    const batch = writeBatch(db);
    const created = draftEntries.map(data => {
      const ref = doc(collection(db, 'schedules'));
      batch.set(ref, data);
      return { id: ref.id, ...data };
    });
    await batch.commit();
    state.schedules.push(...created);
    closeModal();
    refreshCurrentSchedule();
    showToast(state.lang === 'ar' ? `تم إنشاء ${created.length} حصة بذكاء` : `Generated ${created.length} lessons`, 'success');
  } catch (err) {
    console.error(err);
    showToast(t('errorOccurred'), 'error');
  }
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
          <tbody>${getSlots().map(ts => `<tr><td>${ts.startTime}</td><td>${ts.endTime || ''}</td><td><button class="btn btn-sm btn-danger del-ts" data-id="${ts.id}">حذف</button></td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById('ts-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const startTime = document.getElementById('ts-start').value;
      const endTime = document.getElementById('ts-end').value;
      const ref = await addDoc(collection(db, 'timeslots'), { startTime, endTime, order: state.timeslots.length + 1 });
      state.timeslots.push({ id: ref.id, startTime, endTime, order: state.timeslots.length + 1 });
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
      state.timeslots = state.timeslots.filter(ts => String(ts.id) !== String(btn.dataset.id));
      showMasterDataModal();
      refreshCurrentSchedule();
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
    }
  }));
}
