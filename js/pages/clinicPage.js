import { state, t } from '../state.js';
import { showModal, closeModal, showConfirm, showToast, checkValid, escapeHTML, renderEmptyState } from '../ui.js';
import { saveClinicVisit, deleteClinicVisit, getClinicStats } from '../services/clinicService.js';
import { recordAudit } from './auditLog.js';

// ========================= CLINIC PAGE =========================

let _clinicTab = 'today'; // 'today' | 'all'

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────
export function renderClinic() {
  const isAr = state.lang === 'ar';
  const role  = state.profile?.role;
  const canManage = ['admin', 'teacher'].includes(role);
  const stats = getClinicStats();

  const today = new Date().toISOString().slice(0, 10);
  const visits = state.clinicVisits || [];
  const todayVisits = visits.filter(v => v.date === today)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const allVisits = [...visits].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return `
  <div class="page-content animate-in">
    <!-- Header -->
    <div class="page-header">
      <h2>🩺 ${isAr ? 'العيادة المدرسية' : 'School Clinic'}</h2>
      <div class="header-actions">
        ${canManage ? `<button class="btn btn-primary" id="clinic-add-btn">+ ${isAr ? 'تسجيل زيارة' : 'Add Visit'}</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-4" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${stats.todayVisits}</h3><p>${isAr ? 'زيارات اليوم' : "Today's Visits"}</p></div>
      </div>
      <div class="stat-card gradient-orange">
        <div class="stat-icon">🏠</div>
        <div class="stat-info"><h3>${stats.sentHome}</h3><p>${isAr ? 'أُرسلوا للمنزل' : 'Sent Home'}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">🚑</div>
        <div class="stat-info"><h3>${stats.referred}</h3><p>${isAr ? 'محوّلون للمستشفى' : 'Referred'}</p></div>
      </div>
      <div class="stat-card gradient-purple">
        <div class="stat-icon">🛏️</div>
        <div class="stat-info"><h3>${stats.inClinic}</h3><p>${isAr ? 'في العيادة' : 'In Clinic'}</p></div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar" style="margin-bottom:1.25rem;">
      <button class="tab-btn ${_clinicTab === 'today' ? 'active' : ''}" onclick="window._setClinicTab('today')">
        🗓️ ${isAr ? 'زيارات اليوم' : 'Today'}
        <span class="badge badge-primary" style="margin-${isAr?'right':'left'}:.4rem;">${todayVisits.length}</span>
      </button>
      <button class="tab-btn ${_clinicTab === 'all' ? 'active' : ''}" onclick="window._setClinicTab('all')">
        📂 ${isAr ? 'كل السجلات' : 'All Records'}
        <span class="badge badge-info" style="margin-${isAr?'right':'left'}:.4rem;">${allVisits.length}</span>
      </button>
    </div>

    <!-- Search (All tab only) -->
    ${_clinicTab === 'all' ? `
    <div class="filter-bar glass-card" style="margin-bottom:1.25rem;">
      <input type="text" id="clinic-search" class="form-input" placeholder="🔍 ${isAr ? 'بحث باسم الطالب...' : 'Search student...'}">
      <select id="clinic-action-filter" class="form-select">
        <option value="">${isAr ? 'كل الإجراءات' : 'All Actions'}</option>
        <option value="rest">${isAr ? 'راحة في العيادة' : 'Rest in Clinic'}</option>
        <option value="home">${isAr ? 'أُرسل للمنزل' : 'Sent Home'}</option>
        <option value="hospital">${isAr ? 'تحويل للمستشفى' : 'Referred'}</option>
        <option value="medicine">${isAr ? 'دواء والعودة' : 'Medicine & Return'}</option>
      </select>
    </div>` : ''}

    <!-- Table -->
    <div class="glass-card" id="clinic-table-wrap">
      ${renderVisitsTable(_clinicTab === 'today' ? todayVisits : allVisits, isAr, canManage)}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
//  TABLE
// ─────────────────────────────────────────────────────────────
function renderVisitsTable(visits, isAr, canManage) {
  if (!visits.length) return renderEmptyState(isAr ? 'لا توجد زيارات' : 'No visits found');

  const actionLabel = (a) => ({
    rest:     isAr ? 'راحة في العيادة'   : 'Rest in Clinic',
    home:     isAr ? 'أُرسل للمنزل'      : 'Sent Home',
    hospital: isAr ? 'تحويل للمستشفى'   : 'Referred',
    medicine: isAr ? 'دواء والعودة'      : 'Medicine & Return',
  }[a] || a);

  const actionBadge = (a) => ({
    rest:     'badge-info',
    home:     'badge-warning',
    hospital: 'badge-danger',
    medicine: 'badge-success',
  }[a] || 'badge-info');

  return `
  <div class="table-responsive">
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${isAr ? 'الطالب' : 'Student'}</th>
          <th>${isAr ? 'الصف' : 'Class'}</th>
          <th>${isAr ? 'التاريخ' : 'Date'}</th>
          <th>${isAr ? 'الأعراض' : 'Symptoms'}</th>
          <th>${isAr ? 'التشخيص' : 'Diagnosis'}</th>
          <th>${isAr ? 'الإجراء' : 'Action'}</th>
          <th>${isAr ? 'عذر طبي' : 'Medical Excuse'}</th>
          ${canManage ? `<th>${isAr ? 'خيارات' : 'Options'}</th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${visits.map((v, i) => {
          const student = state.students.find(s => s.id === v.studentId);
          const cls     = state.classes.find(c => c.id === v.classId || c.id === student?.classId);
          return `
          <tr class="${v.action_taken === 'hospital' ? 'row-danger' : v.action_taken === 'home' ? 'row-warning' : ''}">
            <td>${i + 1}</td>
            <td><strong>${escapeHTML(student?.name || v.studentId || '—')}</strong></td>
            <td>${escapeHTML(cls?.name || '—')}</td>
            <td>${v.date || '—'}</td>
            <td style="max-width:160px;white-space:normal;font-size:.82rem;">${escapeHTML(v.symptoms || '—')}</td>
            <td style="max-width:160px;white-space:normal;font-size:.82rem;">${escapeHTML(v.diagnosis || '—')}</td>
            <td><span class="badge ${actionBadge(v.action_taken)}">${actionLabel(v.action_taken)}</span></td>
            <td style="text-align:center">
              ${v.medicalExcuse
                ? `<span title="${isAr ? 'تم تحديث الحضور تلقائياً' : 'Attendance auto-updated'}" style="font-size:1.2rem;">🩺</span>`
                : '—'}
            </td>
            ${canManage ? `
            <td>
              <div style="display:flex;gap:.4rem;">
                <button class="btn btn-xs btn-outline" onclick="window._clinicEditVisit('${v.id}')">✏️</button>
                <button class="btn btn-xs btn-danger" onclick="window._clinicDeleteVisit('${v.id}')">🗑️</button>
              </div>
            </td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
//  VISIT FORM MODAL
// ─────────────────────────────────────────────────────────────
function openVisitForm(existingId = null) {
  const isAr = state.lang === 'ar';
  const today = new Date().toISOString().slice(0, 10);
  const existing = existingId ? (state.clinicVisits || []).find(v => v.id === existingId) : null;
  const students = state.students || [];

  const studentOptions = students
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
    .map(s => {
      const cls = state.classes.find(c => c.id === s.classId);
      return `<option value="${s.id}" data-class="${s.classId || ''}" ${existing?.studentId === s.id ? 'selected' : ''}>
        ${escapeHTML(s.name || s.id)}${cls ? ' — ' + escapeHTML(cls.name) : ''}
      </option>`;
    }).join('');

  const v = existing || {};

  showModal(
    `🩺 ${isAr ? (existingId ? 'تعديل زيارة' : 'تسجيل زيارة جديدة') : (existingId ? 'Edit Visit' : 'New Visit')}`,
    `
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">${isAr ? 'الطالب' : 'Student'} *</label>
        <select id="cv-student" class="form-select" required onchange="window._clinicAutoFillClass(this)">
          <option value="">${isAr ? '— اختر الطالب —' : '— Select Student —'}</option>
          ${studentOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${isAr ? 'الصف' : 'Class'}</label>
        <select id="cv-class" class="form-select">
          <option value="">${isAr ? 'تلقائي من الطالب' : 'Auto from student'}</option>
          ${(state.classes || []).map(c => `<option value="${c.id}" ${existing?.classId === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${isAr ? 'التاريخ' : 'Date'} *</label>
        <input type="date" id="cv-date" class="form-input" value="${v.date || today}" required>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">${isAr ? 'الأعراض' : 'Symptoms'}</label>
        <textarea id="cv-symptoms" class="form-input" rows="2" placeholder="${isAr ? 'صف الأعراض...' : 'Describe symptoms...'}">${escapeHTML(v.symptoms || '')}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">${isAr ? 'التشخيص' : 'Diagnosis'}</label>
        <textarea id="cv-diagnosis" class="form-input" rows="2" placeholder="${isAr ? 'التشخيص المبدئي...' : 'Initial diagnosis...'}">${escapeHTML(v.diagnosis || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">${isAr ? 'الإجراء المتخذ' : 'Action Taken'} *</label>
        <select id="cv-action" class="form-select" onchange="window._clinicToggleExcuse(this.value)">
          <option value="rest"     ${v.action_taken==='rest'     ? 'selected' : ''}>${isAr ? 'راحة في العيادة'    : 'Rest in Clinic'}</option>
          <option value="home"     ${v.action_taken==='home'     ? 'selected' : ''}>${isAr ? 'إرسال للمنزل'        : 'Sent Home'}</option>
          <option value="hospital" ${v.action_taken==='hospital' ? 'selected' : ''}>${isAr ? 'تحويل للمستشفى'    : 'Referred to Hospital'}</option>
          <option value="medicine" ${v.action_taken==='medicine' ? 'selected' : ''}>${isAr ? 'دواء والعودة للصف'  : 'Medicine & Return'}</option>
        </select>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:.75rem;padding-top:1.5rem;">
        <input type="checkbox" id="cv-excuse" style="width:18px;height:18px;cursor:pointer;"
          ${(v.medicalExcuse || ['home','hospital'].includes(v.action_taken || 'rest')) ? 'checked' : ''}>
        <label for="cv-excuse" style="cursor:pointer;font-weight:600;font-size:.9rem;">
          🩺 ${isAr ? 'إصدار عذر طبي (يُعدّل الحضور تلقائياً)' : 'Issue Medical Excuse (auto-updates attendance)'}
        </label>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">${isAr ? 'ملاحظات' : 'Notes'}</label>
        <textarea id="cv-note" class="form-input" rows="2" placeholder="${isAr ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}">${escapeHTML(v.note || '')}</textarea>
      </div>
    </div>
    <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.25rem;">
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-primary" id="cv-save-btn">💾 ${isAr ? 'حفظ الزيارة' : 'Save Visit'}</button>
    </div>`,
    { wide: true }
  );

  // Auto-toggle excuse checkbox based on action
  window._clinicToggleExcuse = (action) => {
    const chk = document.getElementById('cv-excuse');
    if (chk) chk.checked = ['home', 'hospital'].includes(action);
  };

  // Auto-fill class from student select
  window._clinicAutoFillClass = (sel) => {
    const classId = sel.selectedOptions[0]?.dataset?.class;
    if (classId) {
      const cs = document.getElementById('cv-class');
      if (cs) cs.value = classId;
    }
  };

  // Init toggle state for edit mode
  window._clinicToggleExcuse(v.action_taken || 'rest');

  // Save
  document.getElementById('cv-save-btn').onclick = async () => {
    const studentId    = document.getElementById('cv-student').value.trim();
    const classId      = document.getElementById('cv-class').value.trim();
    const date         = document.getElementById('cv-date').value.trim();
    const symptoms     = document.getElementById('cv-symptoms').value.trim();
    const diagnosis    = document.getElementById('cv-diagnosis').value.trim();
    const action_taken = document.getElementById('cv-action').value;
    const medicalExcuse = document.getElementById('cv-excuse').checked;
    const note         = document.getElementById('cv-note').value.trim();

    const valid = checkValid({
      student: { value: studentId, required: true, label: isAr ? 'الطالب' : 'Student' },
      date:    { value: date,      required: true, label: isAr ? 'التاريخ' : 'Date'    },
    }, state.lang);
    if (!valid) return;

    const btn = document.getElementById('cv-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const student = state.students.find(s => s.id === studentId);
      const resolvedClassId = classId || student?.classId || '';

      await saveClinicVisit({
        studentId,
        classId: resolvedClassId,
        date,
        symptoms,
        diagnosis,
        action_taken,
        medicalExcuse,
        note,
        nurseId:   state.profile?.uid  || '',
        nurseName: state.profile?.name || '',
      }, existingId);

      await recordAudit({
        action: existingId ? 'update_clinic_visit' : 'add_clinic_visit',
        targetType: 'clinic_visit',
        targetId: studentId,
        details: { studentId, date, action_taken },
      });

      closeModal();
      showToast(
        isAr
          ? `✅ تم حفظ الزيارة${medicalExcuse ? ' وتحديث سجل الحضور' : ''}`
          : `✅ Visit saved${medicalExcuse ? ' and attendance updated' : ''}`,
        'success'
      );
    } catch (err) {
      console.error('[Clinic] Save error:', err);
      showToast(isAr ? '❌ حدث خطأ أثناء الحفظ' : '❌ Error saving visit', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '💾 ' + (isAr ? 'حفظ الزيارة' : 'Save Visit'); }
    }
  };
}

// ─────────────────────────────────────────────────────────────
//  ATTACH EVENTS
// ─────────────────────────────────────────────────────────────
export function attachClinicEvents() {
  const isAr = state.lang === 'ar';

  // Tab switching — triggers state.notify() to re-render
  window._setClinicTab = (tab) => {
    _clinicTab = tab;
    state.notify();
  };

  // Add visit button
  document.getElementById('clinic-add-btn')?.addEventListener('click', () => openVisitForm());

  // Edit visit
  window._clinicEditVisit = (id) => openVisitForm(id);

  // Delete visit
  window._clinicDeleteVisit = (id) => {
    const visit   = (state.clinicVisits || []).find(v => v.id === id);
    const student = state.students.find(s => s.id === visit?.studentId);
    showConfirm(
      isAr ? 'حذف الزيارة' : 'Delete Visit',
      isAr
        ? `هل تريد حذف زيارة ${escapeHTML(student?.name || '')}؟`
        : `Delete visit for ${escapeHTML(student?.name || '')}?`,
      async () => {
        try {
          await deleteClinicVisit(id);
          await recordAudit({ action: 'delete_clinic_visit', targetType: 'clinic_visit', targetId: id });
          showToast(isAr ? 'تم الحذف' : 'Deleted', 'success');
        } catch (e) {
          showToast(isAr ? 'خطأ في الحذف' : 'Delete error', 'error');
        }
      },
      'danger'
    );
  };

  // Live search + filter (All Records tab)
  document.getElementById('clinic-search')?.addEventListener('input', _filterClinicTable);
  document.getElementById('clinic-action-filter')?.addEventListener('change', _filterClinicTable);
}

function _filterClinicTable() {
  const q      = (document.getElementById('clinic-search')?.value || '').toLowerCase();
  const action = document.getElementById('clinic-action-filter')?.value || '';
  document.querySelectorAll('#clinic-table-wrap tbody tr').forEach(row => {
    const text   = row.textContent.toLowerCase();
    const badgeTxt = row.querySelector('.badge')?.textContent?.toLowerCase() || '';
    row.style.display = (!q || text.includes(q)) && (!action || badgeTxt.includes(action.slice(0,4))) ? '' : 'none';
  });
}
