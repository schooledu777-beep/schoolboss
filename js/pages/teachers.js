import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';

export function renderTeachers() {
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('teachers')}</h2><button class="btn btn-primary" id="add-teacher-btn">+ ${t('add')}</button></div>
    <div class="filter-bar glass-card"><input type="text" id="teacher-search" class="form-input" placeholder="🔍 ${t('search')}..."></div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="teachers-table"><thead><tr><th>#</th><th>${t('fullName')}</th><th>${state.lang==='ar'?'المواد':'Subjects'}</th><th>${t('email')}</th><th>${state.lang==='ar'?'الهاتف':'Phone'}</th><th>${state.lang==='ar'?'إجراءات':'Actions'}</th></tr></thead>
      <tbody>${state.teachers.map((tc, i) => `<tr><td>${i+1}</td><td><div class="user-cell"><div class="avatar avatar-xs gradient-cyan">${(tc.name||'?')[0]}</div>${escapeHTML(tc.name||'')}</div></td><td>${(tc.subjects||[]).join(', ')||'—'}</td><td>${tc.email||'—'}</td><td>${tc.phone||'—'}</td><td><button class="btn btn-sm btn-outline edit-teacher" data-id="${tc.id}">✏️</button> <button class="btn btn-sm btn-danger delete-teacher" data-id="${tc.id}">🗑️</button></td></tr>`).join('')||`<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table>
    </div>
  </div>`;
}

export function attachTeacherEvents() {
  document.getElementById('add-teacher-btn')?.addEventListener('click', () => showTeacherForm());
  document.querySelectorAll('.edit-teacher').forEach(b => b.addEventListener('click', () => { const tc = state.teachers.find(x => x.id === b.dataset.id); if(tc) showTeacherForm(tc); }));
  document.querySelectorAll('.delete-teacher').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => { try { await deleteDoc(doc(db,'teachers',b.dataset.id)); showToast(t('deletedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); } });
  }));
  document.getElementById('teacher-search')?.addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    document.querySelectorAll('#teachers-table tbody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none');
  });
}

function showTeacherForm(teacher = null) {
  const isEdit = !!teacher;
  showModal(isEdit ? (state.lang==='ar'?'تعديل معلم':'Edit Teacher') : (state.lang==='ar'?'إضافة معلم':'Add Teacher'), `
    <form id="teacher-form" class="form-grid">
      <div class="form-group"><label>${t('fullName')}</label><input type="text" id="tf-name" class="form-input" value="${teacher?.name||''}" required></div>
      <div class="form-group"><label>${t('email')}</label><input type="email" id="tf-email" class="form-input" value="${teacher?.email||''}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'المواد':'Subjects'}</label><input type="text" id="tf-subjects" class="form-input" value="${(teacher?.subjects||[]).join(', ')}" placeholder="${state.lang==='ar'?'رياضيات, علوم, ...':'Math, Science, ...'}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'الهاتف':'Phone'}</label><input type="tel" id="tf-phone" class="form-input" value="${teacher?.phone||''}"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('teacher-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { name: document.getElementById('tf-name').value.trim(), email: document.getElementById('tf-email').value.trim(), subjects: document.getElementById('tf-subjects').value.split(',').map(s=>s.trim()).filter(Boolean), phone: document.getElementById('tf-phone').value.trim(), role: 'teacher', updatedAt: new Date().toISOString() };
    try { if(isEdit) await updateDoc(doc(db,'teachers',teacher.id),data); else { data.createdAt=new Date().toISOString(); await addDoc(collection(db,'teachers'),data); } closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
