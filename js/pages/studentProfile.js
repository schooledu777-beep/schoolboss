import { state, t } from '../state.js';
import { db, doc, getDoc } from '../firebase-config.js';
import { escapeHTML } from '../ui.js';

export function renderStudentProfile() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const studentId = params.get('id');
  
  console.log('[StudentProfile] Loading ID:', studentId);
  const student = state.students.find(s => s.id === studentId);

  if (!student) {
    return `
    <div class="page-content animate-in">
      <div class="empty-state glass-card">
        <span class="empty-icon">🔍</span>
        <h3>${state.lang === 'ar' ? 'لم يتم العثور على الطالب' : 'Student Not Found'}</h3>
        <p class="text-muted">${state.lang === 'ar' ? 'تأكد من معرف الطالب أو أعد المحاولة لاحقاً' : 'Check student ID or try again later'}</p>
        <button class="btn btn-outline" onclick="window.history.back()" style="margin-top:1rem">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
      </div>
    </div>`;
  }

  const cls = state.classes.find(c => c.id === student.classId);
  const parent = state.parents.find(p => p.id === student.parentId);

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${state.lang === 'ar' ? 'ملف الطالب' : 'Student Profile'}</h2>
      <button class="btn btn-outline" onclick="window.history.back()">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
    </div>

    <div class="profile-layout">
      <div class="profile-sidebar glass-card">
        <div class="profile-header">
          <div class="avatar avatar-lg gradient-purple">${(student.name || '?')[0]}</div>
          <h3>${escapeHTML(student.name)}</h3>
          <p class="text-muted">${cls?.name || '—'}</p>
        </div>
        <div class="profile-info">
          <div class="info-item"><span class="icon">📧</span><div><p class="label">${t('email')}</p><p>${student.email || '—'}</p></div></div>
          <div class="info-item"><span class="icon">📞</span><div><p class="label">${state.lang === 'ar' ? 'الهاتف' : 'Phone'}</p><p>${student.phone || '—'}</p></div></div>
          <div class="info-item"><span class="icon">🎂</span><div><p class="label">${state.lang === 'ar' ? 'تاريخ الميلاد' : 'DOB'}</p><p>${student.dob || '—'}</p></div></div>
        </div>
      </div>

      <div class="profile-main">
        <div class="card glass-card">
          <h3 class="card-title">${state.lang === 'ar' ? 'بيانات ولي الأمر' : 'Parent Information'}</h3>
          ${parent ? `
            <div class="parent-info">
              <p><strong>${t('fullName')}:</strong> ${escapeHTML(parent.name)}</p>
              <p><strong>${t('email')}:</strong> ${parent.email}</p>
              <p><strong>${state.lang === 'ar' ? 'الهاتف' : 'Phone'}:</strong> ${parent.phone || '—'}</p>
            </div>
          ` : `<p class="text-muted">${state.lang === 'ar' ? 'غير مرتبط بولي أمر' : 'No parent linked'}</p>`}
        </div>

        <div class="card glass-card" style="margin-top: 1.5rem;">
          <h3 class="card-title">${state.lang === 'ar' ? 'الأداء الأكاديمي' : 'Academic Performance'}</h3>
          <div class="stats-grid grid-2">
            <div class="stat-card bg-light">
              <p class="label">${state.lang === 'ar' ? 'متوسط الدرجات' : 'Grade Average'}</p>
              <h3>85%</h3>
            </div>
            <div class="stat-card bg-light">
              <p class="label">${state.lang === 'ar' ? 'نسبة الحضور' : 'Attendance'}</p>
              <h3>92%</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <style>
    .profile-layout { display: grid; grid-template-columns: 300px 1fr; gap: 1.5rem; }
    .profile-header { text-align: center; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 1.5rem; }
    .avatar-lg { width: 100px; height: 100px; font-size: 2.5rem; margin: 0 auto 1rem; }
    .info-item { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .info-item .icon { font-size: 1.2rem; }
    .info-item .label { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
    .info-item p { margin: 0; }
    @media (max-width: 768px) {
      .profile-layout { grid-template-columns: 1fr; }
    }
  </style>
  `;
}

export function attachStudentProfileEvents() {}
