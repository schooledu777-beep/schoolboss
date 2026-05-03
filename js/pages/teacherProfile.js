import { state, t } from '../state.js';
import { db, doc, updateDoc, arrayUnion } from '../firebase-config.js';
import { escapeHTML, renderAvatar, showToast } from '../ui.js?v=20260502-photo-viewer';
import { showTeacherForm } from './teachers.js';
import { uploadFile } from '../services/uploadService.js?v=20260502-photo-sync';
import { showAdminAccountModal } from '../services/accountAdmin.js?v=20260503-admin-accounts';

function sanitizeFileName(name = 'document') {
    return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document';
}

function getCloudinaryAttachmentUrl(url, fileName) {
    if (!url?.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    const safeName = sanitizeFileName(fileName).replace(/\.[^.]+$/, '');
    return url.replace('/upload/', `/upload/fl_attachment:${encodeURIComponent(safeName)}/`);
}

async function downloadDocument(url, fileName) {
    const safeName = sanitizeFileName(fileName);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed (${response.status})`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = safeName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
        console.warn('Blob download failed, falling back to attachment URL:', err);
        const link = document.createElement('a');
        link.href = getCloudinaryAttachmentUrl(url, safeName);
        link.download = safeName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
}

export function getTeacherDashboardHTML(teacherId, activeTab = 'overview') {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return `<div class="p-4">${t('noData')}</div>`;

    const metrics = getTeacherMetrics(teacherId);
    
    const tabs = [
        { id: 'overview', label: state.lang === 'ar' ? 'نظرة عامة' : 'Overview', icon: '📊' },
        { id: 'schedule', label: state.lang === 'ar' ? 'الجدول الدراسي' : 'Schedule', icon: '📅' },
        { id: 'classes', label: state.lang === 'ar' ? 'الصفوف' : 'Classes', icon: '🏫' },
        { id: 'subjects', label: state.lang === 'ar' ? 'المواد' : 'Subjects', icon: '📖' },
        { id: 'tasks', label: state.lang === 'ar' ? 'المهام والواجبات' : 'Tasks', icon: '📝' },
        { id: 'hr', label: state.lang === 'ar' ? 'الموارد البشرية' : 'HR', icon: '💰' },
        { id: 'documents', label: state.lang === 'ar' ? 'الوثائق والشهادات' : 'Documents', icon: '📎' },
        { id: 'preferences', label: state.lang === 'ar' ? 'تفضيلات الجدول' : 'Schedule Prefs', icon: '⚙️' },
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
                    <span class="sp-widget-icon">📝</span>
                    <span class="sp-widget-title">${state.lang === 'ar' ? 'المهام المسندة' : 'Assigned Tasks'}</span>
                    <span class="sp-widget-value">${metrics.assignedTasksCount}</span>
                    <span class="sp-widget-footer">${state.lang === 'ar' ? 'واجبات تم إنشاؤها' : 'Created homework'}</span>
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
                                        const cls = entry ? state.classes.find(c => c.id === entry.classId) : null;
                                        return `<td>${entry ? `<div class="sch-item"><strong>${entry.subject}</strong><span>${entry.className || cls?.name || ''}</span></div>` : ''}</td>`;
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
        documents: `
            <div class="sp-section-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h4 class="sp-section-title" style="margin-bottom: 0;">📎 ${state.lang === 'ar' ? 'الوثائق والمستندات' : 'Documents & Certificates'}</h4>
                    <button class="btn btn-sm btn-primary" onclick="document.getElementById('doc-upload-input').click()">+ ${state.lang === 'ar' ? 'رفع وثيقة' : 'Upload Doc'}</button>
                    <input type="file" id="doc-upload-input" style="display: none;" accept=".pdf,.doc,.docx,.jpg,.png,.txt,.xlsx,.xls">
                </div>
                <div class="grid-container" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                    ${(teacher.documents || []).map(doc => `
                        <div class="glass-card p-3 animate-in" style="display: flex; align-items: center; gap: 1rem;">
                             <div style="font-size: 1.5rem;">
                                ${doc.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i) ? '🖼️' : 
                                  doc.name.endsWith('.pdf') ? '📕' : 
                                  (doc.name.endsWith('.xlsx') || doc.name.endsWith('.xls')) ? '📊' :
                                  doc.name.endsWith('.txt') ? '📄' : '📎'}
                             </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.name}">${doc.name}</div>
                                <div class="text-muted text-sm">${new Date(doc.date).toLocaleDateString()}</div>
                            </div>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-icon download-doc-btn" data-doc-url="${escapeHTML(doc.url)}" data-doc-name="${escapeHTML(doc.name)}" title="${state.lang === 'ar' ? 'تحميل الملف' : 'Download file'}">📥</button>
                                ${state.profile?.role === 'admin' ? `
                                    <button class="btn btn-icon text-danger delete-doc-btn" 
                                            data-teacher-id="${teacherId}" 
                                            data-doc-name="${escapeHTML(doc.name)}" 
                                            data-doc-url="${escapeHTML(doc.url)}" 
                                            title="${state.lang === 'ar' ? 'حذف' : 'Delete'}">🗑️</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('') || `<div class="empty-state py-4"><p class="text-muted">${t('noData')}</p></div>`}
                </div>
            </div>
        `,
        preferences: `
            <div class="sp-section-card pref-container">
                <div class="pref-header-row">
                    <div class="pref-title-group">
                        <h4>${state.lang === 'ar' ? 'تفضيلات الجدول الدراسي' : 'Schedule Preferences'}</h4>
                        <p>${state.lang === 'ar' ? 'قم بتحديد تفضيلاتك الزمنية للحصص الدراسية' : 'Manage your teaching time preferences'}</p>
                    </div>
                    <button class="btn btn-primary" id="save-prefs-btn" data-id="${teacherId}">
                        <span>✅</span> ${state.lang === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences'}
                    </button>
                </div>

                <div class="pref-selector">
                    <div class="pref-type active" data-type="preferred" style="border: 1px solid var(--success); color: var(--success); background: rgba(16, 185, 129, 0.05);">
                        <span>${state.lang === 'ar' ? 'وقت مفضل' : 'Preferred'}</span>
                        <span class="pref-dot dot-preferred"></span>
                    </div>
                    <div class="pref-type" data-type="suitable" style="border: 1px solid var(--info); color: var(--info); background: rgba(59, 130, 246, 0.05);">
                        <span>${state.lang === 'ar' ? 'وقت مناسب' : 'Suitable'}</span>
                        <span class="pref-dot dot-suitable"></span>
                    </div>
                    <div class="pref-type" data-type="unsuitable" style="border: 1px solid var(--danger); color: var(--danger); background: rgba(239, 68, 68, 0.05);">
                        <span>${state.lang === 'ar' ? 'وقت غير مناسب' : 'Unsuitable'}</span>
                        <span class="pref-dot dot-unsuitable"></span>
                    </div>
                </div>

                <div class="pref-table-wrapper">
                    <table class="pref-table">
                        <thead>
                            <tr>
                                <th class="pref-time-col">${state.lang === 'ar' ? 'الوقت / اليوم' : 'Time / Day'}</th>
                                ${[0, 1, 2, 3, 4].map(d => `<th>${[t('sun'), t('mon'), t('tue'), t('wed'), t('thu')][d]}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${state.timeslots.map(slot => `
                                <tr>
                                    <td class="pref-time-col">
                                        <strong>${slot.startTime}-${slot.endTime}</strong>
                                    </td>
                                    ${[0, 1, 2, 3, 4].map(day => {
                                        const key = `${day}_${slot.id}`;
                                        const status = teacher.preferences?.grid?.[key] || '';
                                        const statusClass = status ? `selected-${status}` : '';
                                        return `
                                            <td>
                                                <div class="pref-cell ${statusClass}" data-day="${day}" data-slot="${slot.id}" data-key="${key}">
                                                    <span class="plus-icon" style="font-size: 1rem; opacity: 0.3;">+</span>
                                                    <span class="status-icon" style="font-size: 1rem;">${status === 'preferred' ? '⭐' : status === 'suitable' ? '✔️' : '❌'}</span>
                                                </div>
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        tasks: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">📝 ${state.lang === 'ar' ? 'المهام والواجبات المسندة' : 'Assigned Tasks & Homework'}</h4>
                <div class="homework-list">
                    ${state.homework?.filter(h => h.teacherId === teacherId).map(hw => `
                        <div class="hw-item glass-card" style="margin-bottom: 1rem; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong>${hw.title}</strong>
                                <span class="badge badge-info">${hw.submissions?.length || 0} ${state.lang === 'ar' ? 'تسليمات' : 'Submissions'}</span>
                            </div>
                            <div class="text-muted text-sm" style="margin-top: 0.5rem;">
                                ${state.lang === 'ar' ? 'الصف:' : 'Class:'} ${state.classes.find(c => c.id === hw.classId)?.name || hw.classId} | 
                                ${state.lang === 'ar' ? 'المادة:' : 'Subject:'} ${hw.subject} | 
                                ${state.lang === 'ar' ? 'الموعد:' : 'Due:'} ${hw.dueDate}
                            </div>
                        </div>
                    `).join('') || `<div class="empty-state py-4"><p class="text-muted">${t('noData')}</p></div>`}
                </div>
            </div>
        `,
        notifications: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">🔔 ${state.lang === 'ar' ? 'آخر التنبيهات' : 'Latest Notifications'}</h4>
                <div class="notification-list">
                    ${state.notificationLogs?.filter(n => n.recipientId === teacherId).sort((a,b) => new Date(b.date) - new Date(a.date)).map(n => `
                        <div class="notification-item glass-card p-3 mb-2 animate-in">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                <strong>${n.title}</strong>
                                <small class="text-muted">${new Date(n.date).toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US')}</small>
                            </div>
                            <p class="mb-0 text-sm">${n.body}</p>
                        </div>
                    `).join('') || `<div class="empty-state py-4"><p class="text-muted">${t('noData')}</p></div>`}
                </div>
            </div>
        `
    };

    return `
    <div class="student-profile-modal">
        <div class="sp-header">
            <div class="sp-user-info">
                <div class="profile-photo-wrapper clickable" data-id="${teacherId}" onclick="window.openImageViewer('${teacher.photoURL || ''}', '${escapeHTML(teacher.name)}', true)">
                    ${renderAvatar(teacher.name, teacher.photoURL, 'avatar-lg')}
                    <div class="photo-overlay">📷</div>
                    <input type="file" id="teacher-photo-input" style="display:none;" accept="image/*">
                </div>
                <div class="sp-user-details">
                    <h3>${escapeHTML(teacher.name)}</h3>
                    <p>${(teacher.subjects || []).join(', ') || '—'} | ${state.lang === 'ar' ? 'الرقم:' : 'ID:'} ${teacherId.slice(0, 8).toUpperCase()}</p>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${state.profile?.role === 'admin' ? `<button class="btn btn-sm btn-outline edit-profile-btn" data-id="${teacherId}" title="${state.lang==='ar'?'تعديل':'Edit'}">✏️</button>` : ''}
                <span class="sp-status-badge" style="background: rgba(6, 182, 212, 0.1); color: #0891b2;">${t('teacher')}</span>
            </div>
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
        nextClass: upcoming[0] || null,
        assignedTasksCount: state.homework?.filter(h => h.teacherId === teacherId).length || 0
    };
}

export function attachTeacherProfileEvents(modalElement) {
    if (!modalElement) return;

    if (state.profile?.role === 'admin' && !modalElement.querySelector('.manage-profile-account')) {
        const wrapper = modalElement.querySelector('.profile-photo-wrapper');
        const teacherId = wrapper?.dataset.id;
        const statusBadge = modalElement.querySelector('.sp-status-badge');
        if (teacherId && statusBadge?.parentElement) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-outline manage-profile-account';
            btn.dataset.role = 'teacher';
            btn.dataset.id = teacherId;
            btn.textContent = state.lang === 'ar' ? '🔐 إدارة الحساب' : '🔐 Account';
            statusBadge.parentElement.insertBefore(btn, statusBadge);
        }
    }

    // Tab Switching
    modalElement.addEventListener('click', (e) => {
        const btn = e.target.closest('.sp-tab-btn');
        if (!btn || !btn.dataset.teacherId) return;
        
        const teacherId = btn.dataset.teacherId;
        const tabId = btn.dataset.tab;
        const contentArea = modalElement.querySelector('#tp-tab-content');
        
        if (!contentArea) return;

        e.preventDefault();

        // Update active class on buttons
        const sidebar = btn.closest('.sp-sidebar');
        if (sidebar) {
            sidebar.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        // Render specific tab content
        contentArea.innerHTML = `<div class="p-4 text-center"><span class="spinner"></span></div>`;
        
        setTimeout(() => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = getTeacherDashboardHTML(teacherId, tabId);
            const newContent = tempDiv.querySelector('#tp-tab-content').innerHTML;
            contentArea.innerHTML = newContent;
        }, 10);
    });

    // Edit Profile Button
    modalElement.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-profile-btn');
        if (!btn) return;
        const teacher = state.teachers.find(t => t.id === btn.dataset.id);
        if (teacher) showTeacherForm(teacher);
    });

    modalElement.addEventListener('click', (e) => {
        const accountBtn = e.target.closest('.manage-profile-account');
        if (accountBtn?.dataset.role !== 'teacher') return;
        const teacher = state.teachers.find(t => t.id === accountBtn.dataset.id);
        if (teacher) showAdminAccountModal(teacher, 'teacher');
    });

    // Refresh on update
    window.onTeacherUpdated = (teacherId) => {
        const activeBtn = modalElement.querySelector('.sp-tab-btn.active');
        const activeTab = activeBtn ? activeBtn.dataset.tab : 'overview';
        modalElement.innerHTML = getTeacherDashboardHTML(teacherId, activeTab);
    };

    // Global click handler for modal actions
    modalElement.addEventListener('click', async (e) => {
        const downloadBtn = e.target.closest('.download-doc-btn');
        if (downloadBtn) {
            e.preventDefault();
            await downloadDocument(downloadBtn.dataset.docUrl, downloadBtn.dataset.docName);
            return;
        }

        // Document Deletion
        const delBtn = e.target.closest('.delete-doc-btn');
        if (delBtn) {
            const { teacherId, docName, docUrl } = delBtn.dataset;
            const confirmed = window.confirm(
                state.lang === 'ar' ? `هل أنت متأكد من حذف الوثيقة: ${docName}؟` : `Are you sure you want to delete: ${docName}?`
            );
            if (!confirmed) return;

            try {
                delBtn.disabled = true;
                const teacherRef = doc(db, 'teachers', teacherId);
                const teacherData = state.teachers.find(t => t.id === teacherId);
                const nextDocuments = (teacherData?.documents || []).filter(d => d.url !== docUrl);

                await updateDoc(teacherRef, { documents: nextDocuments });
                if (teacherData) teacherData.documents = nextDocuments;
                showToast(state.lang === 'ar' ? 'تم حذف الوثيقة' : 'Document deleted', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                console.error(err);
                delBtn.disabled = false;
                showToast(err?.message || t('errorOccurred'), 'error');
            }
            return;
        }

        // Schedule Preferences Type Selection
        const typeBtn = e.target.closest('.pref-type');
        if (typeBtn) {
            modalElement.querySelectorAll('.pref-type').forEach(b => b.classList.remove('active'));
            typeBtn.classList.add('active');
            return;
        }

        // Schedule Preferences Cell Interaction
        const cell = e.target.closest('.pref-cell');
        if (cell) {
            const activeTypeBtn = modalElement.querySelector('.pref-type.active');
            const selectedType = activeTypeBtn ? activeTypeBtn.dataset.type : 'suitable';
            const statusIcon = cell.querySelector('.status-icon');
            
            if (cell.classList.contains(`selected-${selectedType}`)) {
                cell.classList.remove(`selected-${selectedType}`);
                statusIcon.textContent = '';
            } else {
                cell.classList.remove('selected-preferred', 'selected-suitable', 'selected-unsuitable');
                cell.classList.add(`selected-${selectedType}`);
                if (selectedType === 'preferred') statusIcon.textContent = '⭐';
                else if (selectedType === 'suitable') statusIcon.textContent = '✔️';
                else if (selectedType === 'unsuitable') statusIcon.textContent = '❌';
            }
            return;
        }

        // Schedule Preferences Save
        const savePrefsBtn = e.target.closest('#save-prefs-btn');
        if (savePrefsBtn) {
            const teacherId = savePrefsBtn.dataset.id;
            const gridData = {};
            modalElement.querySelectorAll('.pref-cell').forEach(c => {
                const key = c.dataset.key;
                if (c.classList.contains('selected-preferred')) gridData[key] = 'preferred';
                else if (c.classList.contains('selected-suitable')) gridData[key] = 'suitable';
                else if (c.classList.contains('selected-unsuitable')) gridData[key] = 'unsuitable';
            });

            const preferences = { grid: gridData };

            try {
                savePrefsBtn.disabled = true;
                savePrefsBtn.innerHTML = `<span class="spinner-sm"></span> ${state.lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}`;
                
                const teacherRef = doc(db, 'teachers', teacherId);
                await updateDoc(teacherRef, { preferences });
                
                const teacher = state.teachers.find(t => t.id === teacherId);
                if (teacher) teacher.preferences = preferences;

                showToast(state.lang === 'ar' ? 'تم حفظ التفضيلات بنجاح' : 'Preferences saved successfully', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                console.error(err);
                showToast(t('errorOccurred'), 'error');
            } finally {
                savePrefsBtn.disabled = false;
                savePrefsBtn.innerHTML = `<span>✅</span> ${state.lang === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences'}`;
            }
            return;
        }
    });

    // Inputs Change Handler
    modalElement.addEventListener('change', async (e) => {
        // Teacher Photo Input
        if (e.target.id === 'teacher-photo-input' && e.target.files[0]) {
            const file = e.target.files[0];
            const wrapper = modalElement.querySelector('.profile-photo-wrapper');
            const teacherId = wrapper ? wrapper.dataset.id : null;
            if (!teacherId) return;

            try {
                showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
                const url = await uploadFile(file, 'teachers/photos');
                await updateDoc(doc(db, 'teachers', teacherId), { photoURL: url });
                showToast(state.lang === 'ar' ? 'تم تحديث الصورة' : 'Photo updated', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                console.error(err);
                showToast(err?.message || t('errorOccurred'), 'error');
            }
        }
        
        // Document Upload Input
        if (e.target.id === 'doc-upload-input' && e.target.files[0]) {
            const file = e.target.files[0];
            const activeBtn = modalElement.querySelector('.sp-tab-btn');
            const teacherId = activeBtn ? activeBtn.dataset.teacherId : null;
            if (!teacherId) {
                showToast(t('errorOccurred'), 'error');
                return;
            }

            try {
                showToast(state.lang === 'ar' ? 'جاري رفع الوثيقة...' : 'Uploading document...', 'info');
                const url = await uploadFile(file, `teachers/${teacherId}/documents`);
                const docData = { name: file.name, url, type: file.type || 'application/octet-stream', size: file.size || 0, date: new Date().toISOString() };
                await updateDoc(doc(db, 'teachers', teacherId), {
                    documents: arrayUnion(docData)
                });
                showToast(state.lang === 'ar' ? 'تم رفع الوثيقة بنجاح' : 'Document uploaded successfully', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                console.error(err);
                showToast(err?.message || t('errorOccurred'), 'error');
            }
        }
    });
}
