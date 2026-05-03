import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, checkValid } from '../ui.js';
import { recordAudit } from './auditLog.js';

// ========================= ACADEMIC CALENDAR =========================

const EVENT_TYPES = {
  holiday:  { ar: 'إجازة',      en: 'Holiday',       color: '#ef4444', icon: '🏖️' },
  exam:     { ar: 'امتحان',     en: 'Exam',          color: '#8b5cf6', icon: '📝' },
  event:    { ar: 'فعالية',     en: 'Event',         color: '#3b82f6', icon: '🎉' },
  meeting:  { ar: 'اجتماع',    en: 'Meeting',       color: '#f59e0b', icon: '👥' },
  trip:     { ar: 'رحلة',      en: 'Trip',          color: '#10b981', icon: '🚌' },
  activity: { ar: 'نشاط',      en: 'Activity',      color: '#06b6d4', icon: '⚽' },
};

export function renderCalendar() {
  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📅 ${isAr ? 'التقويم المدرسي' : 'Academic Calendar'}</h2>
      <div class="header-actions">
        ${isAdmin ? `<button class="btn btn-primary" id="add-event-btn">+ ${isAr ? 'إضافة حدث' : 'Add Event'}</button>` : ''}
      </div>
    </div>

    <!-- Legend -->
    <div class="glass-card" style="padding:1rem 1.5rem;margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;">
      <span style="font-weight:600;font-size:.85rem;">${isAr ? 'نوع الحدث:' : 'Event Type:'}</span>
      ${Object.entries(EVENT_TYPES).map(([k, v]) => `
        <span style="display:flex;align-items:center;gap:.35rem;font-size:.8rem;">
          <span style="width:10px;height:10px;border-radius:50%;background:${v.color};display:inline-block;"></span>
          ${v.icon} ${isAr ? v.ar : v.en}
        </span>`).join('')}
    </div>

    <!-- Calendar Navigation -->
    <div class="glass-card" style="margin-bottom:1.5rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;border-bottom:1px solid var(--border);">
        <button class="btn btn-outline btn-sm" id="cal-prev">◀ ${isAr ? 'السابق' : 'Prev'}</button>
        <h3 id="cal-title" style="margin:0;font-size:1.1rem;"></h3>
        <button class="btn btn-outline btn-sm" id="cal-next">${isAr ? 'التالي' : 'Next'} ▶</button>
      </div>
      <div id="calendar-grid" style="padding:1rem;"></div>
    </div>

    <!-- Upcoming Events -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1rem;">${isAr ? '📌 الأحداث القادمة' : '📌 Upcoming Events'}</h3>
      <div id="upcoming-events-list"></div>
    </div>
  </div>`;
}

let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth();

export function attachCalendarEvents() {
  const isAdmin = state.profile?.role === 'admin';

  renderCalendarGrid(_calYear, _calMonth);
  renderUpcoming();

  document.getElementById('cal-prev')?.addEventListener('click', () => {
    _calMonth--;
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    renderCalendarGrid(_calYear, _calMonth);
  });
  document.getElementById('cal-next')?.addEventListener('click', () => {
    _calMonth++;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    renderCalendarGrid(_calYear, _calMonth);
  });

  if (isAdmin) {
    document.getElementById('add-event-btn')?.addEventListener('click', () => showEventForm());
  }
}

function renderCalendarGrid(year, month) {
  const isAr = state.lang === 'ar';
  const monthNames = isAr
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = isAr
    ? ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  document.getElementById('cal-title').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Get events for this month
  const events = (state.calendarEvents || []).filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Build event map by day
  const eventMap = {};
  events.forEach(e => {
    const day = new Date(e.date).getDate();
    if (!eventMap[day]) eventMap[day] = [];
    eventMap[day].push(e);
  });

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">`;

  // Day headers
  dayNames.forEach(d => {
    html += `<div style="text-align:center;font-size:.75rem;font-weight:600;color:var(--text-muted);padding:.5rem 0;">${d}</div>`;
  });

  // Empty cells before start
  for (let i = 0; i < firstDay; i++) {
    html += `<div></div>`;
  }

  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const dayEvents = eventMap[day] || [];
    const isWeekend = (firstDay + day - 1) % 7 === 5 || (firstDay + day - 1) % 7 === 6;

    html += `
      <div class="cal-day ${isToday ? 'cal-today' : ''} ${isWeekend ? 'cal-weekend' : ''}"
           style="min-height:70px;border-radius:8px;padding:4px;border:1px solid var(--border);
                  background:${isToday ? 'var(--primary)' : 'var(--surface-2)'};
                  cursor:pointer;position:relative;"
           data-day="${day}" data-month="${month}" data-year="${year}">
        <div style="font-size:.8rem;font-weight:${isToday?'700':'500'};color:${isToday?'#fff':'var(--text)'};margin-bottom:2px;">${day}</div>
        ${dayEvents.slice(0, 2).map(e => {
          const type = EVENT_TYPES[e.type] || EVENT_TYPES.event;
          return `<div style="font-size:.65rem;background:${type.color}22;color:${type.color};border-radius:4px;padding:1px 4px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${e.title}">${type.icon} ${e.title}</div>`;
        }).join('')}
        ${dayEvents.length > 2 ? `<div style="font-size:.6rem;color:var(--text-muted);">+${dayEvents.length - 2} ${isAr ? 'أكثر' : 'more'}</div>` : ''}
      </div>`;
  }

  html += `</div>`;
  document.getElementById('calendar-grid').innerHTML = html;

  // Click on day → show day events or add
  document.querySelectorAll('.cal-day').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      const d = parseInt(dayEl.dataset.day);
      const m = parseInt(dayEl.dataset.month);
      const y = parseInt(dayEl.dataset.year);
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      showDayEvents(date);
    });
  });
}

