import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';

export function renderStudents() {
  const students = state.students;
  const searchId = 'student-search';
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('students')}</h2>
      <button class="btn btn-primary" id="add-student-btn">+ ${t('add')}</button>
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="${searchId}" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="student-class-filter" class="form-select">
        <option value="">${state.lang === 'ar' ? 'كل الفصول' : 'All Classes'}</option>
        ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="students-table">
        <thead><tr>
          <th>#</th><th>${t('fullName')}</th><th>${state.lang === 'ar' ? 'الفصل' : 'Class'}</th>
          <th>${state.lang === 'ar' ? 'الجنس' : 'Gender'}</th><th>${t('email')}</th>
          <th>${state.lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
        </tr></thead>
        <tbody>
          ${students.map((s, i) => {
            const cls = state.classes.find(c => c.id === s.classId);
            return `<tr>
              <td>${i + 1}</td><td><div class="user-cell"><div class="avatar avatar-xs gradient-purple">${(s.name || '?')[0]}</div>${escapeHTML(s.name || '')}</div></td>
              <td>${cls?.name || '—'}</td><td>${s.gender === 'male' ? '👦' : '👧'}</td><td>${s.email || '—'}</td>
              <td><button class="btn btn-sm btn-outline edit-student" data-id="${s.id}">✏️</button> <button class="btn btn-sm btn-danger delete-student" data-id="${s.id}">🗑️</button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachStudentEvents() {
  document.getElementById('add-student-btn')?.addEventListener('click', () => showStudentForm());
  document.querySelectorAll('.edit-student').forEach(btn => btn.addEventListener('click', () => {
    const student = state.students.find(s => s.id === btn.dataset.id);
    if (student) showStudentForm(student);
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
        return `<tr><td>${i+1}</td><td>${escapeHTML(s.name||'')}</td><td>${cls?.name||'—'}</td><td>${s.gender==='male'?'👦':'👧'}</td><td>${s.email||'—'}</td><td><button class="btn btn-sm btn-outline edit-student" data-id="${s.id}">✏️</button> <button class="btn btn-sm btn-danger delete-student" data-id="${s.id}">🗑️</button></td></tr>`;
      }).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`;
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
      <div class="form-group"><label>${state.lang === 'ar' ? 'الجنس' : 'Gender'}</label>
        <select id="sf-gender" class="form-select"><option value="male" ${student?.gender === 'male' ? 'selected' : ''}>${state.lang === 'ar' ? 'ذكر' : 'Male'}</option><option value="female" ${student?.gender === 'female' ? 'selected' : ''}>${state.lang === 'ar' ? 'أنثى' : 'Female'}</option></select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الفصل' : 'Class'}</label>
        <select id="sf-class" class="form-select"><option value="">—</option>${state.classes.map(c => `<option value="${c.id}" ${student?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label><input type="date" id="sf-dob" class="form-input" value="${student?.dob || ''}"></div>
      <div class="form-group"><label>${state.lang === 'ar' ? 'الهاتف' : 'Phone'}</label><input type="tel" id="sf-phone" class="form-input" value="${student?.phone || ''}"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>
  `);
  document.getElementById('student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('sf-name').value.trim(),
      email: document.getElementById('sf-email').value.trim(),
      gender: document.getElementById('sf-gender').value,
      classId: document.getElementById('sf-class').value,
      dob: document.getElementById('sf-dob').value,
      phone: document.getElementById('sf-phone').value.trim(),
      updatedAt: new Date().toISOString()
    };
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'students', student.id), data);
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'students'), data);
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch(e) { showToast(t('errorOccurred'), 'error'); }
  });
}
