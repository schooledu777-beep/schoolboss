import { state, t } from '../state.js';
import { db, doc, getDoc } from '../firebase-config.js';
import { escapeHTML, getInitials } from '../ui.js';

export function getTeacherDashboardHTML(teacherId, activeTab = 'overview') {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return `<div class="p-4">${t('noData')}</div>`;

    const metrics = getTeacherMetrics(teacherId);
    
    const tabs = [
        { id: 'overview', label: state.lang === 'ar' ? 'نظرة عامة' : 'Overview', icon: '📊' },
        { id: 'schedule', label: state.lang === 'ar' ? 'الجدول الدراسي' : 'Schedule', icon: '📅' },
        { id: 'classes', label: state.lang === 'ar' ? 'الصفوف' : 'Classes', icon: '🏫' },
        { id: 'subjects', label: state.lang === 'ar' ? 'المواد' : 'Subjects', icon: '📖' },
        { id: 'hr', label: state.lang === 'ar' ? 'الموارد البشرية' : 'HR', icon: '💰' },
        { id: 'notifications', label: state.lang === 'ar' ? 'الإشعارات' : 'Notifications', icon: '🔔' }
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
                    <span class="sp-widget-icon">🏫</span>
                    <span class="sp-widget-title">${state.lang === 'ar' ? 'عدد الصفوف' : 'Classes Count'}</span>
                    <span class="sp-widget-value">${metrics.classCount}</span>
                    <span class="sp-widget-footer">${state.lang === 'ar' ? 'الصفوف المسجلة' : 'Registered classes'}</span>
                </div>
                <div class="sp-widget widget-dark">
                    <span class="sp-widget-icon">👨‍🎓</span>
                    <span class="sp-widget-title">${state.lang === 'ar' ? 'عدد الطلاب' : 'Students Count'}</span>
                    <span class="sp-widget-value">${metrics.studentCount}</span>
                    <span class="sp-widget-footer">${state.lang === 'ar' ? 'إجمالي طلاب المعلم' : 'Total unique students'}</span>
                </div>
                <div class="sp-widget widget-dark">
                    <span class="sp-widget-icon">💰</span>
                    <span class="sp-widget-title">${state.lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</span>
                    <span class="sp-widget-value">${teacher.baseSalary || 0}</span>
                    <span class="sp-widget-footer">${state.lang === 'ar' ? 'حسب العقد' : 'As per contract'}</span>
                </div>
            </div>

            <div class="sp-section-card">
                <h4 class="sp-section-title">📖 ${state.lang === 'ar' ? 'المواد التي يدرسها' : 'Teaching Subjects'}</h4>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${(teacher.subjects || []).map(s => `<span class="badge badge-info">${s}</span>`).join('') || (state.lang === 'ar' ? 'لم يتم تحديد مواد' : 'No subjects assigned')}
                </div>
            </div>

            <div class="sp-section-card">
                <h4 class="sp-section-title">📞 ${state.lang === 'ar' ? 'معلومات التواصل' : 'Contact Information'}</h4>
                <div class="sp-info-grid">
                    <div class="sp-info-item">
                        <span class="sp-info-icon">✉️</span>
                        <div>
                            <span class="sp-info-label">${t('email')}</span>
                            <span class="sp-info-value">${teacher.email || '—'}</span>
                        </div>
                    </div>
                    <div class="sp-info-item">
                        <span class="sp-info-icon">📞</span>
                        <div>
                            <span class="sp-info-label">${state.lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
                            <span class="sp-info-value">${teacher.phone || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `,
        schedule: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">📅 ${state.lang === 'ar' ? 'جدول الحصص' : 'Teaching Schedule'}</h4>
                <div class="schedule-grid-container">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>${state.lang === 'ar' ? 'الوقت' : 'Time'}</th>
                                ${[0,1,2,3,4,5].map(d => `<th>${[t('sun'),t('mon'),t('tue'),t('wed'),t('thu'),t('fri')][d]}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${state.timeslots.map(slot => `
                                <tr>
                                    <td class="time-cell">${slot.startTime}</td>
                                    ${[0,1,2,3,4,5].map(day => {
                                        const entry = state.schedules.find(s => s.teacherId === teacherId && (s.dayOfWeek === day || s.dayIndex === day) && s.timeslotId === slot.id);
                                        return `<td>${entry ? `<div class="sch-item"><strong>${entry.subject}</strong><span>${entry.className || ''}</span></div>` : ''}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        classes: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">🏫 ${state.lang === 'ar' ? 'الصفوف التي أدرسها' : 'My Classes'}</h4>
                <div class="grid-container" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    ${state.classes.filter(c => c.teacherId === teacherId || (c.teacherIds || []).includes(teacherId)).map(c => `
                        <div class="glass-card p-3 text-center">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏫</div>
                            <div style="font-weight: 600;">${c.name}</div>
                            <div class="text-muted text-sm">${c.studentIds?.length || 0} ${state.lang === 'ar' ? 'طالب' : 'Students'}</div>
                        </div>
                    `).join('') || `<p class="text-muted">${t('noData')}</p>`}
                </div>
            </div>
        `,
        subjects: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">📖 ${state.lang === 'ar' ? 'المواد الدراسية' : 'Subjects'}</h4>
                <div class="grid-container" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    ${(teacher.subjects || []).map(s => `
                        <div class="glass-card p-3 text-center" style="border-bottom: 3px solid var(--primary);">
                            <div style="font-weight: 600;">${s}</div>
                        </div>
                    `).join('') || `<p class="text-muted">${t('noData')}</p>`}
                </div>
            </div>
        `,
        hr: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">💰 ${state.lang === 'ar' ? 'كشوف الرواتب' : 'Salary Slips'}</h4>
                ${state.salarySlips?.filter(s => s.teacherId === teacherId).map(s => `
                    <div class="glass-card p-3" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${s.month} / ${s.year}</strong>
                            <div class="text-muted text-sm">${state.lang === 'ar' ? 'الإجمالي:' : 'Total:'} ${s.netSalary}</div>
                        </div>
                        <button class="btn btn-sm btn-outline">${state.lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}</button>
                    </div>
                `).join('') || `<div class="empty-state"><p>${t('noData')}</p></div>`}
            </div>
        `,
        notifications: `<div class="empty-state"><h3>🔔 ${state.lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3><p>${t('noData')}</p></div>`
    };

    return `
    <div class="student-profile-modal">
        <div class="sp-header">
            <div class="sp-user-info">
                <div class="avatar avatar-lg gradient-cyan">${getInitials(teacher.name)}</div>
                <div class="sp-user-details">
                    <h3>${escapeHTML(teacher.name)}</h3>
                    <p>${(teacher.subjects || []).join(', ') || '—'} | ${state.lang === 'ar' ? 'الرقم:' : 'ID:'} ${teacherId.slice(0, 8).toUpperCase()}</p>
                </div>
            </div>
            <span class="sp-status-badge" style="background: rgba(6, 182, 212, 0.1); color: #0891b2;">${t('teacher')}</span>
        </div>

        <div class="sp-layout">
            <aside class="sp-sidebar">
                ${tabs.map(tab => `
                    <button class="sp-tab-btn ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}" data-teacher-id="${teacherId}">
                        <span class="icon">${tab.icon}</span>
                        <span>${tab.label}</span>
                    </button>
                `).join('')}
            </aside>

            <main class="sp-main-content" id="tp-tab-content">
                ${content[activeTab]}
            </main>
        </div>
    </div>
    `;
}

function getTeacherMetrics(teacherId) {
    const myClasses = state.classes.filter(c => c.teacherId === teacherId || (c.teacherIds || []).includes(teacherId));
    const studentIds = [...new Set(myClasses.flatMap(c => c.studentIds || []))];
    
    // Upcoming Class
    const now = new Date();
    const dayIndex = now.getDay(); 
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const mySchedules = state.schedules.filter(s => s.teacherId === teacherId && (s.dayOfWeek === dayIndex || s.dayIndex === dayIndex));
    const upcoming = mySchedules
        .map(s => {
            const ts = state.timeslots.find(t => t.id === s.timeslotId);
            return { ...s, timeslot: ts };
        })
        .filter(s => s.timeslot && s.timeslot.startTime > currentTime)
        .sort((a, b) => a.timeslot.startTime.localeCompare(b.timeslot.startTime));

    return {
        classCount: myClasses.length,
        studentCount: studentIds.length,
        nextClass: upcoming[0] || null
    };
}

export function attachTeacherProfileEvents() {
    if (window._teacherProfileEventsAttached) return;
    window._teacherProfileEventsAttached = true;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.sp-tab-btn');
        if (!btn || !btn.dataset.teacherId) return;
        
        const teacherId = btn.dataset.teacherId;
        const tabId = btn.dataset.tab;
        const contentArea = document.getElementById('tp-tab-content');
        if (!contentArea) return;

        // Update active state
        btn.parentElement.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Render tab content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = getTeacherDashboardHTML(teacherId, tabId);
        const newContent = tempDiv.querySelector('#tp-tab-content').innerHTML;
        contentArea.innerHTML = newContent;
    });
}
