import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from '../firebase-config.js';
import { adminCreateUser } from '../auth.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML, renderAvatar } from '../ui.js';
import { uploadFile } from '../services/uploadService.js';

export function renderTeachers() {
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('teachers')}</h2><button class="btn btn-primary" id="add-teacher-btn">+ ${t('add')}</button></div>
    <div class="filter-bar glass-card"><input type="text" id="teacher-search" class="form-input" placeholder="🔍 ${t('search')}..."></div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="teachers-table"><thead><tr><th>#</th><th>${t('fullName')}</th><th>${state.lang==='ar'?'المواد':'Subjects'}</th><th>${t('email')}</th><th>${state.lang==='ar'?'الهاتف':'Phone'}</th><th>${state.lang==='ar'?'إجراءات':'Actions'}</th></tr></thead>
      <tbody>${state.teachers.map((tc, i) => `<tr class="clickable-row teacher-row" data-id="${tc.id}"><td>${i+1}</td><td><div class="user-cell">${renderAvatar(tc.name, tc.photoURL, 'avatar-xs')}${escapeHTML(tc.name||'')}</div></td><td>${(tc.subjects||[]).join(', ')||'—'}</td><td>${tc.email||'—'}</td><td>${tc.phone||'—'}</td><td><button class="btn btn-sm btn-outline edit-teacher" data-id="${tc.id}">✏️</button> <button class="btn btn-sm btn-danger delete-teacher" data-id="${tc.id}">🗑️</button></td></tr>`).join('')||`<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table>
    </div>
  </div>`;
}

export function attachTeacherEvents() {
  document.getElementById('add-teacher-btn')?.addEventListener('click', () => showTeacherForm());
  
  // Row Click for Profile
  document.querySelectorAll('.teacher-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // Don't trigger if clicking edit/delete buttons
      showTeacherCard(row.dataset.id);
    });
  });

  document.querySelectorAll('.edit-teacher').forEach(b => b.addEventListener('click', () => { const tc = state.teachers.find(x => x.id === b.dataset.id); if(tc) showTeacherForm(tc); }));
  document.querySelectorAll('.delete-teacher').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => { try { await deleteDoc(doc(db,'teachers',b.dataset.id)); showToast(t('deletedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); } });
  }));
  document.getElementById('teacher-search')?.addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    document.querySelectorAll('#teachers-table tbody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none');
  });
}

async function showTeacherCard(teacherId) {
    const { getTeacherDashboardHTML } = await import('./teacherProfile.js');
    showModal(state.lang === 'ar' ? 'بطاقة المعلم' : 'Teacher Card', getTeacherDashboardHTML(teacherId), { wide: true });
}


