import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, checkValid } from '../ui.js';
import { recordAudit } from './auditLog.js';

// ========================= EXAMS MODULE =========================

const EXAM_STATUS = {
  scheduled: { ar: 'مجدول',    en: 'Scheduled',  color: '#3b82f6', icon: '📅' },
  ongoing:   { ar: 'جارٍ',     en: 'Ongoing',    color: '#f59e0b', icon: '⏳' },
  completed: { ar: 'منتهي',    en: 'Completed',  color: '#10b981', icon: '✅' },
  cancelled: { ar: 'ملغي',     en: 'Cancelled',  color: '#ef4444', icon: '❌' },
};

export function renderExams() {
  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';
  const isStudent = role === 'student';
  const canManage = isAdmin || isTeacher;

  let exams = state.examSchedule || [];

  if (isTeacher) {
    const mySubjects = state.subjects.filter(s => s.teacherId === state.profile?.uid).map(s => s.name);
    exams = exams.filter(e => mySubjects.includes(e.subject) || e.teacherId === state.profile?.uid);
  }

  const now = new Date().toISOString().split('T')[0];
  const upcoming  = exams.filter(e => e.date >= now && e.status !== 'cancelled').length;
  const completed = exams.filter(e => e.status === 'completed').length;
  const total     = exams.length;

  // Group by date for timeline
  const grouped = {};
  [...exams].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📝 ${isAr ? 'جدول الامتحانات' : 'Exam Schedule'}</h2>
      <div class="header-actions">
        ${canManage ? `
          <button class="btn btn-outline" id="exam-timetable-btn">🖨️ ${isAr ? 'طباعة الجدول' : 'Print Timetable'}</button>
          <button class="btn btn-primary" id="add-exam-btn">+ ${isAr ? 'إضافة امتحان' : 'Add Exam'}</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-3" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📅</div>
        <div class="stat-info"><h3>${upcoming}</h3><p>${isAr ? 'امتحانات قادمة' : 'Upcoming Exams'}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">✅</div>
        <div class="stat-info"><h3>${completed}</h3><p>${isAr ? 'منتهية' : 'Completed'}</p></div>
      </div>
      <div class="stat-card gradient-purple">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${total}</h3><p>${isAr ? 'إجمالي' : 'Total'}</p></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <select id="exam-class-filter" class="form-select">
        <option value="">${isAr ? 'كل الصفوف' : 'All Classes'}</option>
        ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <select id="exam-status-filter" class="form-select">
        <option value="">${isAr ? 'كل الحالات' : 'All Statuses'}</option>
        ${Object.entries(EXAM_STATUS).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <select id="exam-view-toggle" class="form-select">
        <option value="timeline">${isAr ? 'عرض الجدول الزمني' : 'Timeline View'}</option>
        <option value="table">${isAr ? 'عرض الجدول' : 'Table View'}</option>
      </select>
    </div>

    <!-- Timeline View -->
    <div id="exam-timeline">
      ${Object.keys(grouped).length === 0
        ? `<div class="empty-state glass-card"><span class="empty-icon">📝</span><h3>${isAr ? 'لا توجد امتحانات مجدولة' : 'No exams scheduled'}</h3></div>`
        : Object.entries(grouped).map(([date, dayExams]) => {
          const isToday = date === now;
          const isPast  = date < now;
          const dateLabel = new Date(date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
          return `
            <div class="exam-day" style="margin-bottom:1.5rem;">
              <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
                <div style="width:10px;height:10px;border-radius:50%;background:${isToday ? '#6366f1' : isPast ? '#6b7280' : '#10b981'};flex-shrink:0;"></div>
                <h4 style="margin:0;font-size:.95rem;color:${isToday ? 'var(--primary)' : isPast ? 'var(--text-muted)' : 'var(--text)'};">
                  ${dateLabel}
                  ${isToday ? `<span class="badge badge-info" style="margin-${isAr?'right':'left'}:.5rem;">${isAr ? 'اليوم' : 'Today'}</span>` : ''}
                </h4>
              </div>
              <div style="margin-${isAr?'right':'left'}:1.25rem;border-${isAr?'right':'left'}:2px solid var(--border);padding-${isAr?'right':'left'}:1rem;">
                ${dayExams.map(exam => renderExamCard(exam, canManage, isAr)).join('')}
              </div>
            </div>`;
        }).join('')}
    </div>

    <!-- Table View (hidden by default) -->
    <div id="exam-table-view" style="display:none;">
      <div class="table-responsive glass-card">
        <table class="data-table" id="exams-table">
          <thead>
            <tr>
              <th>#</th>
              <th>${isAr ? 'المادة' : 'Subject'}</th>
              <th>${isAr ? 'الصف' : 'Class'}</th>
              <th>${isAr ? 'التاريخ' : 'Date'}</th>
              <th>${isAr ? 'الوقت' : 'Time'}</th>
              <th>${isAr ? 'القاعة' : 'Room'}</th>
              <th>${isAr ? 'المدة' : 'Duration'}</th>
              <th>${isAr ? 'الحالة' : 'Status'}</th>
              ${canManage ? `<th>${isAr ? 'إجراءات' : 'Actions'}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${exams.length === 0
              ? `<tr><td colspan="${canManage ? 9 : 8}" class="text-center text-muted">${t('noData')}</td></tr>`
              : [...exams].sort((a, b) => new Date(a.date) - new Date(b.date)).map((exam, i) => {
                  const cls = state.classes.find(c => c.id === exam.classId);
                  const status = EXAM_STATUS[exam.status] || EXAM_STATUS.scheduled;
                  return `
                    <tr>
                      <td>${i + 1}</td>
                      <td style="font-weight:600;">${exam.subject || '—'}</td>
                      <td>${cls?.name || '—'}</td>
                      <td>${formatDate(exam.date, isAr)}</td>
                      <td>${exam.startTime || '—'} ${exam.endTime ? `- ${exam.endTime}` : ''}</td>
                      <td>${exam.room || '—'}</td>
                      <td>${exam.duration ? `${exam.duration} ${isAr ? 'دقيقة' : 'min'}` : '—'}</td>
                      <td><span class="badge" style="background:${status.color}22;color:${status.color};">${status.icon} ${isAr ? status.ar : status.en}</span></td>
                      ${canManage ? `
                        <td>
                          <button class="btn btn-sm btn-outline edit-exam" data-id="${exam.id}">✏️</button>
                          <button class="btn btn-sm btn-danger delete-exam" data-id="${exam.id}">🗑️</button>
                        </td>` : ''}
                    </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderExamCard(exam, canManage, isAr) {
  const cls    = state.classes.find(c => c.id === exam.classId);
  const status = EXAM_STATUS[exam.status] || EXAM_STATUS.scheduled;
  const now    = new Date().toISOString().split('T')[0];
  const isPast = exam.date < now;

  return `
    <div class="glass-card exam-card" data-class="${exam.classId||''}" data-status="${exam.status||'scheduled'}"
         style="margin-bottom:.75rem;padding:1rem;opacity:${isPast && exam.status !== 'ongoing' ? '.7' : '1'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
            <span style="font-size:1.1rem;">📝</span>
            <strong style="font-size:.95rem;">${exam.subject || '—'}</strong>
            <span class="badge" style="background:${status.color}22;color:${status.color};">${status.icon} ${isAr ? status.ar : status.en}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-top:.4rem;font-size:.82rem;color:var(--text-muted);">
            ${cls ? `<span>🏫 ${cls.name}</span>` : ''}
            ${exam.startTime ? `<span>🕐 ${exam.startTime}${exam.endTime ? ` - ${exam.endTime}` : ''}</span>` : ''}
            ${exam.room ? `<span>🚪 ${exam.room}</span>` : ''}
            ${exam.duration ? `<span>⏱ ${exam.duration} ${isAr ? 'دقيقة' : 'min'}</span>` : ''}
            ${exam.maxScore ? `<span>💯 ${isAr ? 'من' : 'Max:'} ${exam.maxScore}</span>` : ''}
          </div>
          ${exam.notes ? `<p style="font-size:.82rem;color:var(--text-muted);margin:.35rem 0 0;">${exam.notes}</p>` : ''}
        </div>
        ${canManage ? `
          <div style="display:flex;gap:.5rem;flex-shrink:0;">
            <button class="btn btn-sm btn-outline edit-exam" data-id="${exam.id}">✏️</button>
            <button class="btn btn-sm btn-danger delete-exam" data-id="${exam.id}">🗑️</button>
          </div>` : ''}
      </div>
    </div>`;
}

function formatDate(dateStr, isAr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function attachExamsEvents() {
  const canManage = ['admin', 'teacher'].includes(state.profile?.role);
  const isAr = state.lang === 'ar';

  document.getElementById('add-exam-btn')?.addEventListener('click', () => showExamForm());
  document.getElementById('exam-timetable-btn')?.addEventListener('click', printTimetable);

  document.getElementById('exam-view-toggle')?.addEventListener('change', e => {
    const isTable = e.target.value === 'table';
    document.getElementById('exam-timeline').style.display   = isTable ? 'none' : '';
    document.getElementById('exam-table-view').style.display = isTable ? '' : 'none';
  });

  document.getElementById('exam-class-filter')?.addEventListener('change', applyFilters);
  document.getElementById('exam-status-filter')?.addEventListener('change', applyFilters);

  if (canManage) {
    document.querySelectorAll('.edit-exam').forEach(btn => {
      btn.addEventListener('click', () => {
        const exam = (state.examSchedule || []).find(e => e.id === btn.dataset.id);
        if (exam) showExamForm(exam);
      });
    });
    document.querySelectorAll('.delete-exam').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm(
          isAr ? 'حذف الامتحان' : 'Delete Exam',
          isAr ? 'هل تريد حذف هذا الامتحان؟' : 'Delete this exam?',
          async () => {
            try {
              const exam = (state.examSchedule || []).find(x => x.id === btn.dataset.id);
              await deleteDoc(doc(db, 'exam_schedule', btn.dataset.id));
              await recordAudit('delete', 'exam_schedule', `حذف امتحان: ${exam?.subject || btn.dataset.id}`);
              showToast(t('deletedSuccess'), 'success');
            } catch { showToast(t('errorOccurred'), 'error'); }
          }
        );
      });
    });
  }
}

function applyFilters() {
  const classId = document.getElementById('exam-class-filter')?.value;
  const status  = document.getElementById('exam-status-filter')?.value;
  document.querySelectorAll('.exam-card').forEach(card => {
    const classOk  = !classId || card.dataset.class === classId;
    const statusOk = !status  || card.dataset.status === status;
    card.style.display = classOk && statusOk ? '' : 'none';
  });
  document.querySelectorAll('#exams-table tbody tr').forEach(row => {
    row.style.display = ''; // reset for table view
  });
}

function showExamForm(exam = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!exam;

  showModal(isEdit ? (isAr ? 'تعديل الامتحان' : 'Edit Exam') : (isAr ? 'إضافة امتحان' : 'Add Exam'), `
    <form id="exam-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'المادة' : 'Subject'}</label>
        <input type="text" id="ef-subject" class="form-input" value="${exam?.subject || ''}" list="exam-subjects-list" required>
        <datalist id="exam-subjects-list">
          ${state.subjects.map(s => `<option value="${s.name}">`).join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الصف' : 'Class'}</label>
        <select id="ef-class" class="form-select" required>
          <option value="">${isAr ? 'اختر الصف' : 'Select class'}</option>
          ${state.classes.map(c => `<option value="${c.id}" ${exam?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'التاريخ' : 'Date'}</label>
        <input type="date" id="ef-date" class="form-input" value="${exam?.date || ''}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'وقت البداية' : 'Start Time'}</label>
        <input type="time" id="ef-start" class="form-input" value="${exam?.startTime || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'وقت النهاية' : 'End Time'}</label>
        <input type="time" id="ef-end" class="form-input" value="${exam?.endTime || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'المدة (بالدقائق)' : 'Duration (minutes)'}</label>
        <input type="number" id="ef-duration" class="form-input" value="${exam?.duration || 90}" min="15" step="5">
      </div>
      <div class="form-group">
        <label>${isAr ? 'القاعة / الغرفة' : 'Room / Hall'}</label>
        <input type="text" id="ef-room" class="form-input" value="${exam?.room || ''}" placeholder="${isAr ? 'مثال: قاعة A' : 'e.g. Hall A'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الدرجة الكاملة' : 'Max Score'}</label>
        <input type="number" id="ef-max" class="form-input" value="${exam?.maxScore || 100}" min="1">
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الامتحان' : 'Exam Type'}</label>
        <select id="ef-type" class="form-select">
          <option value="midterm"  ${(exam?.examType||'midterm') === 'midterm'  ? 'selected' : ''}>${isAr ? 'نصفي' : 'Midterm'}</option>
          <option value="final"    ${exam?.examType === 'final'    ? 'selected' : ''}>${isAr ? 'نهائي' : 'Final'}</option>
          <option value="quiz"     ${exam?.examType === 'quiz'     ? 'selected' : ''}>${isAr ? 'اختبار قصير' : 'Quiz'}</option>
          <option value="makeup"   ${exam?.examType === 'makeup'   ? 'selected' : ''}>${isAr ? 'تكميلي' : 'Make-up'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الحالة' : 'Status'}</label>
        <select id="ef-status" class="form-select">
          ${Object.entries(EXAM_STATUS).map(([k, v]) => `
            <option value="${k}" ${(exam?.status || 'scheduled') === k ? 'selected' : ''}>${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'ملاحظات وتعليمات' : 'Notes & Instructions'}</label>
        <textarea id="ef-notes" class="form-input" rows="3" style="resize:vertical;">${exam?.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('exam-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const subject = document.getElementById('ef-subject').value.trim();
    const classId = document.getElementById('ef-class').value;
    const date    = document.getElementById('ef-date').value;

    if (!checkValid({
      subject: { value: subject, required: true, label: isAr ? 'المادة' : 'Subject' },
      class:   { value: classId, required: true, label: isAr ? 'الصف'   : 'Class'   },
      date:    { value: date,    required: true, label: isAr ? 'التاريخ' : 'Date'   },
    }, state.lang)) return;

    const data = {
      subject,
      classId,
      date,
      startTime:  document.getElementById('ef-start').value,
      endTime:    document.getElementById('ef-end').value,
      duration:   Number(document.getElementById('ef-duration').value) || 90,
      room:       document.getElementById('ef-room').value.trim(),
      maxScore:   Number(document.getElementById('ef-max').value) || 100,
      examType:   document.getElementById('ef-type').value,
      status:     document.getElementById('ef-status').value,
      notes:      document.getElementById('ef-notes').value.trim(),
      teacherId:  state.profile?.uid,
      createdAt:  exam?.createdAt || new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'exam_schedule', exam.id), data);
        await recordAudit('update', 'exam_schedule', `تعديل امتحان: ${data.subject} - ${data.date}`);
      } else {
        await addDoc(collection(db, 'exam_schedule'), data);
        await recordAudit('create', 'exam_schedule', `إضافة امتحان: ${data.subject} - ${data.date}`);
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Exams] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function printTimetable() {
  const isAr = state.lang === 'ar';
  const exams = [...(state.examSchedule || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  const rows = exams.map((exam, i) => {
    const cls = state.classes.find(c => c.id === exam.classId);
    return `<tr>
      <td>${i + 1}</td>
      <td>${exam.subject || '—'}</td>
      <td>${cls?.name || '—'}</td>
      <td>${formatDate(exam.date, isAr)}</td>
      <td>${exam.startTime || '—'}${exam.endTime ? ` - ${exam.endTime}` : ''}</td>
      <td>${exam.room || '—'}</td>
      <td>${exam.maxScore || '—'}</td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`
    <html><head>
    <meta charset="utf-8">
    <title>${isAr ? 'جدول الامتحانات' : 'Exam Timetable'}</title>
    <style>
      body { font-family: 'Tajawal', Arial, sans-serif; direction: ${isAr ? 'rtl' : 'ltr'}; padding: 20px; }
      h2 { text-align: center; color: #6366f1; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #6366f1; color: white; padding: 10px; }
      td { padding: 8px; border: 1px solid #ddd; }
      tr:nth-child(even) { background: #f9f9f9; }
    </style>
    </head><body>
    <h2>${isAr ? 'جدول الامتحانات' : 'Exam Timetable'}</h2>
    <table>
      <thead><tr>
        <th>#</th>
        <th>${isAr ? 'المادة' : 'Subject'}</th>
        <th>${isAr ? 'الصف' : 'Class'}</th>
        <th>${isAr ? 'التاريخ' : 'Date'}</th>
        <th>${isAr ? 'الوقت' : 'Time'}</th>
        <th>${isAr ? 'القاعة' : 'Room'}</th>
        <th>${isAr ? 'الدرجة' : 'Max Score'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>`);
  w.document.close();
}
