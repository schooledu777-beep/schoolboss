import { state, t } from '../state.js';
import { db, doc, updateDoc } from '../firebase-config.js';
import { escapeHTML, getInitials, formatCurrency, renderAvatar, showToast } from '../ui.js';
import { uploadFile } from '../services/uploadService.js';

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
        const presentCount = studentAtt.filter(a => a.status === 'present' || a.status === 'late').length;
        attRate = Math.round((presentCount / studentAtt.length) * 100);
    }

    // 3. Upcoming Class Calculation
    const now = new Date();
    const dayIndex = now.getDay(); 
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const studentClass = state.classes.find(c => c.id === student?.classId || (c.studentIds || []).includes(studentId));
    let nextClass = null;
    
    if (studentClass) {
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
    { id: 'finance', label: state.lang === 'ar' ? 'الموارد المالية' : 'Financials', icon: '💰' },
    { id: 'library', label: state.lang === 'ar' ? 'المكتبة' : 'Library', icon: '📚' },
    { id: 'transfers', label: state.lang === 'ar' ? 'سجل التنقلات' : 'Transfers', icon: '🔄' }
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
    schedule: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">📅 ${state.lang === 'ar' ? 'الجدول الأسبوعي' : 'Weekly Schedule'}</h4>
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
                    const entry = state.schedules.find(s => (s.dayOfWeek === day || s.dayIndex === day) && s.timeslotId === slot.id && s.classId === cls?.id);
                    return `<td>${entry ? `<div class="sch-item"><strong>${entry.subject}</strong><span>${entry.teacherName || ''}</span></div>` : ''}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `,
    performance: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">🏆 ${state.lang === 'ar' ? 'الأداء الأكاديمي' : 'Performance'}</h4>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'المادة' : 'Subject'}</th>
                <th>${state.lang === 'ar' ? 'الدرجة' : 'Score'}</th>
                <th>${state.lang === 'ar' ? 'النسبة' : 'Percentage'}</th>
                <th>${state.lang === 'ar' ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.grades.filter(g => g.studentId === studentId).map(g => `
                <tr>
                  <td>${g.subject}</td>
                  <td>${g.score} / ${g.maxScore}</td>
                  <td><span class="badge ${g.score/g.maxScore >= 0.5 ? 'badge-success' : 'badge-danger'}">${Math.round((g.score/g.maxScore)*100)}%</span></td>
                  <td>${new Date(g.date).toLocaleDateString()}</td>
                </tr>
              `).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `,
    tasks: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">📝 ${state.lang === 'ar' ? 'المهام والواجبات' : 'Tasks & Homework'}</h4>
        <div class="homework-list">
          ${state.homework.filter(h => h.classId === cls?.id).map(hw => {
            const submission = hw.submissions?.find(s => s.studentId === studentId);
            return `
              <div class="hw-item glass-card" style="margin-bottom: 1rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong>${hw.title}</strong>
                  <span class="badge ${submission ? 'badge-success' : 'badge-warning'}">${submission ? (state.lang === 'ar' ? 'تم التسليم' : 'Submitted') : (state.lang === 'ar' ? 'معلق' : 'Pending')}</span>
                </div>
                <div class="text-muted text-sm" style="margin-top: 0.5rem;">${state.lang === 'ar' ? 'المادة:' : 'Subject:'} ${hw.subject} | ${state.lang === 'ar' ? 'الموعد:' : 'Due:'} ${hw.dueDate}</div>
              </div>
            `;
          }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    `,
    attendance: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">📋 ${state.lang === 'ar' ? 'سجل الحضور والغياب' : 'Attendance History'}</h4>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.attendance.filter(a => a.studentId === studentId).sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => `
                <tr>
                  <td>${new Date(a.date).toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-US')}</td>
                  <td>
                    <span class="status-indicator status-${a.status}"></span>
                    ${{ present: t('present'), absent: t('absent'), late: t('late'), excused: t('excused') }[a.status] || a.status}
                  </td>
                </tr>
              `).join('') || `<tr><td colspan="2" class="text-center text-muted">${t('noData')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `,
    finance: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">💰 ${state.lang === 'ar' ? 'الموقف المالي' : 'Financial Status'}</h4>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th>${state.lang === 'ar' ? 'المدفوع' : 'Paid'}</th>
                <th>${state.lang === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                <th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.fees.filter(f => f.studentId === studentId).map(f => {
                const remaining = (f.amount || 0) - (f.paidAmount || 0);
                const status = remaining <= 0 ? 'paid' : (f.paidAmount > 0 ? 'partial' : 'unpaid');
                const statusLabel = { paid: {ar:'مدفوع',en:'Paid',cls:'success'}, partial: {ar:'جزئي',en:'Partial',cls:'warning'}, unpaid: {ar:'غير مدفوع',en:'Unpaid',cls:'danger'} }[status];
                return `
                  <tr>
                    <td>${formatCurrency(f.amount)}</td>
                    <td>${formatCurrency(f.paidAmount)}</td>
                    <td style="color:var(--danger); font-weight:bold;">${formatCurrency(remaining)}</td>
                    <td><span class="badge badge-${statusLabel.cls}">${statusLabel[state.lang]}</span></td>
                  </tr>
                `;
              }).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `,
    library: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">📚 ${state.lang === 'ar' ? 'الكتب المستعارة' : 'Borrowed Books'}</h4>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'الكتاب' : 'Book'}</th>
                <th>${state.lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                <th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.borrowingRecords.filter(r => r.studentId === studentId).map(r => {
                const book = state.books.find(b => b.id === r.bookId);
                return `
                  <tr>
                    <td>${book?.title || '—'}</td>
                    <td>${r.dueDate}</td>
                    <td><span class="badge badge-${r.status === 'active' ? 'warning' : 'success'}">${r.status === 'active' ? (state.lang === 'ar' ? 'نشط' : 'Active') : (state.lang === 'ar' ? 'مُرجع' : 'Returned')}</span></td>
                  </tr>
                `;
              }).join('') || `<tr><td colspan="3" class="text-center text-muted">${t('noData')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `,
    transfers: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">🔄 ${state.lang === 'ar' ? 'سجل التنقلات' : 'Transfer History'}</h4>
        <div class="transfer-list">
          ${state.transfers.filter(t => t.studentId === studentId).sort((a, b) => new Date(b.date) - new Date(a.date)).map(tr => `
            <div class="transfer-item" style="border-left: 3px solid var(--primary); padding-left: 1rem; margin-bottom: 1.5rem; position: relative;">
              <div style="font-size: 0.8rem; color: var(--primary-light); font-weight: 600;">${new Date(tr.date).toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-US')}</div>
              <div style="margin: 0.25rem 0; font-weight: 600;">
                <span class="text-muted">${tr.fromClassName}</span> 
                <span style="margin: 0 0.5rem; opacity: 0.5;">→</span> 
                <span style="color: var(--primary);">${tr.toClassName}</span>
              </div>
              ${tr.reason ? `<div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${tr.reason}</div>` : ''}
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 0.25rem;">${state.lang === 'ar' ? 'بواسطة:' : 'By:'} ${tr.by}</div>
            </div>
          `).join('') || `<p class="text-muted">${state.lang === 'ar' ? 'لا توجد عمليات نقل مسجلة' : 'No recorded transfers'}</p>`}
        </div>
      </div>
    `
  };

  return `
    <div class="student-profile-modal">
      <div class="sp-header">
        <div class="sp-user-info">
          <div class="profile-photo-wrapper clickable" data-id="${studentId}" onclick="window.openImageViewer('${student.photoURL || ''}', '${escapeHTML(student.name)}', true)">
            ${renderAvatar(student.name, student.photoURL, 'avatar-lg')}
            <div class="photo-overlay">📷</div>
            <input type="file" id="student-photo-input" style="display:none;" accept="image/*">
          </div>
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
    if (tabBtn && tabBtn.dataset.studentId) {
      const tabId = tabBtn.dataset.tab;
      const studentId = tabBtn.dataset.studentId;
      
      const sidebar = tabBtn.closest('.sp-sidebar');
      if (!sidebar) return;

      // Update active state
      sidebar.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      
      // Update content
      const contentArea = document.getElementById('sp-tab-content');
      if (contentArea) {
        contentArea.innerHTML = '<div class="text-center p-4"><span class="spinner-sm"></span></div>';
        setTimeout(() => {
            const html = getStudentDashboardHTML(studentId, tabId);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const newContent = tempDiv.querySelector('#sp-tab-content').innerHTML;
            contentArea.innerHTML = newContent;
        }, 50);
      }
    }
  });

  // Photo Upload Handler
  document.addEventListener('click', (e) => {
    const wrapper = e.target.closest('.profile-photo-wrapper');
    if (wrapper && wrapper.querySelector('#student-photo-input')) {
        document.getElementById('student-photo-input').click();
    }
  });

  document.addEventListener('change', async (e) => {
    if (e.target.id === 'student-photo-input' && e.target.files[0]) {
        const file = e.target.files[0];
        const studentId = e.target.closest('.profile-photo-wrapper').dataset.id;
        try {
            showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
            const url = await uploadFile(file);
            await updateDoc(doc(db, 'students', studentId), { photoURL: url });
            showToast(state.lang === 'ar' ? 'تم تحديث الصورة بنجاح' : 'Photo updated successfully', 'success');
            
            // Refresh modal content
            const activeBtn = document.querySelector('.sp-tab-btn.active');
            const activeTab = activeBtn ? activeBtn.dataset.tab : 'overview';
            const modalBody = document.querySelector('.student-profile-modal')?.parentElement;
            if (modalBody) {
                modalBody.innerHTML = getStudentDashboardHTML(studentId, activeTab);
            }
        } catch (err) {
            console.error(err);
            showToast(t('errorOccurred'), 'error');
        }
    }
  });
}
