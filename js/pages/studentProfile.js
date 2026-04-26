import { state, t } from '../state.js';
import { db, doc, getDoc } from '../firebase-config.js';
import { escapeHTML, getInitials } from '../ui.js';

export function renderStudentProfile() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const studentId = params.get('id');
  
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

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${state.lang === 'ar' ? 'ملف الطالب' : 'Student Profile'}</h2>
      <button class="btn btn-outline" onclick="window.history.back()">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
    </div>
    <div class="glass-card" style="padding: 2rem;">
      ${getStudentDashboardHTML(studentId)}
    </div>
  </div>`;
}

function getStudentMetrics(studentId) {
    const student = state.students.find(s => s.id === studentId);
    
    // 1. GPA Calculation
    const studentGrades = state.grades.filter(g => g.studentId === studentId);
    let gpa = 0;
    if (studentGrades.length > 0) {
        const totalPct = studentGrades.reduce((sum, g) => {
            const pct = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0;
            return sum + pct;
        }, 0);
        gpa = Math.round(totalPct / studentGrades.length);
    }

    // 2. Attendance Calculation
    const studentAtt = state.attendance.filter(a => a.studentId === studentId);
    let attRate = 0;
    if (studentAtt.length > 0) {
        const presentCount = studentAtt.filter(a => a.status === 'present').length;
        attRate = Math.round((presentCount / studentAtt.length) * 100);
    }

    // 3. Upcoming Class Calculation
    const now = new Date();
    const dayIndex = now.getDay(); // 0-indexed (Sunday=0 in my days array)
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const studentClass = state.classes.find(c => (c.studentIds || []).includes(studentId));
    let nextClass = null;
    
    if (studentClass) {
        // Adjust dayIndex for my days array: Sunday is 0, but in state it might be different.
        // Let's assume 0=Sunday as per schedules logic.
        const classSchedules = state.schedules.filter(s => s.classId === studentClass.id && (s.dayOfWeek === dayIndex || s.dayIndex === dayIndex));
        const upcoming = classSchedules
            .map(s => {
                const ts = state.timeslots.find(t => t.id === s.timeslotId);
                return { ...s, timeslot: ts };
            })
            .filter(s => s.timeslot && s.timeslot.startTime > currentTime)
            .sort((a, b) => a.timeslot.startTime.localeCompare(b.timeslot.startTime));
        
        nextClass = upcoming[0] || null;
    }

    // 4. Homework count
    const studentHomework = state.homework.filter(h => h.classId === studentClass?.id);
    const pendingHw = studentHomework.filter(h => !h.submissions?.find(sub => sub.studentId === studentId));

    return { gpa, attRate, nextClass, pendingHwCount: pendingHw.length };
}

export function getStudentDashboardHTML(studentId, activeTab = 'overview') {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return '';

  const cls = state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(studentId));
  const parent = state.parents.find(p => p.id === student.parentId);
  const metrics = getStudentMetrics(studentId);
  
  const tabs = [
    { id: 'overview', label: state.lang === 'ar' ? 'نظرة عامة' : 'Overview', icon: '📊' },
    { id: 'schedule', label: state.lang === 'ar' ? 'الجدول الدراسي' : 'Schedule', icon: '📅' },
    { id: 'performance', label: state.lang === 'ar' ? 'الأداء الأكاديمي' : 'Performance', icon: '🏆' },
    { id: 'tasks', label: state.lang === 'ar' ? 'المهام والواجبات' : 'Tasks', icon: '📝' },
    { id: 'attendance', label: state.lang === 'ar' ? 'الحضور والغياب' : 'Attendance', icon: '📋' },
    { id: 'resources', label: state.lang === 'ar' ? 'الموارد التعليمية' : 'Resources', icon: '📚' },
    { id: 'notifications', label: state.lang === 'ar' ? 'الإشعارات' : 'Notifications', icon: '🔔' },
    { id: 'messages', label: state.lang === 'ar' ? 'الرسائل' : 'Messages', icon: '✉️' }
  ];

  const content = {
    overview: `
      <div class="sp-widgets-grid">
        <div class="sp-widget widget-blue">
          <span class="sp-widget-icon">📅</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'الحصة القادمة' : 'Upcoming Class'}</span>
          <span class="sp-widget-value">${metrics.nextClass ? metrics.nextClass.subject : (state.lang === 'ar' ? 'لا يوجد' : 'None')}</span>
          <span class="sp-widget-footer">${metrics.nextClass ? `${metrics.nextClass.timeslot?.startTime} - ${metrics.nextClass.timeslot?.endTime}` : (state.lang === 'ar' ? 'انتهت حصص اليوم' : 'Classes ended today')}</span>
        </div>
        <div class="sp-widget widget-dark">
          <span class="sp-widget-icon">📝</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'المهام المعلقة' : 'Pending Tasks'}</span>
          <span class="sp-widget-value">${metrics.pendingHwCount}</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'تحتاج إلى تسليم' : 'Need submission'}</span>
        </div>
        <div class="sp-widget widget-dark">
          <span class="sp-widget-icon">📋</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'نسبة الحضور' : 'Attendance Rate'}</span>
          <span class="sp-widget-value">${metrics.attRate}%</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'خلال الفصل الحالي' : 'This semester'}</span>
        </div>
        <div class="sp-widget widget-dark">
          <span class="sp-widget-icon">🏆</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'المعدل التراكمي' : 'GPA'}</span>
          <span class="sp-widget-value">${metrics.gpa}%</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'بناءً على آخر النتائج' : 'Based on latest results'}</span>
        </div>
      </div>
      
      <div class="sp-section-card">
        <h4 class="sp-section-title">👥 ${state.lang === 'ar' ? 'بيانات ولي الأمر' : 'Parent Details'}</h4>
        <div class="sp-info-grid">
          <div class="sp-info-item">
            <span class="avatar avatar-sm gradient-cyan">${parent?.name ? parent.name[0] : '?'}</span>
            <div>
                <span class="sp-info-label">${state.lang === 'ar' ? 'اسم ولي الأمر' : 'Parent Name'}</span>
                <span class="sp-info-value">${parent?.name || (state.lang === 'ar' ? 'غير مسجل' : 'Not Registered')}</span>
            </div>
          </div>
          <div class="sp-info-item">
            <span class="sp-info-icon">📞</span>
            <div>
                <span class="sp-info-label">${state.lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
                <span class="sp-info-value">${parent?.phone || (state.lang === 'ar' ? 'غير مسجل' : 'Not Registered')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">📋 ${state.lang === 'ar' ? 'مهام عاجلة' : 'Urgent Tasks'}</h4>
        <p class="text-muted text-sm">${state.lang === 'ar' ? 'لا توجد مهام عاجلة حالياً' : 'No urgent tasks at the moment'}</p>
      </div>
    `,
    schedule: `<div class="empty-state"><h3>📅 ${state.lang === 'ar' ? 'الجدول الدراسي' : 'Schedule'}</h3><p>${t('noData')}</p></div>`,
    performance: `<div class="empty-state"><h3>🏆 ${state.lang === 'ar' ? 'الأداء الأكاديمي' : 'Performance'}</h3><p>${t('noData')}</p></div>`,
    tasks: `<div class="empty-state"><h3>📝 ${state.lang === 'ar' ? 'المهام والواجبات' : 'Tasks'}</h3><p>${t('noData')}</p></div>`,
    attendance: `<div class="empty-state"><h3>📋 ${state.lang === 'ar' ? 'الحضور والغياب' : 'Attendance'}</h3><p>${t('noData')}</p></div>`,
    resources: `<div class="empty-state"><h3>📚 ${state.lang === 'ar' ? 'الموارد التعليمية' : 'Resources'}</h3><p>${t('noData')}</p></div>`,
    notifications: `<div class="empty-state"><h3>🔔 ${state.lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3><p>${t('noData')}</p></div>`,
    messages: `<div class="empty-state"><h3>✉️ ${state.lang === 'ar' ? 'الرسائل' : 'Messages'}</h3><p>${t('noData')}</p></div>`
  };

  return `
    <div class="student-profile-modal">
      <div class="sp-header">
        <div class="sp-user-info">
          <div class="avatar avatar-lg gradient-purple">${getInitials(student.name)}</div>
          <div class="sp-user-details">
            <h3>${escapeHTML(student.name)}</h3>
            <p>${cls?.name || '—'} | ${state.lang === 'ar' ? 'الرقم:' : 'ID:'} ${student.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div class="sp-status-badge">${state.lang === 'ar' ? 'طالب' : 'Student'}</div>
      </div>
      
      <div class="sp-layout">
        <div class="sp-sidebar">
          ${tabs.map(tab => `
            <button class="sp-tab-btn ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}" data-student-id="${studentId}">
              <span class="icon">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="sp-main-content" id="sp-tab-content">
          ${content[activeTab]}
        </div>
      </div>
    </div>
  `;
}

export function attachStudentProfileEvents() {
  if (window._studentProfileEventsAttached) return;
  window._studentProfileEventsAttached = true;

  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('.sp-tab-btn');
    if (tabBtn) {
      const tabId = tabBtn.dataset.tab;
      const studentId = tabBtn.dataset.studentId;
      
      // Update active state
      tabBtn.parentElement.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      
      // Update content
      const contentArea = document.getElementById('sp-tab-content');
      if (contentArea) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = getStudentDashboardHTML(studentId, tabId);
        const newContent = tempDiv.querySelector('#sp-tab-content').innerHTML;
        contentArea.innerHTML = newContent;
      }
    }
  });
}
