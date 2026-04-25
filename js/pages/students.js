import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from '../firebase-config.js';
import { adminCreateUser } from '../auth.js';
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
              <td>${i + 1}</td><td><div class="user-cell"><div class="avatar avatar-xs gradient-purple">${(s.name || '?')[0]}</div><a href="#student-profile?id=${s.id}" class="student-link">${escapeHTML(s.name || '')}</a></div></td>
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
        return `<tr><td>${i+1}</td><td><a href="#student-profile?id=${s.id}" class="student-link">${escapeHTML(s.name||'')}</a></td><td>${cls?.name||'—'}</td><td>${s.gender==='male'?'👦':'👧'}</td><td>${s.email||'—'}</td><td><button class="btn btn-sm btn-outline edit-student" data-id="${s.id}">✏️</button> <button class="btn btn-sm btn-danger delete-student" data-id="${s.id}">🗑️</button></td></tr>`;
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
            name: pName, email: pEmail, phone: pPhone, role: 'parent', createdAt: new Date().toISOString()
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

      if (isEdit) {
        await updateDoc(doc(db, 'students', student.id), data);
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'students'), data);
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