export function showTeacherForm(teacher = null) {
  const isEdit = !!teacher;
  let selectedSubjects = teacher?.subjects || [];
  let selectedClasses = isEdit ? state.classes.filter(c => c.teacherId === teacher.id).map(c => c.id) : [];

  const updateSubjectTags = () => {
    const container = document.getElementById('selected-subjects-tags');
    if (!container) return;
    container.innerHTML = selectedSubjects.map(s => `
      <div class="tag-chip animate-in">
        <span>${s}</span>
        <span class="tag-remove" data-val="${s}">&times;</span>
      </div>
    `).join('');
    
    // Attach remove events
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.onclick = () => {
        selectedSubjects = selectedSubjects.filter(v => v !== btn.dataset.val);
        updateSubjectTags();
      };
    });
  };

  const updateClassTags = () => {
    const container = document.getElementById('selected-classes-tags');
    if (!container) return;
    container.innerHTML = selectedClasses.map(cid => {
      const cls = state.classes.find(c => c.id === cid);
      return `
        <div class="tag-chip animate-in gradient-purple" style="color: white;">
          <span>${cls?.name || cid}</span>
          <span class="tag-remove" data-val="${cid}">&times;</span>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.onclick = () => {
        selectedClasses = selectedClasses.filter(v => v !== btn.dataset.val);
        updateClassTags();
      };
    });
  };

  showModal(isEdit ? (state.lang==='ar'?'تعديل معلم':'Edit Teacher') : (state.lang==='ar'?'إضافة معلم':'Add Teacher'), `
    <form id="teacher-form" class="form-grid">
      <div class="form-group"><label>${t('fullName')}</label><input type="text" id="tf-name" class="form-input" value="${teacher?.name||''}" required></div>
      <div class="form-group"><label>${t('email')}</label><input type="email" id="tf-email" class="form-input" value="${teacher?.email||''}" required></div>
      ${!isEdit ? `<div class="form-group"><label>${state.lang==='ar'?'كلمة المرور':'Password'}</label><input type="text" id="tf-password" class="form-input" value="123456" required></div>` : ''}
      <div class="form-group"><label>${state.lang==='ar'?'الهاتف':'Phone'}</label><input type="tel" id="tf-phone" class="form-input" value="${teacher?.phone||''}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'المؤهل العلمي':'Qualification'}</label><input type="text" id="tf-qualification" class="form-input" value="${teacher?.qualification||''}" placeholder="${state.lang==='ar'?'مثلاً: بكالوريوس رياضيات':'e.g. BS Mathematics'}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'الراتب الأساسي':'Base Salary'}</label><input type="number" id="tf-salary" class="form-input" value="${teacher?.baseSalary||''}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'الصورة الشخصية':'Profile Photo'}</label><input type="file" id="tf-photo" class="form-input" accept="image/*"></div>
      
      <div class="form-group full-width">
        <label>${state.lang==='ar'?'المواد الدراسية':'Subjects'}</label>
        <div class="multi-select-container">
          <div id="selected-subjects-tags" class="multi-select-tags"></div>
          <select id="tf-subjects-select" class="form-select">
            <option value="">${state.lang==='ar'?'اختر مادة لإضافتها...':'Select a subject to add...'}</option>
            ${state.subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group full-width">
        <label>${state.lang==='ar'?'الصفوف المسندة':'Assigned Classes'}</label>
        <div class="multi-select-container">
          <div id="selected-classes-tags" class="multi-select-tags"></div>
          <select id="tf-classes-select" class="form-select">
            <option value="">${state.lang==='ar'?'اختر صفاً لإسناده...':'Select a class to assign...'}</option>
            ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);

  // Initial tags
  updateSubjectTags();
  updateClassTags();

  // Add subject listener
  document.getElementById('tf-subjects-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && !selectedSubjects.includes(val)) {
      selectedSubjects.push(val);
      updateSubjectTags();
    }
    e.target.value = '';
  });

  // Add class listener
  document.getElementById('tf-classes-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && !selectedClasses.includes(val)) {
      selectedClasses.push(val);
      updateClassTags();
    }
    e.target.value = '';
  });

  document.getElementById('teacher-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    const data = { 
      name: document.getElementById('tf-name').value.trim(), 
      email: document.getElementById('tf-email').value.trim(), 
      subjects: selectedSubjects, 
      phone: document.getElementById('tf-phone').value.trim(), 
      qualification: document.getElementById('tf-qualification').value.trim(),
      baseSalary: Number(document.getElementById('tf-salary').value) || 0,
      role: 'teacher', 
      updatedAt: new Date().toISOString() 
    };

    const photoFile = document.getElementById('tf-photo').files[0];
    if (photoFile) {
      showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
      data.photoURL = await uploadFile(photoFile, 'teachers/photos');
    }
    try { 
      let teacherId = teacher?.id;
      if(isEdit) {
        await updateDoc(doc(db,'teachers',teacher.id),data); 
      } else { 
        data.createdAt=new Date().toISOString(); 
        const password = document.getElementById('tf-password').value;
        const newUid = await adminCreateUser(data.email, password, 'teacher', data.name);
        await setDoc(doc(db, 'teachers', newUid), data);
        teacherId = newUid;
      } 

      // Sync Classes
      const batchUpdates = [];
      state.classes.forEach(cls => {
        const isSelected = selectedClasses.includes(cls.id);
        const currentlyHasMe = cls.teacherId === teacherId;

        if (isSelected && !currentlyHasMe) {
          batchUpdates.push(updateDoc(doc(db, 'classes', cls.id), { teacherId: teacherId }));
        } else if (!isSelected && currentlyHasMe) {
          batchUpdates.push(updateDoc(doc(db, 'classes', cls.id), { teacherId: "" }));
        }
      });
      if (batchUpdates.length > 0) await Promise.all(batchUpdates);

      closeModal(); 
      showToast(t('savedSuccess'),'success'); 
      if (window.onTeacherUpdated) window.onTeacherUpdated(teacherId);
    } catch(err) { 
      console.error(err);
      showToast(err.code || t('errorOccurred'),'error'); 
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
}
