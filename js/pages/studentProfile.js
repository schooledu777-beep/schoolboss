import { state, t } from '../state.js';
import { db, doc, updateDoc } from '../firebase-config.js';
import { escapeHTML, getInitials, formatCurrency, renderAvatar, showToast, showModal, closeModal } from '../ui.js?v=20260502-photo-sync';
import { uploadFile } from '../services/uploadService.js?v=20260502-photo-sync';
import { showAdminAccountModal } from '../services/accountAdmin.js?v=20260503-admin-accounts';
import { renderCustomDataSummary } from '../services/customFields.js?v=20260506-custom-fields';
import { getClassLeaderboard, getStudentBehaviorLogs, renderBehaviorBadge } from '../services/behaviorService.js?v=20260506-behavior';

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
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-outline" id="print-report-btn" data-id="${studentId}">🖨️ ${state.lang === 'ar' ? 'طباعة البطاقة' : 'Print Report Card'}</button>
        <button class="btn btn-outline" onclick="window.history.back()">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
      </div>
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
  const behaviorLogs = getStudentBehaviorLogs(studentId, 8);
  const leaderboard = getClassLeaderboard(cls?.id, 5);
  
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
        <div class="sp-widget widget-gold">
          <span class="sp-widget-icon">🏅</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'نقاط السلوك' : 'Behavior Points'}</span>
          <span class="sp-widget-value">${Number(student.total_points || 0)}</span>
          <span class="sp-widget-footer">${renderBehaviorBadge(student)}</span>
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

      ${renderCustomDataSummary('student', student.custom_data || {})}

      <div class="sp-section-card">
        <h4 class="sp-section-title">🏆 ${state.lang === 'ar' ? 'لوحة الشرف في الصف' : 'Class Leaderboard'}</h4>
        <div class="behavior-leaderboard">
          ${leaderboard.map((item, index) => `
            <div class="behavior-leader-row ${item.id === studentId ? 'current' : ''}">
              <span class="behavior-rank">${index + 1}</span>
              <strong>${escapeHTML(item.name || '')}</strong>
              ${renderBehaviorBadge(item, true)}
            </div>
          `).join('') || `<p class="text-muted text-sm">${t('noData')}</p>`}
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">✨ ${state.lang === 'ar' ? 'سجل النقاط والسلوك' : 'Behavior Log'}</h4>
        <div class="behavior-log-list">
          ${behaviorLogs.map(log => `
            <div class="behavior-log-item ${Number(log.points || 0) >= 0 ? 'positive' : 'negative'}">
              <span>${Number(log.points || 0) >= 0 ? '+' : ''}${Number(log.points || 0)}</span>
              <div>
                <strong>${escapeHTML(log.category || '')}</strong>
                <small>${escapeHTML(log.teacher_name || '')}${log.note ? ` · ${escapeHTML(log.note)}` : ''}</small>
              </div>
            </div>
          `).join('') || `<p class="text-muted text-sm">${state.lang === 'ar' ? 'لا توجد نقاط مسجلة بعد' : 'No behavior points yet'}</p>`}
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
                    const teacher = entry ? state.teachers.find(t => t.id === entry.teacherId) : null;
                    return `<td>${entry ? `<div class="sch-item"><strong>${entry.subject}</strong><span>${entry.teacherName || teacher?.name || ''}</span></div>` : ''}</td>`;
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
            <div style="margin-top:.45rem">${renderBehaviorBadge(student)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-sm btn-outline print-id-card-btn" data-id="${studentId}">🪪 ${state.lang === 'ar' ? 'بطاقة الطالب' : 'Student ID'}</button>
          <div class="sp-status-badge">${state.lang === 'ar' ? 'طالب' : 'Student'}</div>
        </div>
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

// ========================= REPORT CARD PDF =========================
export function printStudentReportCard(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const isAr      = state.lang === 'ar';
  const cls       = state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(studentId));
  const parent    = state.parents.find(p => p.id === student.parentId);
  const metrics   = getStudentMetrics(studentId);
  const grades    = state.grades.filter(g => g.studentId === studentId);
  const fees      = state.fees.filter(f => f.studentId === studentId);
  const att       = state.attendance.filter(a => a.studentId === studentId);
  const attPresent = att.filter(a => a.status === 'present' || a.status === 'late').length;
  const attAbsent  = att.filter(a => a.status === 'absent').length;

  // Group grades by subject
  const bySubject = {};
  grades.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  });

  const gradeRows = Object.entries(bySubject).map(([subject, gs]) => {
    const avg = Math.round(gs.reduce((s, g) => s + (g.maxScore > 0 ? (g.score/g.maxScore)*100 : 0), 0) / gs.length);
    const letter = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F';
    const color  = avg >= 70 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td style="padding:.4rem .6rem;border-bottom:1px solid #eee">${subject}</td>
      <td style="padding:.4rem .6rem;border-bottom:1px solid #eee;text-align:center">${gs.length}</td>
      <td style="padding:.4rem .6rem;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${color}">${avg}%</td>
      <td style="padding:.4rem .6rem;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${color}">${letter}</td>
    </tr>`;
  }).join('');

  const totalFees = fees.reduce((s, f) => s + (f.amount||0), 0);
  const paidFees  = fees.reduce((s, f) => s + (f.paidAmount||0), 0);
  const pendFees  = totalFees - paidFees;

  const printDate = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year:'numeric', month:'long', day:'numeric' });

  const html = `
  <!DOCTYPE html>
  <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
  <head>
    <meta charset="UTF-8">
    <title>${isAr ? 'بطاقة الطالب' : 'Student Report Card'} — ${student.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: ${isAr ? "'Cairo'" : "'Inter'"}, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
      .page { max-width: 720px; margin: 0 auto; padding: 2rem; }
      .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 1rem; border-bottom: 3px solid #6366f1; margin-bottom: 1.5rem; }
      .school-name { font-size: 1.4rem; font-weight: 700; color: #6366f1; }
      .report-title { font-size: .9rem; color: #64748b; margin-top: .25rem; }
      .print-date { font-size: .75rem; color: #94a3b8; }
      .student-info-box { background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; display: flex; gap: 2rem; flex-wrap: wrap; }
      .info-block { display: flex; flex-direction: column; gap: .2rem; }
      .info-label { font-size: .72rem; opacity: .8; }
      .info-value { font-size: .95rem; font-weight: 700; }
      .metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: 1.5rem; }
      .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: .75rem; text-align: center; }
      .metric-icon { font-size: 1.4rem; }
      .metric-val { font-size: 1.25rem; font-weight: 700; color: #6366f1; margin: .2rem 0; }
      .metric-lbl { font-size: .72rem; color: #64748b; }
      .section-title { font-size: .95rem; font-weight: 700; color: #1e293b; margin-bottom: .6rem; padding-bottom: .3rem; border-bottom: 2px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
      thead th { background: #f1f5f9; padding: .45rem .6rem; font-size: .78rem; font-weight: 700; color: #475569; }
      .footer { margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: .75rem; display: flex; justify-content: space-between; font-size: .72rem; color: #94a3b8; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head>
  <body>
  <div class="page">
    <div class="header">
      <div>
        <div class="school-name">EduManage Pro</div>
        <div class="report-title">${isAr ? 'بطاقة أداء الطالب' : 'Student Report Card'}</div>
      </div>
      <div class="print-date">${printDate}</div>
    </div>

    <div class="student-info-box">
      <div class="info-block">
        <span class="info-label">${isAr?'اسم الطالب':'Student Name'}</span>
        <span class="info-value">${student.name}</span>
      </div>
      <div class="info-block">
        <span class="info-label">${isAr?'الصف':'Class'}</span>
        <span class="info-value">${cls?.name || '—'}</span>
      </div>
      <div class="info-block">
        <span class="info-label">${isAr?'ولي الأمر':'Parent'}</span>
        <span class="info-value">${parent?.name || '—'}</span>
      </div>
      <div class="info-block">
        <span class="info-label">${isAr?'البريد الإلكتروني':'Email'}</span>
        <span class="info-value">${student.email || '—'}</span>
      </div>
    </div>

    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-icon">🏆</div>
        <div class="metric-val">${metrics.gpa}%</div>
        <div class="metric-lbl">${isAr?'المعدل العام':'Overall GPA'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon">📋</div>
        <div class="metric-val">${metrics.attRate}%</div>
        <div class="metric-lbl">${isAr?'نسبة الحضور':'Attendance'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon">✅</div>
        <div class="metric-val">${attPresent}</div>
        <div class="metric-lbl">${isAr?'أيام الحضور':'Present Days'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon">❌</div>
        <div class="metric-val">${attAbsent}</div>
        <div class="metric-lbl">${isAr?'أيام الغياب':'Absent Days'}</div>
      </div>
    </div>

    ${gradeRows ? `
    <div class="section-title">📝 ${isAr?'الدرجات حسب المادة':'Grades by Subject'}</div>
    <table>
      <thead><tr>
        <th style="text-align:${isAr?'right':'left'}">${isAr?'المادة':'Subject'}</th>
        <th style="text-align:center">${isAr?'الاختبارات':'Tests'}</th>
        <th style="text-align:center">${isAr?'المتوسط':'Average'}</th>
        <th style="text-align:center">${isAr?'التقدير':'Grade'}</th>
      </tr></thead>
      <tbody>${gradeRows}</tbody>
    </table>` : ''}

    ${fees.length > 0 ? `
    <div class="section-title">💰 ${isAr?'الرسوم الدراسية':'Financial Summary'}</div>
    <table>
      <thead><tr>
        <th style="text-align:${isAr?'right':'left'}">${isAr?'البيان':'Item'}</th>
        <th style="text-align:center">${isAr?'المبلغ':'Amount'}</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:.4rem .6rem;border-bottom:1px solid #eee">${isAr?'إجمالي الرسوم':'Total Fees'}</td><td style="padding:.4rem .6rem;border-bottom:1px solid #eee;text-align:center;font-weight:600">SAR ${totalFees.toLocaleString()}</td></tr>
        <tr><td style="padding:.4rem .6rem;border-bottom:1px solid #eee">${isAr?'المدفوع':'Paid'}</td><td style="padding:.4rem .6rem;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:#10b981">SAR ${paidFees.toLocaleString()}</td></tr>
        <tr><td style="padding:.4rem .6rem">${isAr?'المتبقي':'Remaining'}</td><td style="padding:.4rem .6rem;text-align:center;font-weight:700;color:${pendFees > 0 ? '#ef4444' : '#10b981'}">SAR ${pendFees.toLocaleString()}</td></tr>
      </tbody>
    </table>` : ''}

    <div class="footer">
      <span>EduManage Pro — ${isAr?'نظام إدارة المدارس':'School Management System'}</span>
      <span>${isAr?'تاريخ الطباعة:':'Printed:'} ${printDate}</span>
    </div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
  else showToast(isAr ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups to print', 'warning');
}

export function attachStudentProfileEvents(modalElement) {
  if (!modalElement) return;

  if (state.profile?.role === 'admin' && !modalElement.querySelector('.manage-profile-account')) {
    const wrapper = modalElement.querySelector('.profile-photo-wrapper');
    const studentId = wrapper?.dataset.id;
    const statusBadge = modalElement.querySelector('.sp-status-badge');
    if (studentId && statusBadge?.parentElement) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline manage-profile-account';
      btn.dataset.role = 'student';
      btn.dataset.id = studentId;
      btn.textContent = state.lang === 'ar' ? '🔐 إدارة الحساب' : '🔐 Account';
      statusBadge.parentElement.insertBefore(btn, statusBadge);
    }
  }

  // Print report card from full page view
  document.getElementById('print-report-btn')?.addEventListener('click', e => {
    printStudentReportCard(e.currentTarget.dataset.id);
  });

  modalElement.addEventListener('click', e => {
    const printBtn = e.target.closest('.print-id-card-btn');
    if (printBtn) {
      showStudentCardModalPreview(printBtn.dataset.id);
      return;
    }

    const accountBtn = e.target.closest('.manage-profile-account');
    if (accountBtn?.dataset.role === 'student') {
      const student = state.students.find(s => s.id === accountBtn.dataset.id);
      if (student) showAdminAccountModal(student, 'student');
      return;
    }

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
      const contentArea = modalElement.querySelector('#sp-tab-content');
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

  modalElement.addEventListener('change', async (e) => {
    if (e.target.id === 'student-photo-input' && e.target.files[0]) {
        const file = e.target.files[0];
        const studentId = modalElement.querySelector('.profile-photo-wrapper').dataset.id;
        try {
            showToast(state.lang === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...', 'info');
            const url = await uploadFile(file, 'students/photos');
            await updateDoc(doc(db, 'students', studentId), { photoURL: url });
            const cachedStudent = state.students.find(s => s.id === studentId);
            if (cachedStudent) cachedStudent.photoURL = url;
            showToast(state.lang === 'ar' ? 'تم تحديث الصورة بنجاح' : 'Photo updated successfully', 'success');
            
            // Refresh modal content
            const activeBtn = modalElement.querySelector('.sp-tab-btn.active');
            const activeTab = activeBtn ? activeBtn.dataset.tab : 'overview';
            modalElement.innerHTML = getStudentDashboardHTML(studentId, activeTab);
        } catch (err) {
            console.error(err);
            showToast(t('errorOccurred'), 'error');
        }
    }
  });
}

export function showStudentCardModalPreview(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const cls = state.classes.find(c => c.id === student.classId || (c.studentIds || []).includes(studentId));

  const cardHTML = `
    <div class="id-card-container">
      <div id="student-id-card" class="id-card">
        <div class="id-card-header">
          <div class="id-card-logo">EduManage Pro</div>
          <div class="id-card-school">${state.lang === 'ar' ? 'أكاديمية المستقبل التعليمية' : 'FUTURE ACADEMY'}</div>
        </div>
        <div class="id-card-body">
          <div class="id-card-photo-container">
            <div class="id-card-photo">
              ${student.photoURL ? `<img src="${escapeHTML(student.photoURL)}" alt="${escapeHTML(student.name)}" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div style="font-size: 4rem; display: none; align-items: center; justify-content: center; height: 100%; background: #f8fafc; color: #cbd5e1;">👤</div>` : `<div style="font-size: 4rem; display: flex; align-items: center; justify-content: center; height: 100%; background: #f8fafc; color: #cbd5e1;">👤</div>`}
            </div>
            <div class="id-verified-badge">✓</div>
          </div>
          
          <h2 class="id-card-name">${escapeHTML(student.name)}</h2>
          <div class="id-card-role">${state.lang === 'ar' ? 'طالب معتمد' : 'CERTIFIED STUDENT'}</div>
          
          <div class="id-card-info">
            <div class="id-info-row">
              <span class="id-info-label">${state.lang === 'ar' ? 'رقم القيد' : 'Student ID'}</span>
              <span class="id-info-value">${student.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="id-info-row">
              <span class="id-info-label">${state.lang === 'ar' ? 'الصف الدراسي' : 'Grade / Class'}</span>
              <span class="id-info-value">${cls?.name || '—'}</span>
            </div>
            <div class="id-info-row" style="border-bottom: none;">
              <span class="id-info-label">${state.lang === 'ar' ? 'العام الدراسي' : 'Academic Year'}</span>
              <span class="id-info-value">2026/2027</span>
            </div>
          </div>
        </div>
        <div class="id-card-footer">
          <div class="id-qr-container">
            <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; color: #cbd5e1; border: 1px dashed #cbd5e1;">QR</div>
          </div>
          <div class="id-signature">${state.lang === 'ar' ? 'توقيع المدير' : 'Principal Sign'}</div>
        </div>
      </div>
      
      <div class="modal-actions" style="display: flex; gap: 1rem; width: 100%; justify-content: center;">
        <button class="btn btn-primary" onclick="window.print()">🖨️ ${state.lang === 'ar' ? 'طباعة' : 'Print'}</button>
        <button class="btn btn-success" id="export-pdf-btn">📄 ${state.lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}</button>
        <button class="btn btn-outline" onclick="closeModal()">${state.lang === 'ar' ? 'إغلاق' : 'Close'}</button>
      </div>
    </div>
  `;

  showModal(state.lang === 'ar' ? 'معاينة بطاقة الطالب' : 'Student ID Card Preview', cardHTML, { wide: false });

  document.getElementById('export-pdf-btn').onclick = () => {
    const element = document.getElementById('student-id-card');
    const opt = {
      margin: 0,
      filename: `student_id_${studentId.substring(0, 8)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: [85, 120], orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };
}
