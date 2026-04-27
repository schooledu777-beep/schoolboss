import { state, t } from '../state.js';
import { db, doc, updateDoc, arrayUnion } from '../firebase-config.js';
import { escapeHTML, getInitials, renderAvatar, showToast } from '../ui.js';
import { showTeacherForm } from './teachers.js';
import { uploadFile } from '../services/uploadService.js';

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
                                <a href="${doc.url}" target="_blank" rel="noopener noreferrer" class="btn btn-icon" title="${state.lang === 'ar' ? 'معاينة / تحميل' : 'View / Download'}">📥</a>
                                ${state.profile?.role === 'admin' ? `
                                    <button class="btn btn-icon text-danger delete-doc-btn" 
                                            data-teacher-id="${teacherId}" 
                                            data-doc-name="${escapeHTML(doc.name)}" 
                                            data-doc-url="${doc.url}" 
                                            title="${state.lang === 'ar' ? 'حذف' : 'Delete'}">🗑️</button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('') || `<div class="empty-state py-4"><p class="text-muted">${t('noData')}</p></div>`}
                </div>
            </div>
        `,
        notifications: `<div class="empty-state"><h3>🔔 ${state.lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3><p>${t('noData')}</p></div>`,
        preferences: `
            <div class="sp-section-card">
                <h4 class="sp-section-title">⚙️ ${state.lang === 'ar' ? 'تفضيلات الجدول الدراسي' : 'Schedule Preferences'}</h4>
                <div class="pref-grid">
                    <div class="form-group full-width">
                        <label>${state.lang === 'ar' ? 'ساعات العمل المفضلة' : 'Preferred Working Hours'}</label>
                        <input type="text" id="pref-hours" class="form-input" value="${teacher.preferences?.hours || ''}" placeholder="${state.lang === 'ar' ? 'مثال: 8:00 ص - 2:00 م' : 'e.g. 8:00 AM - 2:00 PM'}">
                    </div>
                    <div class="form-group full-width">
                        <label>${state.lang === 'ar' ? 'أيام الإجازة المفضلة' : 'Preferred Days Off'}</label>
                        <input type="text" id="pref-days" class="form-input" value="${teacher.preferences?.daysOff || ''}" placeholder="${state.lang === 'ar' ? 'مثال: الأحد، الثلاثاء' : 'e.g. Sunday, Tuesday'}">
                    </div>
                    <div class="form-group full-width">
                        <label>${state.lang === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes'}</label>
                        <textarea id="pref-notes" class="form-input" rows="4" placeholder="${state.lang === 'ar' ? 'أي ملاحظات أخرى تتعلق بالجدول...' : 'Any other scheduling notes...'}">${teacher.preferences?.notes || ''}</textarea>
                    </div>
                </div>
                <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
                    <button class="btn btn-primary" id="save-prefs-btn" data-id="${teacherId}">${state.lang === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences'}</button>
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

    // Edit Profile Button
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-profile-btn');
        if (!btn) return;
        const teacher = state.teachers.find(t => t.id === btn.dataset.id);
        if (teacher) showTeacherForm(teacher);
    });

    // Refresh on update
    window.onTeacherUpdated = (teacherId) => {
        const activeBtn = document.querySelector('.sp-tab-btn.active');
        const activeTab = activeBtn ? activeBtn.dataset.tab : 'overview';
        const modalBody = document.querySelector('.student-profile-modal')?.parentElement;
        if (modalBody) {
            modalBody.innerHTML = getTeacherDashboardHTML(teacherId, activeTab);
        }
    };

    // Photo Upload
    document.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.profile-photo-wrapper');
        if (wrapper) {
            document.getElementById('teacher-photo-input')?.click();
        }
    });

    document.addEventListener('change', async (e) => {
        if (e.target.id === 'teacher-photo-input' && e.target.files[0]) {
            const file = e.target.files[0];
            const teacherId = document.querySelector('.profile-photo-wrapper').dataset.id;
            try {
                showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
                const url = await uploadFile(file);
                await updateDoc(doc(db, 'teachers', teacherId), { photoURL: url });
                showToast(state.lang === 'ar' ? 'تم تحديث الصورة' : 'Photo updated', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                showToast(t('errorOccurred'), 'error');
            }
        }
        
        if (e.target.id === 'doc-upload-input' && e.target.files[0]) {
            const file = e.target.files[0];
            const teacherId = document.querySelector('.sp-tab-btn')?.dataset.teacherId;
            if (!teacherId) {
                showToast(t('errorOccurred'), 'error');
                return;
            }

            try {
                showToast(state.lang === 'ar' ? 'جاري رفع الوثيقة...' : 'Uploading document...', 'info');
                const url = await uploadFile(file);
                const docData = { name: file.name, url, date: new Date().toISOString() };
                await updateDoc(doc(db, 'teachers', teacherId), {
                    documents: arrayUnion(docData)
                });
                showToast(state.lang === 'ar' ? 'تم رفع الوثيقة بنجاح' : 'Document uploaded successfully', 'success');
                window.onTeacherUpdated(teacherId);
            } catch (err) {
                showToast(t('errorOccurred'), 'error');
            }
        }
    });
    
    // Document Deletion
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-doc-btn');
        if (!btn) return;

        const { teacherId, docName, docUrl } = btn.dataset;
        
        const confirmed = await showConfirm(
            state.lang === 'ar' ? 'حذف الوثيقة' : 'Delete Document',
            state.lang === 'ar' ? `هل أنت متأكد من حذف الوثيقة: ${docName}؟` : `Are you sure you want to delete: ${docName}?`
        );

        if (confirmed) {
            try {
                const teacherRef = doc(db, 'teachers', teacherId);
                const teacherData = state.teachers.find(t => t.id === teacherId);
                const docToRemove = teacherData.documents.find(d => d.url === docUrl);

                if (docToRemove) {
                    await updateDoc(teacherRef, {
                        documents: arrayRemove(docToRemove)
                    });
                    showToast(state.lang === 'ar' ? 'تم حذف الوثيقة' : 'Document deleted', 'success');
                    window.onTeacherUpdated(teacherId);
                }
            } catch (err) {
                console.error(err);
                showToast(t('errorOccurred'), 'error');
            }
        }
    });

    // Schedule Preferences Save
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#save-prefs-btn');
        if (!btn) return;

        const teacherId = btn.dataset.id;
        const preferences = {
            hours: document.getElementById('pref-hours').value,
            daysOff: document.getElementById('pref-days').value,
            notes: document.getElementById('pref-notes').value
        };

        try {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-sm"></span> ${state.lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}`;
            
            const teacherRef = doc(db, 'teachers', teacherId);
            await updateDoc(teacherRef, { preferences });
            
            // Update local state
            const teacher = state.teachers.find(t => t.id === teacherId);
            if (teacher) teacher.preferences = preferences;

            showToast(state.lang === 'ar' ? 'تم حفظ التفضيلات بنجاح' : 'Preferences saved successfully', 'success');
            window.onTeacherUpdated(teacherId);
        } catch (err) {
            console.error(err);
            showToast(t('errorOccurred'), 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = state.lang === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences';
        }
    });
}
