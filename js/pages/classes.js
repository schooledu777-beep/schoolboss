import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';


export function renderClasses() {
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('classes')}</h2>
      <button class="btn btn-primary" id="add-class-btn">+ ${t('add')}</button>
    </div>
    
    <div class="classes-grid">
      ${state.classes.map(c => {
        const teacher = state.teachers.find(tc => tc.id === c.teacherId);
        const studentCount = (c.studentIds || []).length;
        const colorClass = ['gradient-purple', 'gradient-cyan', 'gradient-green', 'gradient-amber', 'gradient-red'][Math.floor(Math.random() * 5)];
        
        return `
        <div class="class-card glass-card">
          <div class="class-header ${colorClass}">
            <h3>${escapeHTML(c.name)}</h3>
            <span class="badge" style="background:rgba(255,255,255,0.2); color:#fff; border:none;">${c.grade || ''}</span>
          </div>
          <div class="class-body">
            <div class="class-stat">
              <span title="${state.lang==='ar'?'المعلم المسؤول':'Main Teacher'}">👨‍🏫</span>
              <span>${teacher?.name || (state.lang==='ar'?'غير محدد':'Not Assigned')}</span>
            </div>
            <div class="class-stat">
              <span title="${t('students')}">👨‍🎓</span>
              <span>${studentCount} ${t('students')}</span>
            </div>
            <div class="class-stat">
              <span title="${state.lang==='ar'?'الشعبة':'Section'}">🏫</span>
              <span>${c.section || '—'}</span>
            </div>
          </div>
          <div class="class-actions">
            <button class="btn btn-sm btn-outline edit-class" data-id="${c.id}">✏️</button>
            <button class="btn btn-sm btn-danger delete-class" data-id="${c.id}">🗑️</button>
          </div>
        </div>`;
      }).join('') || `
        <div class="full-width text-center py-5">
          <p class="text-muted">${t('noData')}</p>
        </div>
      `}
    </div>
  </div>`;
}

export function attachClassEvents() {
  document.getElementById('add-class-btn')?.addEventListener('click', () => showClassForm());
  document.querySelectorAll('.edit-class').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = state.classes.find(x => x.id === b.dataset.id);
    if (c) showClassForm(c);
  }));
  document.querySelectorAll('.delete-class').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try {
        await deleteDoc(doc(db, 'classes', b.dataset.id));
        showToast(t('deletedSuccess'), 'success');
      } catch (e) {
        showToast(t('errorOccurred'), 'error');
      }
    });
  }));
}

function showClassForm(cls = null) {
  const isEdit = !!cls;
  showModal(isEdit ? (state.lang==='ar'?'تعديل الصف':'Edit Level') : (state.lang==='ar'?'إضافة صف':'Add Level'), `
    <form id="class-form" class="form-grid">
      <div class="form-group full-width">
        <label>${state.lang==='ar'?'الصف':'Level/Grade'}</label>
        <input type="text" id="cf-grade" class="form-input" value="${cls?.grade||''}" placeholder="${state.lang==='ar'?'مثلاً: الصف الأول':'e.g. First Grade'}" required>
      </div>
      <div class="form-group full-width">
        <label>${state.lang==='ar'?'الشعبة':'Section'}</label>
        <input type="text" id="cf-section" class="form-input" value="${cls?.section||''}" placeholder="${state.lang==='ar'?'مثلاً: الشعبة الثانية':'e.g. Section 2'}" required>
      </div>
      
      <div class="form-group full-width">
        <label>${state.lang==='ar'?'الاسم المعروض':'Display Name'}</label>
        <input type="text" id="cf-name" class="form-input" value="${cls?.name||''}" placeholder="${state.lang==='ar'?'سيتم توليده تلقائياً...':'Will be generated automatically...'}" readonly>
      </div>

      <div class="form-group full-width">
        <label>${state.lang==='ar'?'المعلم المسؤول':'Teacher'}</label>
        <select id="cf-teacher" class="form-select">
          <option value="">—</option>
          ${state.teachers.map(tc => `<option value="${tc.id}" ${cls?.teacherId === tc.id ? 'selected' : ''}>${tc.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full-width">
        <label>${state.lang==='ar'?'اختيار الطلاب':'Select Students'}</label>
        <select id="cf-students" class="form-select" multiple size="6" style="height: 120px;">
          ${state.students.map(s => `<option value="${s.id}" ${(cls?.studentIds || []).includes(s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <small class="text-muted">${state.lang==='ar'?'استخدم Ctrl للاختيار المتعدد':'Use Ctrl for multi-select'}</small>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  const gradeInp = document.getElementById('cf-grade');
  const sectionInp = document.getElementById('cf-section');
  const nameInp = document.getElementById('cf-name');

  const updateName = () => {
    if (gradeInp.value || sectionInp.value) {
      nameInp.value = `${gradeInp.value} - ${sectionInp.value}`.trim().replace(/^ - | - $/g, '');
    }
  };

  gradeInp.addEventListener('input', updateName);
  sectionInp.addEventListener('input', updateName);

  document.getElementById('class-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    const studentIds = Array.from(document.getElementById('cf-students').selectedOptions).map(o => o.value);
    const data = {
      name: nameInp.value.trim(),
      grade: gradeInp.value.trim(),
      section: sectionInp.value.trim(),
      teacherId: document.getElementById('cf-teacher').value,
      studentIds,
      updatedAt: new Date().toISOString()
    };
    try {
      if (isEdit) await updateDoc(doc(db, 'classes', cls.id), data);
      else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'classes'), data);
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (e) {
      console.error(e);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false;
      btn.innerHTML = t('save');
    }
  });
}
