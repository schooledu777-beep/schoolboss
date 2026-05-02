import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, arrayUnion } from '../firebase-config.js';
import { adminCreateUser } from '../auth.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML, renderAvatar } from '../ui.js?v=20260502-photo-sync';
import { getStudentDashboardHTML, attachStudentProfileEvents } from './studentProfile.js';
import { uploadFile } from '../services/uploadService.js?v=20260502-photo-sync';

export function renderStudents() {
  const students = state.students;
  const searchId = 'student-search';
  const isAdmin  = state.profile?.role === 'admin';
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('students')}</h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        ${isAdmin ? `<button class="btn btn-outline" id="import-students-btn">📥 ${state.lang==='ar'?'استيراد Excel':'Import Excel'}</button>` : ''}
        <button class="btn btn-primary" id="add-student-btn">+ ${t('add')}</button>
      </div>
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="${searchId}" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="student-class-filter" class="form-select">
        <option value="">${state.lang === 'ar' ? 'كل الصفوف' : 'All Levels'}</option>
        ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="students-table">
        <thead><tr>
          <th>#</th><th>${t('fullName')}</th><th>${state.lang === 'ar' ? 'الصف' : 'Level'}</th>
          <th>${state.lang === 'ar' ? 'الجنس' : 'Gender'}</th><th>${t('email')}</th>
          <th>${state.lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
        </tr></thead>
        <tbody>
          ${students.map((s, i) => {
            const cls = state.classes.find(c => c.id === s.classId);
            return `<tr class="clickable-row" data-id="${s.id}">
              <td>${i + 1}</td><td><div class="user-cell">${renderAvatar(s.name, s.photoURL, 'avatar-xs')}<span class="student-link" style="color:var(--primary-light); font-weight:600;">${escapeHTML(s.name || '')}</span></div></td>
              <td>${cls?.name || '—'}</td><td>${s.gender === 'male' ? '👦' : '👧'}</td><td>${s.email || '—'}</td>
              <td>
                <button class="btn btn-sm btn-outline transfer-student" data-id="${s.id}" title="${state.lang==='ar'?'نقل الطالب':'Transfer Student'}">🔄</button>
                <button class="btn btn-sm btn-outline edit-student" data-id="${s.id}">✏️</button>
                <button class="btn btn-sm btn-danger delete-student" data-id="${s.id}">🗑️</button>
              </td>
            </tr>`;
          }).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function showStudentCardModal(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;
  
  showModal(
    state.lang === 'ar' ? 'بطاقة الطالب' : 'Student Card',
    getStudentDashboardHTML(studentId),
    { wide: true }
  );

  // Target the modal body to attach events
  const modalBody = document.querySelector('.student-profile-modal')?.parentElement;
  if (modalBody) attachStudentProfileEvents(modalBody);
}

export function attachStudentEvents() {
  document.getElementById('add-student-btn')?.addEventListener('click', () => showStudentForm());
  document.getElementById('import-students-btn')?.addEventListener('click', () => showImportModal());
  
  // Click row to show student card
  document.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't trigger if clicking action buttons
      if (e.target.closest('button')) return;
      showStudentCardModal(row.dataset.id);
    });
  });

  document.querySelectorAll('.edit-student').forEach(btn => btn.addEventListener('click', () => {
    const student = state.students.find(s => s.id === btn.dataset.id);
    if (student) showStudentForm(student);
  }));

  document.querySelectorAll('.transfer-student').forEach(btn => btn.addEventListener('click', () => {
    const student = state.students.find(s => s.id === btn.dataset.id);
    if (student) showTransferModal(student);
  }));

  document.querySelectorAll('.delete-student').forEach(btn => btn.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try {
        await deleteDoc(doc(db, 'students', btn.dataset.id));
        showToast(t('deletedSuccess'), 'success');
      } catch(e) { showToast(t('errorOccurred'), 'error'); }
    });
  }));
  // Search filter
  document.getElementById('student-search')?.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('#students-table tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(val) ? '' : 'none';
    });
  });
  document.getElementById('student-class-filter')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const filtered = val ? state.students.filter(s => s.classId === val) : state.students;
    // Re-render table body
    const tbody = document.querySelector('#students-table tbody');
    if (tbody) {
      tbody.innerHTML = filtered.map((s, i) => {
        const cls = state.classes.find(c => c.id === s.classId);
        return `<tr class="clickable-row" data-id="${s.id}"><td>${i+1}</td><td><div class="user-cell">${renderAvatar(s.name, s.photoURL, 'avatar-xs')}<span class="student-link" style="color:var(--primary-light); font-weight:600;">${escapeHTML(s.name||'')}</span></div></td><td>${cls?.name||'—'}</td><td>${s.gender==='male'?'👦':'👧'}</td><td>${s.email||'—'}</td><td><button class="btn btn-sm btn-outline transfer-student" data-id="${s.id}" title="${state.lang==='ar'?'نقل الطالب':'Transfer Student'}">🔄</button> <button class="btn btn-sm btn-outline edit-student" data-id="${s.id}">✏️</button> <button class="btn btn-sm btn-danger delete-student" data-id="${s.id}">🗑️</button></td></tr>`;
      }).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`;
      
      // Re-attach events for the new rows
      tbody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          showStudentCardModal(row.dataset.id);
        });
      });
      tbody.querySelectorAll('.edit-student').forEach(btn => btn.addEventListener('click', () => {
        const student = state.students.find(s => s.id === btn.dataset.id);
        if (student) showStudentForm(student);
      }));
      tbody.querySelectorAll('.transfer-student').forEach(btn => btn.addEventListener('click', () => {
        const student = state.students.find(s => s.id === btn.dataset.id);
        if (student) showTransferModal(student);
      }));
      tbody.querySelectorAll('.delete-student').forEach(btn => btn.addEventListener('click', () => {
        showConfirm(t('delete'), t('confirmDelete'), async () => {
          try {
            await deleteDoc(doc(db, 'students', btn.dataset.id));
            showToast(t('deletedSuccess'), 'success');
          } catch(e) { showToast(t('errorOccurred'), 'error'); }
        });
      }));
    }
  });
}

function showTransferModal(student) {
  const currentClass = state.classes.find(c => c.id === student.classId);
  showModal(state.lang === 'ar' ? 'نقل طالب' : 'Transfer Student', `
    <form id="transfer-form" class="form-grid">
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'الطالب' : 'Student'}</label>
        <input type="text" class="form-input" value="${student.name}" disabled>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'الصف الحالي' : 'Current Level'}</label>
        <input type="text" class="form-input" value="${currentClass?.name || '—'}" disabled>
      </div>
      <div class="form-group">
        <label>${state.lang === 'ar' ? 'النقل إلى' : 'Transfer To'}</label>
        <select id="tr-new-class" class="form-select" required>
          <option value="">${state.lang === 'ar' ? 'اختر الصف الجديد...' : 'Select new level...'}</option>
          ${state.classes.filter(c => c.id !== student.classId).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'سبب النقل' : 'Transfer Reason'}</label>
        <textarea id="tr-reason" class="form-input" placeholder="${state.lang === 'ar' ? 'أدخل السبب هنا...' : 'Enter reason here...'}"></textarea>
      </div>
      <div class="form-actions" style="grid-column: 1 / -1;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${state.lang === 'ar' ? 'إكمال النقل' : 'Complete Transfer'}</button>
      </div>
    </form>
  `);

  document.getElementById('transfer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newClassId = document.getElementById('tr-new-class').value;
    const reason = document.getElementById('tr-reason').value.trim();
    const newClass = state.classes.find(c => c.id === newClassId);

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      // 1. Log the transfer
      await addDoc(collection(db, 'transfers'), {
        studentId: student.id,
        fromClassId: student.classId || null,
        fromClassName: currentClass?.name || '—',
        toClassId: newClassId,
        toClassName: newClass?.name || '—',
        reason: reason,
        date: new Date().toISOString(),
        by: state.user.email
      });

      // 2. Update student record
      await updateDoc(doc(db, 'students', student.id), {
        classId: newClassId,
        updatedAt: new Date().toISOString()
      });

      closeModal();
      showToast(state.lang === 'ar' ? 'تم نقل الطالب بنجاح' : 'Student transferred successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = state.lang === 'ar' ? 'إكمال النقل' : 'Complete Transfer';
    }
  });
}

function showStudentForm(student = null) {
  const isEdit = !!student;
  const title = isEdit ? (state.lang === 'ar' ? 'تعديل طالب' : 'Edit Student') : (state.lang === 'ar' ? 'إضافة طالب' : 'Add Student');
  showModal(title, `
    <form id="student-form" class="form-grid">
      <div class="form-group"><label>${t('fullName')}</label><input type="text" id="sf-name" class="form-input" value="${student?.name || ''}" required></div>
      <div class="form-group"><label>${t('email')}</label><input type="email" id="sf-email" class="form-input" value="${student?.email || ''}"></div>
      ${!isEdit ? `<div class="form-group"><label>${state.lang === 'ar' ? 'كلمة المرور' : 'Password'}</label><input type="text" id="sf-password" class="form-input" value="123456"></div>` : ''}
      <div class="form-group"><label>${state.lang === 'ar' ? 'الجنس' : 'Gender'}</label>
        <select id="sf-gender" class="form-select"><option value="male" ${student?.gender === 'male' ? 'selected' : ''}>${state.lang === 'ar' ? 'ذكر' : 'Male'}</option><option value="female" ${student?.gender === 'female' ? 'selected' : ''}>${state.lang === 'ar' ? 'أنثى' : 'Female'}</option></select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الصف' : 'Level'}</label>
        <select id="sf-class" class="form-select"><option value="">—</option>${state.classes.map(c => `<option value="${c.id}" ${student?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label><input type="date" id="sf-dob" class="form-input" value="${student?.dob || ''}"></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الهاتف' : 'Phone'}</label><input type="tel" id="sf-phone" class="form-input" value="${student?.phone || ''}"></div>
      <div class="form-group full-width"><label>${state.lang === 'ar' ? 'الصورة الشخصية' : 'Profile Photo'}</label><input type="file" id="sf-photo" class="form-input" accept="image/*"></div>
      <div class="form-group full-width">
        <label>${state.lang === 'ar' ? 'ولي الأمر' : 'Parent'}</label>
        <select id="sf-parent-select" class="form-select">
          ${student ? `<option value="${student.parentId}">${state.parents.find(p => p.id === student.parentId)?.name || 'Unknown'}</option>` : ''}
          ${!student ? `<option value="new">${state.lang === 'ar' ? '+ إنشاء ولي أمر جديد' : '+ Create New Parent'}</option>` : ''}
          ${(!student ? state.parents : []).map(p => `<option value="${p.id}">${p.name} (${p.email})</option>`).join('')}
        </select>
      </div>
      
      <div id="new-parent-fields" class="${student ? 'hidden' : 'form-grid full-width'}" style="background: rgba(0,0,0,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; grid-column: 1 / -1;">
        <h4 style="grid-column: 1 / -1; margin-bottom: 0.5rem; color: var(--primary);">${state.lang === 'ar' ? 'بيانات ولي الأمر الجديد' : 'New Parent Details'}</h4>
        <div class="form-group"><label>${t('fullName')}</label><input type="text" id="sf-parent-name" class="form-input"></div>
        <div class="form-group"><label>${t('email')}</label><input type="email" id="sf-parent-email" class="form-input"></div>
        <div class="form-group"><label>${state.lang === 'ar' ? 'كلمة المرور' : 'Password'}</label><input type="text" id="sf-parent-pwd" class="form-input" value="123456"></div>
        <div class="form-group"><label>${state.lang === 'ar' ? 'الهاتف' : 'Phone'}</label><input type="tel" id="sf-parent-phone" class="form-input"></div>
      </div>

      <div class="form-actions" style="grid-column: 1 / -1;"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>
  `);
  
  if (!isEdit) {
    document.getElementById('sf-parent-select')?.addEventListener('change', (e) => {
      document.getElementById('new-parent-fields').style.display = e.target.value === 'new' ? 'grid' : 'none';
      const isNew = e.target.value === 'new';
      document.getElementById('sf-parent-name').required = isNew;
      document.getElementById('sf-parent-email').required = isNew;
      document.getElementById('sf-parent-pwd').required = isNew;
    });
    // Trigger to set initial required state
    document.getElementById('sf-parent-select').dispatchEvent(new Event('change'));
  }
  document.getElementById('student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      let finalParentId = student?.parentId || null;
      
      if (!isEdit) {
        const parentSelect = document.getElementById('sf-parent-select').value;
        if (parentSelect === 'new') {
          // Create new parent account
          const pEmail = document.getElementById('sf-parent-email').value.trim();
          const pPwd = document.getElementById('sf-parent-pwd').value;
          const pName = document.getElementById('sf-parent-name').value.trim();
          const pPhone = document.getElementById('sf-parent-phone').value.trim();
          
          finalParentId = await adminCreateUser(pEmail, pPwd, 'parent', pName);
          await setDoc(doc(db, 'parents', finalParentId), {
            uid: finalParentId, id: finalParentId, name: pName, email: pEmail, phone: pPhone, role: 'parent', studentIds: [], createdAt: new Date().toISOString()
          });
        } else {
          finalParentId = parentSelect;
        }
      }

      const data = {
        name: document.getElementById('sf-name').value.trim(),
        email: document.getElementById('sf-email').value.trim(),
        gender: document.getElementById('sf-gender').value,
        classId: document.getElementById('sf-class').value,
        dob: document.getElementById('sf-dob').value,
        phone: document.getElementById('sf-phone').value.trim(),
        parentId: finalParentId,
        updatedAt: new Date().toISOString()
      };

      const photoFile = document.getElementById('sf-photo').files[0];
      if (photoFile) {
        showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
        data.photoURL = await uploadFile(photoFile, 'students/photos');
      }

      if (isEdit) {
        await updateDoc(doc(db, 'students', student.id), data);
        Object.assign(student, data);
      } else {
        data.createdAt = new Date().toISOString();
        let studentId = null;
        if (data.email) {
          const password = document.getElementById('sf-password').value || '123456';
          studentId = await adminCreateUser(data.email, password, 'student', data.name);
          await setDoc(doc(db, 'students', studentId), { ...data, uid: studentId, id: studentId });
        } else {
          const studentRef = await addDoc(collection(db, 'students'), data);
          studentId = studentRef.id;
        }
        if (finalParentId && studentId) {
          await updateDoc(doc(db, 'parents', finalParentId), {
            studentIds: arrayUnion(studentId),
            updatedAt: new Date().toISOString()
          }).catch(() => {});
        }
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch(err) {
      console.error(err);
      showToast(err.code || t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}

// ========================= EXCEL / CSV IMPORT =========================
function showImportModal() {
  const isAr = state.lang === 'ar';

  // Expected columns (flexible matching)
  const REQUIRED_COLS = isAr
    ? ['الاسم']
    : ['name'];
  const OPTIONAL_COLS = isAr
    ? ['البريد الإلكتروني', 'الجنس', 'الصف', 'الهاتف', 'رقم الهوية', 'ملاحظات']
    : ['email', 'gender', 'grade', 'phone', 'nationalId', 'notes'];

  const templateCols  = isAr
    ? ['الاسم', 'البريد الإلكتروني', 'الجنس', 'الصف', 'الهاتف']
    : ['name', 'email', 'gender', 'grade', 'phone'];

  showModal(
    isAr ? '📥 استيراد طلاب من Excel / CSV' : '📥 Import Students from Excel / CSV',
    `
    <div class="import-modal">
      <p class="text-muted" style="margin-bottom:1rem;font-size:.88rem">
        ${isAr
          ? `قم بتحميل ملف Excel أو CSV يحتوي على أعمدة: <strong>${templateCols.join('، ')}</strong>.`
          : `Upload an Excel or CSV file with columns: <strong>${templateCols.join(', ')}</strong>.`}
      </p>
      <div class="import-drop-zone" id="import-drop-zone">
        <span style="font-size:2rem">📂</span>
        <p>${isAr ? 'اسحب الملف هنا أو' : 'Drag file here or'}</p>
        <label class="btn btn-outline" style="cursor:pointer">
          ${isAr ? 'اختر ملفاً' : 'Choose File'}
          <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
        </label>
        <p class="text-muted" style="font-size:.78rem;margin-top:.25rem">.xlsx, .xls, .csv</p>
      </div>
      <div id="import-preview" class="hidden"></div>
      <div class="form-actions" style="margin-top:1rem">
        <button class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">
          ${isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button class="btn btn-primary hidden" id="import-confirm-btn">
          ${isAr ? '✅ استيراد' : '✅ Import'}
        </button>
      </div>
    </div>`,
    { wide: true }
  );

  let parsedRows = [];

  // ── Load SheetJS dynamically ──────────────────────────────────────────────
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload  = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error('Failed to load SheetJS'));
      document.head.appendChild(s);
    });
  }

  // ── Normalise column names (case-insensitive, trim) ──────────────────────
  function normalizeKey(k) { return (k || '').toString().trim().toLowerCase(); }

  const COL_MAP_EN = {
    name: ['name', 'full name', 'student name', 'الاسم'],
    email: ['email', 'e-mail', 'البريد', 'البريد الإلكتروني'],
    gender: ['gender', 'sex', 'الجنس'],
    grade: ['grade', 'class', 'level', 'الصف', 'الفصل'],
    phone: ['phone', 'mobile', 'tel', 'الهاتف', 'الجوال'],
    nationalId: ['nationalid', 'national id', 'id', 'رقم الهوية'],
    notes: ['notes', 'note', 'remarks', 'ملاحظات'],
  };

  function mapRow(rawRow) {
    const mapped = {};
    const keys = Object.keys(rawRow).map(normalizeKey);
    for (const [field, aliases] of Object.entries(COL_MAP_EN)) {
      const match = Object.keys(rawRow).find(k => aliases.includes(normalizeKey(k)));
      if (match !== undefined) mapped[field] = (rawRow[match] || '').toString().trim();
    }
    return mapped;
  }

  // ── Render preview table ──────────────────────────────────────────────────
  function renderPreview(rows) {
    const preview = document.getElementById('import-preview');
    const confirmBtn = document.getElementById('import-confirm-btn');
    if (!preview) return;

    if (!rows.length) {
      preview.innerHTML = `<p class="text-muted text-center">${isAr ? 'لم يتم العثور على بيانات في الملف' : 'No data found in file'}</p>`;
      preview.classList.remove('hidden');
      return;
    }

    const validRows   = rows.filter(r => r.name);
    const invalidRows = rows.length - validRows.length;

    preview.innerHTML = `
      <div style="margin:.75rem 0;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <span class="badge badge-success">${isAr ? `${validRows.length} سجل صالح` : `${validRows.length} valid records`}</span>
        ${invalidRows > 0 ? `<span class="badge badge-warning">${isAr ? `${invalidRows} سجل ناقص (بدون اسم)` : `${invalidRows} skipped (no name)`}</span>` : ''}
      </div>
      <div class="table-responsive" style="max-height:220px;overflow-y:auto">
        <table class="data-table">
          <thead><tr>
            <th>#</th>
            <th>${isAr?'الاسم':'Name'}</th>
            <th>${isAr?'البريد':'Email'}</th>
            <th>${isAr?'الجنس':'Gender'}</th>
            <th>${isAr?'الصف':'Grade'}</th>
            <th>${isAr?'الحالة':'Status'}</th>
          </tr></thead>
          <tbody>
            ${validRows.slice(0, 50).map((r, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${escapeHTML(r.name)}</td>
                <td>${escapeHTML(r.email || '—')}</td>
                <td>${r.gender || '—'}</td>
                <td>${escapeHTML(r.grade || '—')}</td>
                <td><span class="badge badge-success">✓</span></td>
              </tr>`).join('')}
            ${validRows.length > 50 ? `<tr><td colspan="6" class="text-center text-muted">... ${isAr?`و ${validRows.length-50} آخرين`:`and ${validRows.length-50} more`}</td></tr>` : ''}
          </tbody>
        </table>
      </div>`;
    preview.classList.remove('hidden');

    if (validRows.length > 0) confirmBtn?.classList.remove('hidden');
    parsedRows = validRows;
  }

  // ── Parse file with SheetJS ───────────────────────────────────────────────
  async function parseFile(file) {
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone) dropZone.innerHTML = `<span class="spinner-sm"></span> ${isAr?'جاري القراءة...':'Reading file...'}`;
    try {
      const XLSX = await loadXLSX();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const rows = raw.map(mapRow);
      renderPreview(rows);
    } catch(err) {
      console.error('[Import]', err);
      showToast(isAr ? 'تعذر قراءة الملف' : 'Could not read file', 'error');
    }
  }

  // ── File input ─────────────────────────────────────────────────────────────
  document.getElementById('import-file-input')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  });

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const dropZone = document.getElementById('import-drop-zone');
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-active'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drop-active');
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  });

  // ── Confirm import ─────────────────────────────────────────────────────────
  document.getElementById('import-confirm-btn')?.addEventListener('click', async () => {
    if (!parsedRows.length) return;
    const btn = document.getElementById('import-confirm-btn');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm"></span> ${isAr?'جاري الاستيراد...':'Importing...'}`;

    let successCount = 0, errorCount = 0;
    for (const row of parsedRows) {
      try {
        const data = {
          name:       row.name,
          email:      row.email      || '',
          gender:     (row.gender    || '').toLowerCase().includes('f') || row.gender === 'أنثى' ? 'female' : 'male',
          grade:      row.grade      || '',
          phone:      row.phone      || '',
          nationalId: row.nationalId || '',
          notes:      row.notes      || '',
          status:     'active',
          createdAt:  new Date().toISOString(),
          importedAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'students'), data);
        successCount++;
      } catch(e) {
        console.error('[Import] row failed:', row, e);
        errorCount++;
      }
    }

    btn.disabled = false;
    btn.innerHTML = oldHtml;
    closeModal();
    if (successCount > 0)
      showToast(isAr ? `✅ تم استيراد ${successCount} طالب بنجاح` : `✅ ${successCount} students imported`, 'success');
    if (errorCount > 0)
      showToast(isAr ? `⚠️ فشل استيراد ${errorCount} سجل` : `⚠️ ${errorCount} records failed`, 'warning');
  });
}
