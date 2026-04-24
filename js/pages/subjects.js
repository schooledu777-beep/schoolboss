import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, storage, ref, uploadBytes, getDownloadURL } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';

export function renderSubjects() {
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('subjects')}</h2>
      <button class="btn btn-primary" id="add-subject-btn">+ ${t('add')}</button>
    </div>
    <div class="filter-bar glass-card">
      <input type="text" id="subject-search" class="form-input" placeholder="🔍 ${t('search')}...">
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="subjects-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${t('subjectName')}</th>
            <th>${t('subjectCode')}</th>
            <th>${t('description')}</th>
            <th>${state.lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody id="subjects-tbody">
          ${renderSubjectsTable(state.subjects || [])}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderSubjectsTable(subjects) {
  if (!subjects.length) return `<tr><td colspan="5" class="text-center py-4">${t('noData')}</td></tr>`;
  return subjects.map((sub, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <div class="fw-bold">${escapeHTML(sub.name)}</div>
        ${sub.isOnline ? `<span class="badge" style="background:var(--primary); font-size:10px;">🌐 ${state.lang === 'ar' ? 'أونلاين' : 'Online'}</span>` : ''}
      </td>
      <td><span class="badge" style="background: var(--primary); color: white;">${escapeHTML(sub.code || '-')}</span></td>
      <td><div class="text-truncate" style="max-width: 200px;" title="${escapeHTML(sub.description || '')}">${escapeHTML(sub.description || '-')}</div></td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit-subject text-primary" data-id="${sub.id}" title="${t('edit')}">✏️</button>
          <button class="btn-icon delete-subject text-danger" data-id="${sub.id}" title="${t('delete')}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

export function attachSubjectEvents() {
  // Setup search
  document.getElementById('subject-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = (state.subjects || []).filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.code || '').toLowerCase().includes(q)
    );
    const tbody = document.getElementById('subjects-tbody');
    if (tbody) tbody.innerHTML = renderSubjectsTable(filtered);
    attachActionEvents();
  });

  // Setup Add button
  document.getElementById('add-subject-btn')?.addEventListener('click', () => showSubjectForm());
  
  attachActionEvents();
}

function attachActionEvents() {
  document.querySelectorAll('.edit-subject').forEach(b => {
    b.addEventListener('click', () => {
      const sub = (state.subjects || []).find(x => x.id === b.dataset.id);
      if (sub) showSubjectForm(sub);
    });
  });

  document.querySelectorAll('.delete-subject').forEach(b => {
    b.addEventListener('click', () => {
      showConfirm(t('delete'), t('confirmDelete'), async () => {
        try {
          await deleteDoc(doc(db, 'subjects', b.dataset.id));
          showToast(t('deletedSuccess'), 'success');
        } catch(err) {
          console.error(err);
          showToast(t('errorOccurred'), 'error');
        }
      }, 'danger');
    });
  });
}

function showSubjectForm(subject = null) {
  const isEdit = !!subject;
  const title = isEdit ? t('edit') + ' ' + t('subjects') : t('add') + ' ' + t('subjects');
  
  showModal(`
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="btn-icon" id="modal-close-x">✕</button>
    </div>
    <form id="subject-form" class="modal-body">
      <div class="form-group full-width">
        <label>${t('subjectName')}</label>
        <input type="text" id="sf-name" class="form-input" value="${escapeHTML(subject?.name || '')}" required>
      </div>
      <div class="form-group full-width">
        <label>${t('subjectCode')}</label>
        <input type="text" id="sf-code" class="form-input" value="${escapeHTML(subject?.code || '')}" required placeholder="مثال: MATH101">
      </div>
      <div class="form-group full-width">
        <label>${t('description')}</label>
        <textarea id="sf-desc" class="form-input" rows="3">${escapeHTML(subject?.description || '')}</textarea>
      </div>

      <div class="form-group full-width">
        <label class="toggle-label" style="display:inline-flex; align-items:center; gap:10px; cursor:pointer;">
          <input type="checkbox" id="sf-online" ${subject?.isOnline ? 'checked' : ''} onchange="document.getElementById('materials-section').style.display=this.checked?'block':'none'">
          <span>${state.lang === 'ar' ? 'مادة أونلاين (تدعم رفع الملفات والملازم)' : 'Online Subject (Supports files)'}</span>
        </label>
      </div>
      
      <div id="materials-section" class="form-group full-width" style="display: ${subject?.isOnline ? 'block' : 'none'}; background: var(--bg-card); padding: 10px; border-radius: 8px;">
        <label>${state.lang === 'ar' ? 'رفع ملفات / ملازم المادة' : 'Upload Subject Files'}</label>
        <input type="file" id="sf-materials" class="form-input" multiple>
        
        <div id="existing-materials" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;">
          ${(subject?.materials || []).map((m, i) => `
            <div class="badge" style="display:inline-flex; align-items:center; gap:5px; background:var(--bg-body); border:1px solid var(--border-color);">
               <a href="${m.url}" target="_blank" style="color:var(--primary); text-decoration:none;">📄 ${escapeHTML(m.name)}</a>
               <button type="button" class="btn-icon text-danger" onclick="this.parentElement.remove();" data-url="${m.url}" data-name="${escapeHTML(m.name)}" style="font-size:12px; padding:2px;">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="form-actions full-width" style="margin-top: 1rem;">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>
  `);

  document.getElementById('subject-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      const existingMaterials = [];
      document.querySelectorAll('#existing-materials .badge button').forEach(b => {
        existingMaterials.push({ url: b.dataset.url, name: b.dataset.name });
      });

      const files = document.getElementById('sf-materials').files;
      const uploadedMaterials = [];
      
      if (files.length > 0) {
        btn.innerHTML = '<span>⏳</span><span>' + (state.lang === 'ar' ? 'جاري رفع الملفات...' : 'Uploading files...') + '</span>';
        for (let file of files) {
          try {
            const fileRef = ref(storage, `materials/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            uploadedMaterials.push({ name: file.name, url });
          } catch (uploadErr) {
            console.error('File upload failed', uploadErr);
            showToast(state.lang === 'ar' ? `فشل رفع ${file.name}` : `Failed to upload ${file.name}`, 'error');
          }
        }
      }

      const data = {
        name: document.getElementById('sf-name').value.trim(),
        code: document.getElementById('sf-code').value.trim().toUpperCase(),
        description: document.getElementById('sf-desc').value.trim(),
        isOnline: document.getElementById('sf-online').checked,
        materials: [...existingMaterials, ...uploadedMaterials],
        updatedAt: new Date().toISOString()
      };

      btn.innerHTML = '<span>⏳</span><span>' + (state.lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') + '</span>';

      if (isEdit) {
        await updateDoc(doc(db, 'subjects', subject.id), data);
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'subjects'), data);
      }
      
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch(err) {
      console.error(err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}
