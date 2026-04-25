import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';

export function renderClasses() {
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('classes')}</h2><button class="btn btn-primary" id="add-class-btn">+ ${t('add')}</button></div>
    <div class="classes-grid">
      ${state.classes.map(c => {
        const teacher = state.teachers.find(tc => tc.id === c.teacherId);
        const studentCount = (c.studentIds || []).length;
        return `
        <div class="class-card glass-card">
          <div class="class-header gradient-purple"><h3>${c.name}</h3><span class="badge">${c.grade || ''} - ${c.section || ''}</span></div>
          <div class="class-body">
            <div class="class-stat"><span>👨‍🏫</span><span>${teacher?.name || '—'}</span></div>
            <div class="class-stat"><span>👨‍🎓</span><span>${studentCount} ${t('students')}</span></div>
          </div>
          <div class="class-actions">
            <button class="btn btn-sm btn-outline edit-class" data-id="${c.id}">✏️ ${t('edit')}</button>
            <button class="btn btn-sm btn-danger delete-class" data-id="${c.id}">🗑️</button>
          </div>
        </div>`;
      }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
    </div>
  </div>`;
}

export function attachClassEvents() {
  document.getElementById('add-class-btn')?.addEventListener('click', () => showClassForm());
  document.querySelectorAll('.edit-class').forEach(b => b.addEventListener('click', () => { const c = state.classes.find(x=>x.id===b.dataset.id); if(c) showClassForm(c); }));
  document.querySelectorAll('.delete-class').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'classes',b.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
  }));
}

function showClassForm(cls = null) {
  const isEdit = !!cls;
  showModal(isEdit ? (state.lang==='ar'?'تعديل الصف':'Edit Level') : (state.lang==='ar'?'إضافة صف':'Add Level'), `
    <form id="class-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'اسم الصف (كامل)':'Full Name'}</label><input type="text" id="cf-name" class="form-input" value="${cls?.name||''}" placeholder="${state.lang==='ar'?'مثلاً: الصف الأول - الشعبة الثانية':'e.g. First Level - Section 2'}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'الصف':'Level'}</label><input type="text" id="cf-grade" class="form-input" value="${cls?.grade||''}" placeholder="${state.lang==='ar'?'مثلاً: الصف الأول':'e.g. First Level'}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'الشعبة':'Section'}</label><input type="text" id="cf-section" class="form-input" value="${cls?.section||''}" placeholder="${state.lang==='ar'?'مثلاً: الشعبة الثانية':'e.g. Section 2'}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'المعلم المسؤول':'Teacher'}</label>
        <select id="cf-teacher" class="form-select"><option value="">—</option>${state.teachers.map(tc=>`<option value="${tc.id}" ${cls?.teacherId===tc.id?'selected':''}>${tc.name}</option>`).join('')}</select>
      </div>
      <div class="form-group full-width"><label>${state.lang==='ar'?'الطلاب':'Students'}</label>
        <select id="cf-students" class="form-select" multiple size="6">${state.students.map(s=>`<option value="${s.id}" ${(cls?.studentIds||[]).includes(s.id)?'selected':''}>${s.name}</option>`).join('')}</select>
      </div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('class-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const studentIds = Array.from(document.getElementById('cf-students').selectedOptions).map(o=>o.value);
    const data = { name: document.getElementById('cf-name').value.trim(), grade: document.getElementById('cf-grade').value.trim(), section: document.getElementById('cf-section').value.trim(), teacherId: document.getElementById('cf-teacher').value, studentIds, updatedAt: new Date().toISOString() };
    try { if(isEdit) await updateDoc(doc(db,'classes',cls.id),data); else { data.createdAt=new Date().toISOString(); await addDoc(collection(db,'classes'),data); } closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
