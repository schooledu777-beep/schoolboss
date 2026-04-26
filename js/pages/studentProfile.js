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

export function getStudentDashboardHTML(studentId, activeTab = 'overview') {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return '';

  const cls = state.classes.find(c => c.id === student.classId);
  const parent = state.parents.find(p => p.id === student.parentId);
  
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
          <div class="sp-widget-icon">📅</div>
          <div class="sp-widget-info">
            <div class="sp-widget-title">${state.lang === 'ar' ? 'الحصة القادمة' : 'Upcoming Class'}</div>
            <div class="sp-widget-value">${state.lang === 'ar' ? 'اللغة العربية' : 'Arabic'}</div>
          </div>
          <div class="sp-widget-footer">09:00 ص - 10:00 ص</div>
        </div>
        <div class="sp-widget widget-dark">
          <div class="sp-widget-icon">📝</div>
          <div class="sp-widget-info">
            <div class="sp-widget-title">${state.lang === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}</div>
            <div class="sp-widget-value">0/3</div>
          </div>
        </div>
        <div class="sp-widget widget-dark">
          <div class="sp-widget-icon">📋</div>
          <div class="sp-widget-info">
            <div class="sp-widget-title">${state.lang === 'ar' ? 'نسبة الحضور' : 'Attendance Rate'}</div>
            <div class="sp-widget-value">0%</div>
          </div>
        </div>
        <div class="sp-widget widget-dark">
          <div class="sp-widget-icon">🏆</div>
          <div class="sp-widget-info">
            <div class="sp-widget-title">${state.lang === 'ar' ? 'المعدل التراكمي' : 'GPA'}</div>
            <div class="sp-widget-value">0%</div>
          </div>
        </div>
      </div>
      
      <div class="sp-section-card">
        <h4 class="sp-section-title">👥 ${state.lang === 'ar' ? 'بيانات ولي الأمر' : 'Parent Details'}</h4>
        <div class="sp-info-grid">
          <div class="sp-info-item">
            <span class="icon">👤</span>
            <div><span class="sp-info-label">${state.lang === 'ar' ? 'اسم ولي الأمر' : 'Parent Name'}</span><span class="sp-info-value">${parent?.name || (state.lang === 'ar' ? 'غير مسجل' : 'Not Registered')}</span></div>
          </div>
          <div class="sp-info-item">
            <span class="icon">📞</span>
            <div><span class="sp-info-label">${state.lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span><span class="sp-info-value">${parent?.phone || (state.lang === 'ar' ? 'غير مسجل' : 'Not Registered')}</span></div>
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
        // Here we could just call getStudentDashboardHTML again or have a specific content getter
        // For now, let's just re-render the specific section
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = getStudentDashboardHTML(studentId, tabId);
        const newContent = tempDiv.querySelector('#sp-tab-content').innerHTML;
        contentArea.innerHTML = newContent;
      }
    }
  });
}

