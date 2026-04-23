import { state, t } from '../state.js';
import { db, collection, getDocs, query, where, onSnapshot } from '../firebase-config.js';
import { formatCurrency } from '../ui.js';

export function renderDashboard() {
  const role = state.profile?.role || 'student';
  const renderers = { admin: renderAdminDash, teacher: renderTeacherDash, parent: renderParentDash, student: renderStudentDash };
  return (renderers[role] || renderStudentDash)();
}

function renderAdminDash() {
  const totalStudents = state.students.length;
  const totalTeachers = state.teachers.length;
  const totalClasses = state.classes.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = state.attendance.filter(a => a.date === todayStr);
  const presentCount = todayAtt.filter(a => a.status === 'present').length;
  const attRate = todayAtt.length > 0 ? Math.round((presentCount / todayAtt.length) * 100) : 0;
  const isPrivate = state.schoolType === 'private';
  const totalFees = state.fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = state.fees.reduce((s, f) => s + (f.paidAmount || 0), 0);

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً بك، ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card gradient-purple">
        <div class="stat-icon">👨‍🎓</div>
        <div class="stat-info"><h3>${totalStudents}</h3><p>${t('totalStudents')}</p></div>
      </div>
      <div class="stat-card gradient-cyan">
        <div class="stat-icon">👨‍🏫</div>
        <div class="stat-info"><h3>${totalTeachers}</h3><p>${t('totalTeachers')}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">🏫</div>
        <div class="stat-info"><h3>${totalClasses}</h3><p>${t('totalClasses')}</p></div>
      </div>
      <div class="stat-card gradient-amber">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${attRate}%</h3><p>${t('attendanceRate')}</p></div>
      </div>
    </div>
    ${isPrivate ? `
    <div class="stats-grid grid-2">
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${formatCurrency(paidFees)}</h3><p>${t('revenue')}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">⏰</div>
        <div class="stat-info"><h3>${formatCurrency(totalFees - paidFees)}</h3><p>${t('pending')}</p></div>
      </div>
    </div>` : ''}
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#students" class="quick-action-btn"><span>👨‍🎓</span><span>${state.lang === 'ar' ? 'إضافة طالب' : 'Add Student'}</span></a>
          <a href="#teachers" class="quick-action-btn"><span>👨‍🏫</span><span>${state.lang === 'ar' ? 'إضافة معلم' : 'Add Teacher'}</span></a>
          <a href="#attendance" class="quick-action-btn"><span>📋</span><span>${state.lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance'}</span></a>
          <a href="#announcements" class="quick-action-btn"><span>📢</span><span>${state.lang === 'ar' ? 'إعلان جديد' : 'New Announcement'}</span></a>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements'}</h3>
        <div class="recent-list">
          ${state.announcements.slice(0, 5).map(a => `
            <div class="recent-item">
              <span class="recent-icon">📢</span>
              <div><strong>${a.title}</strong><p class="text-muted text-sm">${a.body?.substring(0, 60) || ''}...</p></div>
            </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

function renderTeacherDash() {
  const myClasses = state.classes.filter(c => c.teacherId === state.profile?.uid || c.teacherIds?.includes(state.profile?.uid));
  const myStudentIds = myClasses.flatMap(c => c.studentIds || []);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = state.attendance.filter(a => a.date === todayStr && myStudentIds.includes(a.studentId));
  const presentCount = todayAtt.filter(a => a.status === 'present').length;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً أستاذ/ة ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple"><div class="stat-icon">🏫</div><div class="stat-info"><h3>${myClasses.length}</h3><p>${t('myClasses')}</p></div></div>
      <div class="stat-card gradient-cyan"><div class="stat-icon">👨‍🎓</div><div class="stat-info"><h3>${myStudentIds.length}</h3><p>${t('totalStudents')}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">✅</div><div class="stat-info"><h3>${presentCount}/${todayAtt.length || myStudentIds.length}</h3><p>${t('todayAttendance')}</p></div></div>
    </div>
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#attendance" class="quick-action-btn"><span>📋</span><span>${state.lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance'}</span></a>
          <a href="#grades" class="quick-action-btn"><span>📝</span><span>${state.lang === 'ar' ? 'إدخال درجات' : 'Enter Grades'}</span></a>
          <a href="#homework" class="quick-action-btn"><span>📚</span><span>${state.lang === 'ar' ? 'إضافة واجب' : 'Add Homework'}</span></a>
          <a href="#messages" class="quick-action-btn"><span>✉️</span><span>${state.lang === 'ar' ? 'إرسال رسالة' : 'Send Message'}</span></a>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'فصولي' : 'My Classes'}</h3>
        <div class="recent-list">
          ${myClasses.map(c => `<div class="recent-item"><span class="recent-icon">🏫</span><div><strong>${c.name}</strong><p class="text-muted text-sm">${(c.studentIds || []).length} ${t('students')}</p></div></div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

function renderParentDash() {
  const myStudents = state.students.filter(s => state.profile?.studentIds?.includes(s.id) || s.parentId === state.profile?.uid);
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple"><div class="stat-icon">👨‍👩‍👧</div><div class="stat-info"><h3>${myStudents.length}</h3><p>${t('myChildren')}</p></div></div>
      <div class="stat-card gradient-cyan"><div class="stat-icon">📢</div><div class="stat-info"><h3>${state.announcements.length}</h3><p>${t('announcements')}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">✉️</div><div class="stat-info"><h3>${state.messages.filter(m => m.to === state.profile?.uid && !m.read).length}</h3><p>${state.lang === 'ar' ? 'رسائل جديدة' : 'New Messages'}</p></div></div>
    </div>
    <div class="card glass-card">
      <h3 class="card-title">${t('myChildren')}</h3>
      <div class="children-grid">
        ${myStudents.map(s => {
          const cls = state.classes.find(c => c.id === s.classId);
          return `<div class="child-card glass-card"><div class="avatar avatar-lg gradient-purple">${s.name?.[0] || '?'}</div><h4>${s.name}</h4><p class="text-muted">${cls?.name || ''}</p><div class="child-actions"><a href="#grades" class="btn btn-sm btn-outline">📝 ${t('grades')}</a><a href="#attendance" class="btn btn-sm btn-outline">📋 ${t('attendance')}</a></div></div>`;
        }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
      </div>
    </div>
  </div>`;
}

function renderStudentDash() {
  const myRewards = state.rewards.filter(r => r.studentId === state.profile?.uid);
  const totalPoints = myRewards.reduce((s, r) => s + (r.points || 0), 0);
  const myHomework = state.homework.filter(h => {
    const cls = state.classes.find(c => c.studentIds?.includes(state.profile?.uid));
    return cls && h.classId === cls.id;
  });
  const pendingHw = myHomework.filter(h => !h.submissions?.find(s => s.studentId === state.profile?.uid));

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple"><div class="stat-icon">⭐</div><div class="stat-info"><h3>${totalPoints}</h3><p>${state.lang === 'ar' ? 'نقاطي' : 'My Points'}</p></div></div>
      <div class="stat-card gradient-cyan"><div class="stat-icon">📚</div><div class="stat-info"><h3>${pendingHw.length}</h3><p>${state.lang === 'ar' ? 'واجبات معلقة' : 'Pending Homework'}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">🏆</div><div class="stat-info"><h3>${myRewards.length}</h3><p>${t('myRewards')}</p></div></div>
    </div>
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#schedule" class="quick-action-btn"><span>📅</span><span>${t('mySchedule')}</span></a>
          <a href="#grades" class="quick-action-btn"><span>📝</span><span>${t('myGrades')}</span></a>
          <a href="#homework" class="quick-action-btn"><span>📚</span><span>${t('myHomework')}</span></a>
          <a href="#rewards" class="quick-action-btn"><span>⭐</span><span>${t('myRewards')}</span></a>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements'}</h3>
        <div class="recent-list">
          ${state.announcements.slice(0, 4).map(a => `<div class="recent-item"><span class="recent-icon">📢</span><div><strong>${a.title}</strong></div></div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

export function attachDashboardEvents() {}
