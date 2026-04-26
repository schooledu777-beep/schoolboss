import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from '../firebase-config.js';
import { adminCreateUser } from '../auth.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';
import { showStudentCardModal } from './students.js';


export function renderParents() {
  const parents = state.parents || [];
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${state.lang === 'ar' ? 'أولياء الأمور' : 'Parents'}</h2>
      <button class="btn btn-primary" id="add-parent-btn">+ ${t('add')}</button>
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="parent-search" class="form-input" placeholder="🔍 ${t('search')}...">
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>${state.lang === 'ar' ? 'ولي الأمر' : 'Parent'}</th>
            <th>${state.lang === 'ar' ? 'الأبناء' : 'Children'}</th>
            <th>${state.lang === 'ar' ? 'التواصل' : 'Contact'}</th>
            <th>${state.lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody id="parents-list">
          ${parents.map(p => {
            const children = state.students.filter(s => s.parentId === p.id);
            return `
            <tr class="parent-row clickable" data-id="${p.id}">
              <td>
                <div class="user-info-cell">
                  <div class="avatar avatar-sm gradient-orange">${(p.name || '?')[0]}</div>
                  <div class="user-info-text">
                    <div class="font-bold">${escapeHTML(p.name || '')}</div>
                    <div class="text-xs text-muted">${p.email}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="children-badges">
                  ${children.map(s => `<span class="badge badge-outline-purple" title="${s.name}">${s.name.split(' ')[0]}</span>`).join('') || '—'}
                </div>
              </td>
              <td>
                <div class="text-sm">${p.phone || '—'}</div>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-icon edit-parent" data-id="${p.id}" title="${t('edit')}">✏️</button>
                  <button class="btn btn-icon btn-danger delete-parent" data-id="${p.id}" title="${t('delete')}">🗑️</button>
                </div>
              </td>
            </tr>`;
          }).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachParentEvents() {
  document.getElementById('add-parent-btn')?.addEventListener('click', () => showParentForm());

  document.querySelectorAll('.parent-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      window.location.hash = `#parent-profile?id=${row.dataset.id}`;
    });
  });

  document.querySelectorAll('.edit-parent').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const p = (state.parents || []).find(x => x.id === b.dataset.id);
    if(p) showParentForm(p);
  }));

  document.querySelectorAll('.delete-parent').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try {
        await deleteDoc(doc(db,'parents',b.dataset.id));
        showToast(t('deletedSuccess'),'success');
      } catch(e) { showToast(t('errorOccurred'),'error'); }
    });
  }));

  document.getElementById('parent-search')?.addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    document.querySelectorAll('.parent-row').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(v) ? '' : 'none';
    });
  });
}

export function showParentDetailModal(parentId) {
  const p = state.parents.find(x => x.id === parentId);
  if (!p) return;

  const children = state.students.filter(s => s.parentId === parentId);

  showModal(state.lang === 'ar' ? 'تفاصيل ولي الأمر' : 'Parent Details', `
    <div class="parent-detail-container">
      <div class="parent-detail-header">
        <div class="avatar avatar-lg gradient-orange" style="width:80px; height:80px; font-size: 2rem;">${(p.name || '?')[0]}</div>
        <div class="parent-detail-title">
          <h3>${escapeHTML(p.name || '')}</h3>
          <p class="text-muted">${p.email || ''}</p>
        </div>
      </div>
      
      <div class="sp-section-card">
        <h4 class="sp-section-title"><span>📞</span> ${state.lang === 'ar' ? 'معلومات التواصل' : 'Contact Info'}</h4>
        <div class="sp-info-grid">
          <div class="sp-info-item">
            <div class="sp-info-content">
              <span class="sp-info-label">${t('email')}</span>
              <span class="sp-info-value">${p.email || '—'}</span>
            </div>
          </div>
          <div class="sp-info-item">
            <div class="sp-info-content">
              <span class="sp-info-label">${state.lang === 'ar' ? 'الهاتف' : 'Phone'}</span>
              <span class="sp-info-value">${p.phone || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title"><span>🎓</span> ${state.lang === 'ar' ? 'الأبناء المسجلون' : 'Registered Children'} (${children.length})</h4>
        <div class="children-list">
          ${children.map(s => {
            const cls = state.classes.find(c => c.id === s.classId);
            return `
            <a href="#" class="child-mini-card" onclick="event.preventDefault(); showStudentCardModal('${s.id}')">
              <div class="avatar avatar-sm gradient-purple">${(s.name || '?')[0]}</div>
              <div class="child-mini-info">
                <h4>${escapeHTML(s.name || '')}</h4>
                <p>${cls?.name || '—'}</p>
              </div>
            </a>`;
          }).join('') || `<p class="text-muted text-center" style="grid-column: 1/-1;">${state.lang === 'ar' ? 'لا يوجد أبناء مسجلون' : 'No registered children'}</p>`}
        </div>
      </div>
    </div>
  `, { wide: true });
}


function showParentForm(parent = null) {
  const isEdit = !!parent;
  showModal(isEdit ? (state.lang==='ar'?'تعديل ولي أمر':'Edit Parent') : (state.lang==='ar'?'إضافة ولي أمر':'Add Parent'), `
    <form id="parent-form" class="form-grid">
      <div class="form-group"><label>${t('fullName')}</label><input type="text" id="pf-name" class="form-input" value="${parent?.name||''}" required></div>
      <div class="form-group"><label>${t('email')}</label><input type="email" id="pf-email" class="form-input" value="${parent?.email||''}" required></div>
      ${!isEdit ? `<div class="form-group"><label>${state.lang==='ar'?'كلمة المرور':'Password'}</label><input type="text" id="pf-password" class="form-input" value="123456" required></div>` : ''}
      <div class="form-group"><label>${state.lang==='ar'?'الهاتف':'Phone'}</label><input type="tel" id="pf-phone" class="form-input" value="${parent?.phone||''}"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('parent-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    const data = { name: document.getElementById('pf-name').value.trim(), email: document.getElementById('pf-email').value.trim(), phone: document.getElementById('pf-phone').value.trim(), role: 'parent', updatedAt: new Date().toISOString() };
    try { 
      if(isEdit) {
        await updateDoc(doc(db,'parents',parent.id),data); 
      } else { 
        data.createdAt=new Date().toISOString(); 
        const password = document.getElementById('pf-password').value;
        const newUid = await adminCreateUser(data.email, password, 'parent', data.name);
        await setDoc(doc(db, 'parents', newUid), data);
      } 
      closeModal(); 
      showToast(t('savedSuccess'),'success'); 
    } catch(err) { 
      console.error(err);
      showToast(err.code || t('errorOccurred'),'error'); 
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}
