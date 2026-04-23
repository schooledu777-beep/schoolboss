import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';

export function renderParents() {
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('parents')}</h2><button class="btn btn-primary" id="add-parent-btn">+ ${t('add')}</button></div>
    <div class="filter-bar glass-card"><input type="text" id="parent-search" class="form-input" placeholder="🔍 ${t('search')}..."></div>
    <div class="table-responsive glass-card">
      <table class="data-table"><thead><tr><th>#</th><th>${t('fullName')}</th><th>${t('email')}</th><th>${state.lang==='ar'?'الهاتف':'Phone'}</th><th>${state.lang==='ar'?'الأبناء':'Children'}</th><th>${state.lang==='ar'?'إجراءات':'Actions'}</th></tr></thead>
      <tbody>${state.parents.map((p,i) => {
        const kids = state.students.filter(s => (p.studentIds||[]).includes(s.id) || s.parentId === p.id);
        return `<tr><td>${i+1}</td><td>${escapeHTML(p.name||'')}</td><td>${p.email||'—'}</td><td>${p.phone||'—'}</td><td>${kids.map(k=>k.name).join(', ')||'—'}</td><td><button class="btn btn-sm btn-outline edit-parent" data-id="${p.id}">✏️</button> <button class="btn btn-sm btn-danger delete-parent" data-id="${p.id}">🗑️</button></td></tr>`;
      }).join('')||`<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table>
    </div>
  </div>`;
}

export function attachParentEvents() {
  document.getElementById('add-parent-btn')?.addEventListener('click', () => showParentForm());
  document.querySelectorAll('.edit-parent').forEach(b => b.addEventListener('click', () => { const p = state.parents.find(x=>x.id===b.dataset.id); if(p) showParentForm(p); }));
  document.querySelectorAll('.delete-parent').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'parents',b.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
  }));
  document.getElementById('parent-search')?.addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    document.querySelectorAll('.data-table tbody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none');
  });
}

function showParentForm(parent = null) {
  const isEdit = !!parent;
  showModal(isEdit ? (state.lang==='ar'?'تعديل ولي أمر':'Edit Parent') : (state.lang==='ar'?'إضافة ولي أمر':'Add Parent'), `
    <form id="parent-form" class="form-grid">
      <div class="form-group"><label>${t('fullName')}</label><input type="text" id="pf-name" class="form-input" value="${parent?.name||''}" required></div>
      <div class="form-group"><label>${t('email')}</label><input type="email" id="pf-email" class="form-input" value="${parent?.email||''}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'الهاتف':'Phone'}</label><input type="tel" id="pf-phone" class="form-input" value="${parent?.phone||''}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'ربط بالطلاب':'Link Students'}</label>
        <select id="pf-students" class="form-select" multiple>${state.students.map(s=>`<option value="${s.id}" ${(parent?.studentIds||[]).includes(s.id)?'selected':''}>${s.name}</option>`).join('')}</select>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('parent-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const sel = document.getElementById('pf-students');
    const studentIds = Array.from(sel.selectedOptions).map(o=>o.value);
    const data = { name: document.getElementById('pf-name').value.trim(), email: document.getElementById('pf-email').value.trim(), phone: document.getElementById('pf-phone').value.trim(), studentIds, role:'parent', updatedAt: new Date().toISOString() };
    try { if(isEdit) await updateDoc(doc(db,'parents',parent.id),data); else { data.createdAt=new Date().toISOString(); await addDoc(collection(db,'parents'),data); } closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