function renderUpcoming() {
  const isAr = state.lang === 'ar';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = (state.calendarEvents || [])
    .filter(e => new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 8);

  const list = document.getElementById('upcoming-events-list');
  if (!list) return;

  if (upcoming.length === 0) {
    list.innerHTML = `<p class="text-muted text-center">${isAr ? 'لا توجد أحداث قادمة' : 'No upcoming events'}</p>`;
    return;
  }

  list.innerHTML = upcoming.map(e => {
    const type = EVENT_TYPES[e.type] || EVENT_TYPES.event;
    const date = new Date(e.date);
    const dateStr = isAr
      ? date.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const isAdmin = state.profile?.role === 'admin';
    return `
      <div style="display:flex;align-items:center;gap:1rem;padding:.75rem;border-radius:10px;background:var(--surface-2);margin-bottom:.5rem;">
        <div style="width:42px;height:42px;border-radius:10px;background:${type.color}22;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;">${type.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.9rem;">${e.title}</div>
          <div style="font-size:.78rem;color:var(--text-muted);">${dateStr} · <span style="color:${type.color};">${isAr ? type.ar : type.en}</span></div>
          ${e.description ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description}</div>` : ''}
        </div>
        ${isAdmin ? `
          <div style="display:flex;gap:.5rem;flex-shrink:0;">
            <button class="btn btn-sm btn-outline edit-event" data-id="${e.id}">✏️</button>
            <button class="btn btn-sm btn-danger delete-event" data-id="${e.id}">🗑️</button>
          </div>` : ''}
      </div>`;
  }).join('');

  document.querySelectorAll('.edit-event').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = (state.calendarEvents || []).find(e => e.id === btn.dataset.id);
      if (ev) showEventForm(ev);
    });
  });
  document.querySelectorAll('.delete-event').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(
        state.lang === 'ar' ? 'حذف الحدث' : 'Delete Event',
        state.lang === 'ar' ? 'هل أنت متأكد من حذف هذا الحدث؟' : 'Are you sure you want to delete this event?',
        async () => {
          try {
            const evt = (state.calendarEvents || []).find(x => x.id === btn.dataset.id);
            await deleteDoc(doc(db, 'calendar_events', btn.dataset.id));
            await recordAudit('delete', 'calendar_events', `حذف حدث: ${evt?.title || btn.dataset.id}`);
            showToast(state.lang === 'ar' ? 'تم الحذف' : 'Deleted', 'success');
          } catch { showToast(t('errorOccurred'), 'error'); }
        }
      );
    });
  });
}

function showDayEvents(date) {
  const isAr = state.lang === 'ar';
  const isAdmin = state.profile?.role === 'admin';
  const dayEvents = (state.calendarEvents || []).filter(e => e.date === date);
  const dateLabel = new Date(date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  showModal(dateLabel, `
    <div>
      ${dayEvents.length === 0
        ? `<p class="text-muted text-center" style="padding:1rem;">${isAr ? 'لا توجد أحداث في هذا اليوم' : 'No events on this day'}</p>`
        : dayEvents.map(e => {
            const type = EVENT_TYPES[e.type] || EVENT_TYPES.event;
            return `
              <div style="display:flex;gap:1rem;align-items:flex-start;padding:.75rem;background:var(--surface-2);border-radius:10px;margin-bottom:.5rem;">
                <span style="font-size:1.5rem;">${type.icon}</span>
                <div style="flex:1;">
                  <div style="font-weight:600;">${e.title}</div>
                  <div style="font-size:.8rem;color:${type.color};">${isAr ? type.ar : type.en}</div>
                  ${e.description ? `<div style="font-size:.82rem;color:var(--text-muted);margin-top:.25rem;">${e.description}</div>` : ''}
                </div>
              </div>`;
          }).join('')}
      ${isAdmin ? `
        <div style="margin-top:1rem;text-align:center;">
          <button class="btn btn-primary" onclick="
            document.getElementById('modal-close-x').click();
            setTimeout(()=>window._showEventFormForDate('${date}'),150);">
            + ${isAr ? 'إضافة حدث لهذا اليوم' : 'Add event for this day'}
          </button>
        </div>` : ''}
    </div>`);
}

window._showEventFormForDate = (date) => showEventForm(null, date);

function showEventForm(event = null, preDate = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!event;
  showModal(isEdit ? (isAr ? 'تعديل حدث' : 'Edit Event') : (isAr ? 'إضافة حدث' : 'Add Event'), `
    <form id="event-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'عنوان الحدث' : 'Event Title'}</label>
        <input type="text" id="ef-title" class="form-input" value="${event?.title || ''}" required placeholder="${isAr ? 'مثال: اجتماع أولياء الأمور' : 'e.g. Parent-Teacher Meeting'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الحدث' : 'Event Type'}</label>
        <select id="ef-type" class="form-select">
          ${Object.entries(EVENT_TYPES).map(([k, v]) => `
            <option value="${k}" ${(event?.type||'event') === k ? 'selected' : ''}>${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'التاريخ' : 'Date'}</label>
        <input type="date" id="ef-date" class="form-input" value="${event?.date || preDate || ''}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ الانتهاء (اختياري)' : 'End Date (optional)'}</label>
        <input type="date" id="ef-enddate" class="form-input" value="${event?.endDate || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الجمهور المستهدف' : 'Target Audience'}</label>
        <select id="ef-target" class="form-select">
          <option value="all" ${(event?.target||'all')==='all'?'selected':''}>${isAr ? 'الجميع' : 'Everyone'}</option>
          <option value="students" ${event?.target==='students'?'selected':''}>${isAr ? 'الطلاب' : 'Students'}</option>
          <option value="teachers" ${event?.target==='teachers'?'selected':''}>${isAr ? 'المعلمون' : 'Teachers'}</option>
          <option value="parents" ${event?.target==='parents'?'selected':''}>${isAr ? 'أولياء الأمور' : 'Parents'}</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'الوصف (اختياري)' : 'Description (optional)'}</label>
        <textarea id="ef-desc" class="form-input" rows="3" style="resize:vertical;">${event?.description || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('event-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('ef-title').value.trim();
    const date  = document.getElementById('ef-date').value;
    if (!checkValid({
      title: { value: title, required: true, label: isAr ? 'العنوان' : 'Title' },
      date:  { value: date,  required: true, label: isAr ? 'التاريخ' : 'Date' },
    }, state.lang)) return;

    const data = {
      title,
      type:        document.getElementById('ef-type').value,
      date,
      endDate:     document.getElementById('ef-enddate').value || null,
      target:      document.getElementById('ef-target').value,
      description: document.getElementById('ef-desc').value.trim(),
      createdBy:   state.profile?.uid,
      createdAt:   new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'calendar_events', event.id), data);
        await recordAudit('update', 'calendar_events', `تعديل حدث: ${data.title} - ${data.date}`);
      } else {
        await addDoc(collection(db, 'calendar_events'), data);
        await recordAudit('create', 'calendar_events', `إضافة حدث: ${data.title} - ${data.date}`);
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Calendar] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}
