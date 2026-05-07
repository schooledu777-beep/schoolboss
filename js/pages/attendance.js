import { state, t } from '../state.js';
import { db, doc, setDoc, writeBatch } from '../firebase-config.js';
import { showToast } from '../ui.js';
import { academicService } from '../services/academicService.js';
import { notificationService } from '../services/notificationService.js';
import { recordAudit } from './auditLog.js';

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
    <div class="page-header">
      <h2>${t('attendance')}</h2>
      <button class="btn btn-outline" onclick="window.exportAttendance?.()">📤 ${state.lang==='ar'?'تصدير CSV':'Export CSV'}</button>
    </div>
    <div class="filter-bar glass-card">
      <div class="form-group"><label>${state.lang==='ar'?'الصف':'Level'}</label>
        <select id="att-class" class="form-select"><option value="">${state.lang==='ar'?'اختر صفاً':'Select Level'}</option>${classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'التاريخ':'Date'}</label>
        <input type="date" id="att-date" class="form-input" value="${todayStr}">
      </div>
      <button class="btn btn-primary" id="load-att-btn">${state.lang==='ar'?'تحميل':'Load'}</button>
    </div>
    <div id="att-list" class="glass-card" style="padding:1.5rem;">
      <p class="text-muted text-center">${state.lang==='ar'?'اختر صفاً وتاريخاً لعرض الحضور':'Select a level and date to load attendance'}</p>
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
  // Dual Lookup: match via class.studentIds[] OR student.classId field
  // This ensures students appear even if the class's studentIds array is out of sync
  const explicitIds = cls?.studentIds || [];
  let students = state.students.filter(s =>
    explicitIds.includes(s.id) || s.classId === classId
  );
  // Sort alphabetically for consistent display
  students.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

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

  const isAr = state.lang === 'ar';

  container.innerHTML = `
    <div class="table-responsive">
    <table class="data-table"><thead><tr><th>#</th><th>${t('fullName')}</th>
    ${canEdit
      ? `<th style="text-align:center">${t('present')}</th><th style="text-align:center">${t('absent')}</th><th style="text-align:center">${t('late')}</th><th style="text-align:center">${t('excused')}</th>`
      : `<th>${isAr ? 'الحالة' : 'Status'}</th>`}
    </tr></thead><tbody>
    ${students.map((s, i) => {
      // Support both composite IDs (new: studentId_date) and legacy random IDs
      const rec = existing.find(a => a.id === `${s.id}_${date}` || (a.studentId === s.id && a.date === date));
      const status = rec?.status || '';
      const isMedical = status === 'medical_excuse';

      if (canEdit) {
        // Medical-excuse row: freeze radios, show 🩺 badge
        const medicalNote = isAr
          ? 'مُعفى طبياً — تم التحويل من العيادة المدرسية'
          : 'Medical Excuse — Referred from School Clinic';
        return `
        <tr class="${isMedical ? 'medical-excuse-row' : ''}">
          <td>${i + 1}</td>
          <td>
            ${s.name}
            ${isMedical ? `<span class="medical-badge" title="${medicalNote}" style="margin-${isAr?'right':'left'}:.35rem;font-size:1rem;cursor:help;">🩺</span>` : ''}
          </td>
          <td style="text-align:center"><input type="radio" name="att-${s.id}" value="present"  ${status==='present' ?'checked':''} ${isMedical?'disabled':''}></td>
          <td style="text-align:center"><input type="radio" name="att-${s.id}" value="absent"   ${status==='absent'  ?'checked':''} ${isMedical?'disabled':''}></td>
          <td style="text-align:center"><input type="radio" name="att-${s.id}" value="late"     ${status==='late'    ?'checked':''} ${isMedical?'disabled':''}></td>
          <td style="text-align:center"><input type="radio" name="att-${s.id}" value="excused"  ${status==='excused' ?'checked':''} ${isMedical?'disabled':''}></td>
        </tr>`;
      } else {
        const statusLabels = {
          present:        '✅ ' + t('present'),
          absent:         '❌ ' + t('absent'),
          late:           '⏰ ' + t('late'),
          excused:        '📋 ' + t('excused'),
          medical_excuse: '🩺 ' + (isAr ? 'عذر طبي' : 'Medical Excuse'),
        };
        return `<tr class="${isMedical ? 'medical-excuse-row' : ''}">
          <td>${i + 1}</td><td>${s.name}</td><td>${statusLabels[status] || '—'}</td>
        </tr>`;
      }
    }).join('')}
    </tbody></table>
    </div>`;

  if (canEdit) {
    const saveBtn = document.getElementById('save-att-btn');
    if (saveBtn) saveBtn.style.display = 'inline-flex';
  }
}

async function saveAttendance() {
  const classId = document.getElementById('att-class')?.value;
  const date    = document.getElementById('att-date')?.value;
  if (!classId || !date) return;

  const cls         = state.classes.find(c => c.id === classId);
  // Dual Lookup: same set shown in loadAttendance — class.studentIds[] OR student.classId
  const explicitIds = cls?.studentIds || [];
  const students    = state.students.filter(s =>
    explicitIds.includes(s.id) || s.classId === classId
  );
  const btn = document.getElementById('save-att-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>'; }

  try {
    // ── Single batch for all students ────────────────────────────────
    const batch = writeBatch(db);
    const now   = new Date().toISOString();
    let   saved = 0;

    for (const student of students) {
      const sid   = student.id;
      const radio = document.querySelector(`input[name="att-${sid}"]:checked`);
      if (!radio) continue;

      // Skip students whose radio inputs are disabled (medical excuse)
      if (radio.disabled) continue;

      // ── Composite doc ID: studentId_date ─────────────────────────
      const attDocId = `${sid}_${date}`;
      const attRef   = doc(db, 'attendance', attDocId);

      batch.set(attRef, {
        studentId: sid,
        classId,
        date,
        status:    radio.value,
        teacherId: state.profile?.uid || '',
        updatedAt: now,
      }, { merge: true });

      // Parent absent notification
      if (radio.value === 'absent') {
        const student = state.students.find(s => s.id === sid);
        if (student?.parentId) {
          const payload = notificationService.buildEventPayload('student_absent', {
            recipientId:  student.parentId,
            studentId:    sid,
            studentName:  student.name,
            date,
          });
          if (payload) notificationService.queueOutboxInBatch(batch, payload);
        }
      }

      saved++;
    }

    await batch.commit();

    // Post-save: audit + academic alerts (outside batch — best effort)
    for (const student of students) {
      const sid   = student.id;
      const radio = document.querySelector(`input[name="att-${sid}"]:checked`);
      if (!radio || radio.disabled) continue;
      recordAudit('create', 'attendance', `تسجيل حضور: ${student.name || sid} - ${radio.value} - ${date}`).catch(() => {});
      academicService.processAcademicAlerts(sid);
    }

    showToast(
      state.lang === 'ar'
        ? `✅ تم حفظ حضور ${saved} طالب`
        : `✅ Saved attendance for ${saved} student${saved !== 1 ? 's' : ''}`,
      'success'
    );
  } catch (e) {
    console.error('[Attendance] Save error:', e);
    showToast(t('errorOccurred'), 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = t('save'); }
}
