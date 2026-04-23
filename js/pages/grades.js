import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast } from '../ui.js';

export function renderGrades() {
  const role = state.profile?.role;
  const canEdit = role === 'admin' || role === 'teacher';
  // Filter grades based on role
  let grades = state.grades;
  if (role === 'student') grades = grades.filter(g => g.studentId === state.profile?.uid);
  if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    grades = grades.filter(g => kidIds.includes(g.studentId));
  }
  if (role === 'teacher') {
    const myClassIds = state.classes.filter(c => c.teacherId === state.profile?.uid).map(c => c.id);
    const myStudentIds = state.classes.filter(c => myClassIds.includes(c.id)).flatMap(c => c.studentIds || []);
    grades = grades.filter(g => myStudentIds.includes(g.studentId));
  }

  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('grades')}</h2>${canEdit ? `<button class="btn btn-primary" id="add-grade-btn">+ ${t('add')}</button>` : ''}</div>
    <div class="filter-bar glass-card">
      <input type="text" id="grade-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="grade-class-filter" class="form-select"><option value="">${state.lang==='ar'?'كل الفصول':'All Classes'}</option>${state.classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select>
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table" id="grades-table"><thead><tr><th>#</th><th>${state.lang==='ar'?'الطالب':'Student'}</th><th>${state.lang==='ar'?'المادة':'Subject'}</th><th>${state.lang==='ar'?'نوع الامتحان':'Exam Type'}</th><th>${state.lang==='ar'?'الدرجة':'Score'}</th><th>${state.lang==='ar'?'من':'Max'}</th>${canEdit?`<th>${state.lang==='ar'?'إجراءات':'Actions'}</th>`:''}</tr></thead>
      <tbody>${grades.map((g,i) => {
        const student = state.students.find(s=>s.id===g.studentId);
        const pct = g.maxScore > 0 ? Math.round((g.score/g.maxScore)*100) : 0;
        const color = pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'danger';
        return `<tr><td>${i+1}</td><td>${student?.name||'—'}</td><td>${g.subject||''}</td><td>${g.examType||''}</td><td><span class="badge badge-${color}">${g.score}</span></td><td>${g.maxScore}</td>${canEdit?`<td><button class="btn btn-sm btn-outline edit-grade" data-id="${g.id}">✏️</button> <button class="btn btn-sm btn-danger delete-grade" data-id="${g.id}">🗑️</button></td>`:''}</tr>`;
      }).join('')||`<tr><td colspan="${canEdit?7:6}" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table>
    </div>
  </div>`;
}

export function attachGradeEvents() {
  document.getElementById('add-grade-btn')?.addEventListener('click', () => showGradeForm());
  document.querySelectorAll('.edit-grade').forEach(b => b.addEventListener('click', () => { const g = state.grades.find(x=>x.id===b.dataset.id); if(g) showGradeForm(g); }));
  document.querySelectorAll('.delete-grade').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'grades',b.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
  }));
  document.getElementById('grade-search')?.addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    document.querySelectorAll('#grades-table tbody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none');
  });
}

function showGradeForm(grade = null) {
  const isEdit = !!grade;
  const role = state.profile?.role;
  const availableStudents = role === 'teacher' ? state.students.filter(s => {
    const myClasses = state.classes.filter(c => c.teacherId === state.profile?.uid);
    return myClasses.some(c => (c.studentIds||[]).includes(s.id));
  }) : state.students;

  showModal(isEdit ? (state.lang==='ar'?'تعديل درجة':'Edit Grade') : (state.lang==='ar'?'إضافة درجة':'Add Grade'), `
    <form id="grade-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'الطالب':'Student'}</label>
        <select id="gf-student" class="form-select" required>${availableStudents.map(s=>`<option value="${s.id}" ${grade?.studentId===s.id?'selected':''}>${s.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'المادة':'Subject'}</label><input type="text" id="gf-subject" class="form-input" value="${grade?.subject||''}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'نوع الامتحان':'Exam Type'}</label>
        <select id="gf-type" class="form-select"><option value="midterm" ${grade?.examType==='midterm'?'selected':''}>${state.lang==='ar'?'اختبار نصفي':'Midterm'}</option><option value="final" ${grade?.examType==='final'?'selected':''}>${state.lang==='ar'?'اختبار نهائي':'Final'}</option><option value="quiz" ${grade?.examType==='quiz'?'selected':''}>${state.lang==='ar'?'اختبار قصير':'Quiz'}</option><option value="homework" ${grade?.examType==='homework'?'selected':''}>${state.lang==='ar'?'واجب':'Homework'}</option></select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'الدرجة':'Score'}</label><input type="number" id="gf-score" class="form-input" value="${grade?.score||''}" required min="0"></div>
      <div class="form-group"><label>${state.lang==='ar'?'الدرجة الكاملة':'Max Score'}</label><input type="number" id="gf-max" class="form-input" value="${grade?.maxScore||100}" required min="1"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('grade-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { studentId: document.getElementById('gf-student').value, subject: document.getElementById('gf-subject').value.trim(), examType: document.getElementById('gf-type').value, score: Number(document.getElementById('gf-score').value), maxScore: Number(document.getElementById('gf-max').value), teacherId: state.profile?.uid, date: new Date().toISOString().split('T')[0] };
    try { if(isEdit) await updateDoc(doc(db,'grades',grade.id),data); else await addDoc(collection(db,'grades'),data); closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
