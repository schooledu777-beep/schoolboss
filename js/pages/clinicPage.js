import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, checkValid } from '../ui.js';

// ========================= CLINIC / HEALTH MODULE =========================

const VISIT_TYPES = {
  checkup:   { ar: 'فحص روتيني',   en: 'Checkup',     icon: '🩺', color: '#3b82f6' },
  injury:    { ar: 'إصابة',         en: 'Injury',      icon: '🤕', color: '#ef4444' },
  illness:   { ar: 'مرض',           en: 'Illness',     icon: '🤒', color: '#f59e0b' },
  medication:{ ar: 'دواء',          en: 'Medication',  icon: '💊', color: '#8b5cf6' },
  emergency: { ar: 'طارئ',          en: 'Emergency',   icon: '🚨', color: '#dc2626' },
  other:     { ar: 'أخرى',          en: 'Other',       icon: '📋', color: '#6b7280' },
};

export function renderClinic() {
  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  const isParent = role === 'parent';
  const isStudent = role === 'student';

  let visits = state.clinicVisits || [];

  // Role filtering
  if (isParent) {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    visits = visits.filter(v => kidIds.includes(v.studentId));
  }
  if (isStudent) {
    visits = visits.filter(v => v.studentId === state.profile?.uid);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayVisits    = visits.filter(v => v.date === today).length;
  const emergencies    = visits.filter(v => v.type === 'emergency').length;
  const totalStudents  = [...new Set(visits.map(v => v.studentId))].length;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>🏥 ${isAr ? 'العيادة المدرسية' : 'School Clinic'}</h2>
      <div class="header-actions">
        ${isAdmin ? `
          <button class="btn btn-outline" id="health-records-btn">📁 ${isAr ? 'السجلات الصحية' : 'Health Records'}</button>
          <button class="btn btn-primary" id="add-visit-btn">+ ${isAr ? 'تسجيل زيارة' : 'Log Visit'}</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-3" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📅</div>
        <div class="stat-info"><h3>${todayVisits}</h3><p>${isAr ? 'زيارات اليوم' : "Today's Visits"}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">🚨</div>
        <div class="stat-info"><h3>${emergencies}</h3><p>${isAr ? 'حالات طارئة' : 'Emergencies'}</p></div>
      </div>
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">👥</div>
        <div class="stat-info"><h3>${totalStudents}</h3><p>${isAr ? 'طلاب راجعوا العيادة' : 'Students Visited'}</p></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <input type="text" id="clinic-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="clinic-type-filter" class="form-select">
        <option value="">${isAr ? 'كل الأنواع' : 'All Types'}</option>
        ${Object.entries(VISIT_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <input type="date" id="clinic-date-filter" class="form-input" placeholder="${isAr ? 'تاريخ' : 'Date'}">
    </div>

    <!-- Visits Table -->
    <div class="table-responsive glass-card">
      <table class="data-table" id="clinic-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${isAr ? 'الطالب' : 'Student'}</th>
            <th>${isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
            <th>${isAr ? 'نوع الزيارة' : 'Visit Type'}</th>
            <th>${isAr ? 'الأعراض/السبب' : 'Reason'}</th>
            <th>${isAr ? 'الإجراء' : 'Action Taken'}</th>
            ${isAdmin ? `<th>${isAr ? 'إجراءات' : 'Actions'}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${visits.length === 0
            ? `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center text-muted">${t('noData')}</td></tr>`
            : visits.sort((a, b) => new Date(b.date + ' ' + (b.time||'00:00')) - new Date(a.date + ' ' + (a.time||'00:00')))
                    .map((v, i) => {
                const student = state.students.find(s => s.id === v.studentId);
                const vtype = VISIT_TYPES[v.type] || VISIT_TYPES.other;
                return `
                  <tr data-type="${v.type}" data-date="${v.date}">
                    <td>${i + 1}</td>
                    <td>
                      <div style="font-weight:600;">${student?.name || '—'}</div>
                      <div style="font-size:.78rem;color:var(--text-muted);">${student?.grade || state.classes.find(c => c.id === student?.classId)?.name || ''}</div>
                    </td>
                    <td>
                      <div>${formatDate(v.date, isAr)}</div>
                      ${v.time ? `<div style="font-size:.78rem;color:var(--text-muted);">${v.time}</div>` : ''}
                    </td>
                    <td>
                      <span class="badge" style="background:${vtype.color}22;color:${vtype.color};border:1px solid ${vtype.color}44;">
                        ${vtype.icon} ${isAr ? vtype.ar : vtype.en}
                      </span>
                    </td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v.reason||''}">
                      ${v.reason || '—'}
                    </td>
                    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v.action||''}">
                      ${v.action || '—'}
                    </td>
                    ${isAdmin ? `
                    <td>
                      <button class="btn btn-sm btn-outline edit-visit" data-id="${v.id}">✏️</button>
                      <button class="btn btn-sm btn-danger delete-visit" data-id="${v.id}">🗑️</button>
                    </td>` : ''}
                  </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function formatDate(dateStr, isAr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function attachClinicEvents() {
  const isAdmin = state.profile?.role === 'admin';

  document.getElementById('add-visit-btn')?.addEventListener('click', () => showVisitForm());
  document.getElementById('health-records-btn')?.addEventListener('click', showHealthRecords);

  document.getElementById('clinic-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#clinic-table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('clinic-type-filter')?.addEventListener('change', applyFilters);
  document.getElementById('clinic-date-filter')?.addEventListener('change', applyFilters);

  if (isAdmin) {
    document.querySelectorAll('.edit-visit').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = (state.clinicVisits || []).find(x => x.id === btn.dataset.id);
        if (v) showVisitForm(v);
      });
    });
    document.querySelectorAll('.delete-visit').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm(
          state.lang === 'ar' ? 'حذف السجل' : 'Delete Record',
          state.lang === 'ar' ? 'هل تريد حذف هذا السجل؟' : 'Delete this record?',
          async () => {
            try {
              await deleteDoc(doc(db, 'clinic_visits', btn.dataset.id));
              showToast(t('deletedSuccess'), 'success');
            } catch { showToast(t('errorOccurred'), 'error'); }
          }
        );
      });
    });
  }
}

function applyFilters() {
  const type = document.getElementById('clinic-type-filter')?.value;
  const date = document.getElementById('clinic-date-filter')?.value;
  document.querySelectorAll('#clinic-table tbody tr').forEach(row => {
    const typeOk = !type || row.dataset.type === type;
    const dateOk = !date || row.dataset.date === date;
    row.style.display = typeOk && dateOk ? '' : 'none';
  });
}

function showVisitForm(visit = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!visit;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr  = now.toTimeString().slice(0, 5);

  showModal(isEdit ? (isAr ? 'تعديل سجل زيارة' : 'Edit Visit Record') : (isAr ? 'تسجيل زيارة عيادة' : 'Log Clinic Visit'), `
    <form id="visit-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'الطالب' : 'Student'}</label>
        <select id="vf-student" class="form-select" required>
          <option value="">${isAr ? 'اختر الطالب' : 'Select student'}</option>
          ${state.students.map(s => `<option value="${s.id}" ${visit?.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الزيارة' : 'Visit Type'}</label>
        <select id="vf-type" class="form-select">
          ${Object.entries(VISIT_TYPES).map(([k, v]) => `
            <option value="${k}" ${(visit?.type || 'checkup') === k ? 'selected' : ''}>${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'التاريخ' : 'Date'}</label>
        <input type="date" id="vf-date" class="form-input" value="${visit?.date || todayStr}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الوقت' : 'Time'}</label>
        <input type="time" id="vf-time" class="form-input" value="${visit?.time || timeStr}">
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'الأعراض / سبب الزيارة' : 'Symptoms / Reason for Visit'}</label>
        <textarea id="vf-reason" class="form-input" rows="3" style="resize:vertical;" required
          placeholder="${isAr ? 'صف الأعراض أو سبب المراجعة...' : 'Describe symptoms or reason for visit...'}">${visit?.reason || ''}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'الإجراء المتخذ / العلاج' : 'Action Taken / Treatment'}</label>
        <textarea id="vf-action" class="form-input" rows="3" style="resize:vertical;"
          placeholder="${isAr ? 'الدواء المُعطى، الراحة، الإحالة...' : 'Medicine given, rest, referral...'}">${visit?.action || ''}</textarea>
      </div>
      <div class="form-group">
        <label>${isAr ? 'درجة الحرارة (°C)' : 'Temperature (°C)'}</label>
        <input type="number" id="vf-temp" class="form-input" step="0.1" min="35" max="42" value="${visit?.temperature || ''}"
          placeholder="36.5">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تم إخطار ولي الأمر؟' : 'Parent Notified?'}</label>
        <select id="vf-notified" class="form-select">
          <option value="no"  ${(visit?.parentNotified || 'no') === 'no'  ? 'selected' : ''}>${isAr ? 'لا' : 'No'}</option>
          <option value="yes" ${visit?.parentNotified === 'yes' ? 'selected' : ''}>${isAr ? 'نعم' : 'Yes'}</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</label>
        <textarea id="vf-notes" class="form-input" rows="2" style="resize:vertical;">${visit?.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('visit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const studentId = document.getElementById('vf-student').value;
    const reason    = document.getElementById('vf-reason').value.trim();
    const date      = document.getElementById('vf-date').value;

    if (!checkValid({
      student: { value: studentId, required: true, label: isAr ? 'الطالب' : 'Student' },
      reason:  { value: reason,    required: true, label: isAr ? 'السبب'  : 'Reason'  },
      date:    { value: date,      required: true, label: isAr ? 'التاريخ' : 'Date'   },
    }, state.lang)) return;

    const data = {
      studentId,
      type:           document.getElementById('vf-type').value,
      date,
      time:           document.getElementById('vf-time').value,
      reason,
      action:         document.getElementById('vf-action').value.trim(),
      temperature:    document.getElementById('vf-temp').value ? Number(document.getElementById('vf-temp').value) : null,
      parentNotified: document.getElementById('vf-notified').value,
      notes:          document.getElementById('vf-notes').value.trim(),
      recordedBy:     state.profile?.uid,
      createdAt:      visit?.createdAt || new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateDoc(doc(db, 'clinic_visits', visit.id), data);
      else        await addDoc(collection(db, 'clinic_visits'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Clinic] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function showHealthRecords() {
  const isAr = state.lang === 'ar';
  const healthRecords = state.healthRecords || [];

  showModal(isAr ? '📁 السجلات الصحية للطلاب' : '📁 Student Health Records', `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <input type="text" id="hr-search" class="form-input" placeholder="🔍 ${t('search')}..." style="max-width:250px;">
        <button class="btn btn-primary btn-sm" id="add-health-record-btn">+ ${isAr ? 'إضافة سجل' : 'Add Record'}</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>${isAr ? 'الطالب' : 'Student'}</th>
              <th>${isAr ? 'فصيلة الدم' : 'Blood Type'}</th>
              <th>${isAr ? 'أمراض مزمنة' : 'Chronic Conditions'}</th>
              <th>${isAr ? 'حساسية' : 'Allergies'}</th>
              <th>${isAr ? 'ملاحظات' : 'Notes'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${healthRecords.length === 0
              ? `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`
              : healthRecords.map(r => {
                  const student = state.students.find(s => s.id === r.studentId);
                  return `
                    <tr>
                      <td style="font-weight:600;">${student?.name || '—'}</td>
                      <td><span class="badge badge-info">${r.bloodType || '—'}</span></td>
                      <td>${r.conditions || '—'}</td>
                      <td>${r.allergies || '—'}</td>
                      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.notes || '—'}</td>
                      <td>
                        <button class="btn btn-sm btn-outline edit-hr" data-id="${r.id}">✏️</button>
                      </td>
                    </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`, 'wide');

  document.getElementById('hr-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#modal-body table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('add-health-record-btn')?.addEventListener('click', () => showHealthRecordForm());

  document.querySelectorAll('.edit-hr').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = (state.healthRecords || []).find(x => x.id === btn.dataset.id);
      if (r) showHealthRecordForm(r);
    });
  });
}

function showHealthRecordForm(record = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!record;

  showModal(isEdit ? (isAr ? 'تعديل السجل الصحي' : 'Edit Health Record') : (isAr ? 'إضافة سجل صحي' : 'Add Health Record'), `
    <form id="hr-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'الطالب' : 'Student'}</label>
        <select id="hrf-student" class="form-select" required>
          <option value="">${isAr ? 'اختر الطالب' : 'Select student'}</option>
          ${state.students.map(s => `<option value="${s.id}" ${record?.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'فصيلة الدم' : 'Blood Type'}</label>
        <select id="hrf-blood" class="form-select">
          <option value="">${isAr ? 'غير معروف' : 'Unknown'}</option>
          ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => `<option value="${b}" ${record?.bloodType === b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'أمراض مزمنة أو حالات طبية' : 'Chronic Conditions or Medical History'}</label>
        <textarea id="hrf-conditions" class="form-input" rows="2" style="resize:vertical;"
          placeholder="${isAr ? 'مثال: ربو، سكري، ضغط...' : 'e.g. Asthma, Diabetes...'}">${record?.conditions || ''}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'الحساسية' : 'Allergies'}</label>
        <textarea id="hrf-allergies" class="form-input" rows="2" style="resize:vertical;"
          placeholder="${isAr ? 'مثال: حساسية من البنسلين، الفول السوداني...' : 'e.g. Penicillin, Peanuts...'}">${record?.allergies || ''}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</label>
        <textarea id="hrf-notes" class="form-input" rows="2" style="resize:vertical;">${record?.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('hr-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const studentId = document.getElementById('hrf-student').value;
    if (!checkValid({
      student: { value: studentId, required: true, label: isAr ? 'الطالب' : 'Student' },
    }, state.lang)) return;

    const data = {
      studentId,
      bloodType:  document.getElementById('hrf-blood').value,
      conditions: document.getElementById('hrf-conditions').value.trim(),
      allergies:  document.getElementById('hrf-allergies').value.trim(),
      notes:      document.getElementById('hrf-notes').value.trim(),
      updatedAt:  new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateDoc(doc(db, 'health_records', record.id), data);
      else        await addDoc(collection(db, 'health_records'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Clinic] Health record error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}
