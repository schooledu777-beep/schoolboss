import { state, t } from '../state.js';
import { db, collection, getDocs, query, where, addDoc, doc, setDoc, writeBatch } from '../firebase-config.js';
import { formatCurrency, showToast, showConfirm, renderStatsCard, renderCard, renderBadge } from '../ui.js';
import { adminCreateUser } from '../auth.js';

export function renderDashboard() {
  const role = state.profile?.role || 'student';
  const renderers = { admin: renderAdminDash, teacher: renderTeacherDash, parent: renderParentDash, student: renderStudentDash };
  return (renderers[role] || renderStudentDash)();
}

// ── Attendance trend bar chart (last 7 school days, pure SVG) ──────────────
function renderAttendanceChart(attendance, lang) {
  const now = new Date();
  const days = [];
  for (let daysBack = 6; daysBack >= 0; daysBack--) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    const dayNum = d.getDay();
    if (dayNum === 5 || dayNum === 6) continue; // skip Fri/Sat
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' });
    const dayAtt = attendance.filter(a => a.date === dateStr);
    const present = dayAtt.filter(a => a.status === 'present').length;
    const total   = dayAtt.length;
    const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
    days.push({ label, pct, present, total });
  }

  if (days.length === 0) return `<p class="text-muted text-center" style="padding:2rem">${t('noData')}</p>`;

  const W = 340, H = 160, PAD = 30, BAR_W = Math.floor((W - PAD * 2) / days.length) - 6;
  const bars = days.map((d, i) => {
    const barH = Math.max(4, Math.round((d.pct / 100) * (H - PAD - 20)));
    const x    = PAD + i * ((W - PAD * 2) / days.length) + 3;
    const y    = H - PAD - barH;
    const fill = d.pct >= 90 ? '#10b981' : d.pct >= 70 ? '#f59e0b' : '#ef4444';
    return `
      <rect x="${x}" y="${y}" width="${BAR_W}" height="${barH}" rx="4" fill="${fill}" opacity=".85"/>
      <text x="${x + BAR_W / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.pct}%</text>
      <text x="${x + BAR_W / 2}" y="${H - PAD + 12}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.label}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="overflow:visible">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--border)" stroke-width="1"/>
      ${bars}
    </svg>`;
}

// ── Fee collection donut chart (pure SVG) ──────────────────────────────────
function renderFeeDonut(fees, lang) {
  const total  = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paid   = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pending = total - paid;
  if (total === 0) return `<p class="text-muted text-center" style="padding:2rem">${t('noData')}</p>`;

  const pct = Math.round((paid / total) * 100);
  const r = 54, cx = 80, cy = 80, strokeW = 16;
  const circ = 2 * Math.PI * r;
  const dashPaid    = (paid    / total) * circ;
  const dashPending = (pending / total) * circ;
  const paidColor   = '#10b981';
  const pendColor   = '#ef4444';

  return `
    <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
      <svg viewBox="0 0 160 160" width="130" style="flex-shrink:0">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${pendColor}" stroke-width="${strokeW}"
          stroke-dasharray="${circ}" stroke-dashoffset="0"
          transform="rotate(-90 ${cx} ${cy})" opacity=".35"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${paidColor}" stroke-width="${strokeW}"
          stroke-dasharray="${dashPaid} ${circ}"
          stroke-dashoffset="0"
          transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="700" fill="var(--text)">${pct}%</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${lang === 'ar' ? 'مُحصَّل' : 'collected'}</text>
      </svg>
      <div style="display:flex;flex-direction:column;gap:.6rem;flex:1;min-width:120px">
        <div class="donut-legend-item">
          <span class="donut-dot" style="background:${paidColor}"></span>
          <div>
            <div style="font-size:.8rem;color:var(--text-muted)">${lang === 'ar' ? 'المدفوع' : 'Paid'}</div>
            <div style="font-weight:700;font-size:.9rem">${formatCurrency(paid)}</div>
          </div>
        </div>
        <div class="donut-legend-item">
          <span class="donut-dot" style="background:${pendColor}"></span>
          <div>
            <div style="font-size:.8rem;color:var(--text-muted)">${lang === 'ar' ? 'المتبقي' : 'Pending'}</div>
            <div style="font-weight:700;font-size:.9rem">${formatCurrency(pending)}</div>
          </div>
        </div>
        <div class="donut-legend-item">
          <span class="donut-dot" style="background:var(--border)"></span>
          <div>
            <div style="font-size:.8rem;color:var(--text-muted)">${lang === 'ar' ? 'الإجمالي' : 'Total'}</div>
            <div style="font-weight:700;font-size:.9rem">${formatCurrency(total)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderAdminDash() {
  const { students, teachers, classes, attendance, fees, schoolType, lang, profile, announcements } = state;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = attendance.filter(a => a.date === todayStr);
  const presentCount = todayAtt.filter(a => a.status === 'present').length;
  const attRate = todayAtt.length > 0 ? Math.round((presentCount / todayAtt.length) * 100) : 0;

  const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);

  const stats = [
    renderStatsCard(t('totalStudents'), students.length, '👨‍🎓', 'gradient-purple'),
    renderStatsCard(t('totalTeachers'), teachers.length, '👨‍🏫', 'gradient-cyan'),
    renderStatsCard(t('totalClasses'), classes.length, '🏫', 'gradient-green'),
    renderStatsCard(t('attendanceRate'), `${attRate}%`, '📋', 'gradient-amber')
  ];

  if (schoolType === 'private') {
    stats.push(renderStatsCard(t('revenue'), formatCurrency(paidFees), '💰', 'gradient-emerald'));
    stats.push(renderStatsCard(t('pending'), formatCurrency(totalFees - paidFees), '⏰', 'gradient-red'));
  }

  const actions = [
    { href: '#students', icon: '👨‍🎓', label: lang === 'ar' ? 'إضافة طالب' : 'Add Student' },
    { href: '#teachers', icon: '👨‍🏫', label: lang === 'ar' ? 'إضافة معلم' : 'Add Teacher' },
    { href: '#attendance', icon: '📋', label: lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance' },
    { href: '#announcements', icon: '📢', label: lang === 'ar' ? 'إعلان جديد' : 'New Announcement' },
    { id: 'btn-mock-data', icon: '🧪', label: lang === 'ar' ? 'بيانات تجريبية' : 'Mock Data' },
    { id: 'btn-clear-dash', icon: '🗑️', label: lang === 'ar' ? 'مسح البيانات' : 'Clear Data', className: 'danger' }
  ];

  const actionsHtml = actions.map(a => `
    <a href="${a.href || '#'}" ${a.id ? `id="${a.id}"` : ''} class="quick-action-btn ${a.className || ''}">
      <span>${a.icon}</span><span>${a.label}</span>
    </a>`).join('');

  const recentAnnsHtml = announcements.slice(0, 5).map(a => `
    <div class="recent-item">
      <span class="recent-icon">📢</span>
      <div><strong>${a.title}</strong><p class="text-muted text-sm">${a.body?.substring(0, 60) || ''}...</p></div>
    </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`;

  // Charts row (only show if data exists)
  const chartsRow = attendance.length > 0 || fees.length > 0 ? `
    <div class="grid-2" style="margin-bottom:1.5rem">
      ${renderCard(lang === 'ar' ? '📊 نسبة الحضور (آخر أسبوع)' : '📊 Attendance Trend (Last Week)',
        renderAttendanceChart(attendance, lang))}
      ${schoolType === 'private' && fees.length > 0
        ? renderCard(lang === 'ar' ? '💰 تحصيل الرسوم' : '💰 Fee Collection', renderFeeDonut(fees, lang))
        : ''}
    </div>` : '';

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('dashboard')}</h2>
        <p class="text-muted">${lang === 'ar' ? 'مرحباً بك، ' : 'Welcome, '}${profile?.name}</p>
      </div>
    </div>

    <div class="stats-grid">
      ${stats.join('')}
    </div>

    ${chartsRow}

    <div class="grid-2">
      ${renderCard(lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions', `<div class="quick-actions">${actionsHtml}</div>`)}
      ${renderCard(lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements', `<div class="recent-list">${recentAnnsHtml}</div>`)}
    </div>
  </div>`;
}

function renderTeacherDash() {
  const teacherId = state.profile?.uid;
  const { classes, attendance, schedules, lang, profile } = state;
  const myClasses = classes.filter(c => c.teacherId === teacherId);
  const myStudentIds = [...new Set(myClasses.flatMap(c => c.studentIds || []))];
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = attendance.filter(a => a.date === todayStr && myStudentIds.includes(a.studentId));
  const presentCount = todayAtt.filter(a => a.status === 'present').length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dailySchedule = schedules.filter(s => s.teacherId === teacherId && s.day === today);

  const myHomework = state.homework?.filter(h => h.teacherId === teacherId) || [];

  const stats = [
    renderStatsCard(t('myClasses'), myClasses.length, '🏫', 'gradient-purple'),
    renderStatsCard(t('totalStudents'), myStudentIds.length, '👨‍🎓', 'gradient-cyan'),
    renderStatsCard(lang === 'ar' ? 'الواجبات المسندة' : 'Assigned Homework', myHomework.length, '📚', 'gradient-green')
  ];

  const scheduleHtml = dailySchedule.map(s => `
    <div class="recent-item">
      <span class="recent-icon">⏰</span>
      <div>
        <strong>${s.subject}</strong>
        <p class="text-muted text-sm">${s.startTime || ''} - ${s.endTime || ''} | ${classes.find(c => c.id === s.classId)?.name || ''}</p>
      </div>
    </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`;

  const actions = [
    { href: '#attendance', icon: '📋', label: lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance' },
    { href: '#report-cards', icon: '📝', label: lang === 'ar' ? 'إدخال درجات' : 'Enter Grades' },
    { id: 'bulk-grading-btn', icon: '📊', label: t('bulkGrading') },
    { href: '#messages', icon: '✉️', label: lang === 'ar' ? 'إرسال رسالة' : 'Send Message' }
  ];

  const actionsHtml = actions.map(a => `
    <a href="${a.href || '#'}" ${a.id ? `id="${a.id}"` : ''} class="quick-action-btn">
      <span>${a.icon}</span><span>${a.label}</span>
    </a>`).join('');

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('dashboard')}</h2>
        <p class="text-muted">${lang === 'ar' ? 'مرحباً أستاذ/ة ' : 'Welcome, '}${profile?.name}</p>
      </div>
    </div>
    
    <div class="stats-grid">
      ${stats.join('')}
    </div>
    
    <div class="grid-2">
      ${renderCard(t('todaySchedule'), `<div class="recent-list">${scheduleHtml}</div>`)}
      ${renderCard(lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions', `<div class="quick-actions">${actionsHtml}</div>`)}
    </div>
  </div>`;
}

function renderParentDash() {
  const parentId = state.profile?.uid;
  const { students, fees, profile, lang, notificationLogs } = state;
  const myStudents = students.filter(s => profile?.studentIds?.includes(s.id) || s.parentId === parentId);
  const childrenIds = myStudents.map(s => s.id);
  const unpaidFees = fees.filter(f => childrenIds.includes(f.studentId) && f.status === 'unpaid');
  const totalBalance = unpaidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const pendingNotifs = notificationLogs.filter(n => n.recipientId === parentId && n.status === 'pending');

  const stats = [
    renderStatsCard(t('balanceDue'), formatCurrency(totalBalance), '💰', 'gradient-purple'),
    renderStatsCard(t('myChildren'), myStudents.length, '👨‍👩‍👧', 'gradient-cyan'),
    renderStatsCard(lang === 'ar' ? 'تنبيهات جديدة' : 'New Alerts', pendingNotifs.length, '🔔', 'gradient-green')
  ];

  const childrenHtml = myStudents.map(s => {
    const cls = state.classes.find(c => c.id === s.classId);
    return `
      <div class="child-card glass-card" style="padding:1rem; text-align:center; display:flex; flex-direction:column; align-items:center; gap:.5rem;">
        <div class="avatar avatar-md gradient-purple">${s.name?.[0] || '?'}</div>
        <h4 style="margin:.25rem 0;">${s.name}</h4>
        <p class="text-muted text-sm">${cls?.name || ''}</p>
        <div style="display:flex; gap:.5rem; margin-top:.5rem;">
          <a href="#report-cards" class="btn btn-sm btn-outline">📝</a>
          <a href="#attendance" class="btn btn-sm btn-outline">📋</a>
        </div>
      </div>`;
  }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`;

  const notifsHtml = notificationLogs.filter(n => n.recipientId === parentId).slice(0, 5).map(n => `
    <div class="recent-item">
      <span class="recent-icon">🔔</span>
      <div><strong>${n.title}</strong><p class="text-muted text-sm">${n.message}</p></div>
    </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('dashboard')}</h2>
        <p class="text-muted">${lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${profile?.name}</p>
      </div>
    </div>
    
    <div class="stats-grid">
      ${stats.join('')}
    </div>

    <div class="grid-2">
      ${renderCard(t('myChildren'), `<div class="children-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem;">${childrenHtml}</div>`)}
      ${renderCard(t('notificationHistory'), `<div class="recent-list">${notifsHtml}</div>`)}
    </div>
  </div>`;
}

function renderStudentDash() {
  const { rewards, homework, profile, lang, announcements, schedules } = state;
  const myRewards = rewards.filter(r => r.studentId === profile?.uid);
  const totalPoints = myRewards.reduce((s, r) => s + (r.points || 0), 0);
  const myHomework = homework.filter(h => {
    const cls = state.classes.find(c => c.studentIds?.includes(profile?.uid));
    return cls && h.classId === cls.id;
  });
  const pendingHw = myHomework.filter(h => !h.submissions?.find(s => s.studentId === profile?.uid));

  const stats = [
    renderStatsCard(lang === 'ar' ? 'نقاطي' : 'My Points', totalPoints, '⭐', 'gradient-purple'),
    renderStatsCard(lang === 'ar' ? 'واجبات معلقة' : 'Pending Homework', pendingHw.length, '📚', 'gradient-cyan'),
    renderStatsCard(t('myRewards'), myRewards.length, '🏆', 'gradient-green')
  ];

  const actions = [
    { href: '#schedule', icon: '📅', label: t('mySchedule') },
    { href: '#report-cards', icon: '📝', label: t('reportCards') }
  ];

  const actionsHtml = actions.map(a => `
    <a href="${a.href}" class="quick-action-btn">
      <span>${a.icon}</span><span>${a.label}</span>
    </a>`).join('');

  const annsHtml = announcements.slice(0, 4).map(a => `
    <div class="recent-item">
      <span class="recent-icon">📢</span>
      <div><strong>${a.title}</strong></div>
    </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${t('dashboard')}</h2>
        <p class="text-muted">${lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${profile?.name}</p>
      </div>
    </div>
    
    <div class="stats-grid">
      ${stats.join('')}
    </div>

    <div class="grid-2">
      ${renderCard(lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions', `<div class="quick-actions">${actionsHtml}</div>`)}
      ${renderCard(lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements', `<div class="recent-list">${annsHtml}</div>`)}
    </div>
  </div>`;
}

export function attachDashboardEvents() {
  // Clear Data Button
  document.getElementById('btn-clear-dash')?.addEventListener('click', (e) => {
    e.preventDefault();
    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) clearBtn.click();
    else {
      // Fallback implementation if settings page not loaded
      const isAr = state.lang === 'ar';
      showConfirm(
        isAr ? 'مسح كافة البيانات' : 'Clear All Data',
        isAr ? 'سيتم حذف كافة الطلاب والمعلمين والصفوف والبيانات الأخرى نهائياً. هل أنت متأكد؟' : 'All students, teachers, classes, and other data will be permanently deleted. Are you sure?',
        async () => {
          try {
            showToast(isAr ? 'جاري مسح البيانات...' : 'Clearing data...', 'info');
            const collectionsToClear = [
              'students', 'teachers', 'parents', 'classes', 'subjects', 
              'attendance', 'grades', 'schedules', 'fees', 'announcements', 
              'messages', 'homework', 'rewards', 'transfers', 'academic_alerts', 
              'salary_slips', 'leaves', 'books', 'borrowing_records'
            ];
            
            for (const collName of collectionsToClear) {
              const snapshot = await getDocs(collection(db, collName));
              const batch = writeBatch(db);
              snapshot.docs.forEach(d => {
                // Preserve admin profiles
                if ((collName === 'teachers' || collName === 'parents') && d.data().email === state.profile?.email) return;
                batch.delete(d.ref);
              });
              await batch.commit();
            }
            showToast(isAr ? 'تم مسح البيانات بنجاح' : 'Data cleared successfully', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
            console.error(err);
            showToast(isAr ? 'حدث خطأ أثناء المسح' : 'Error clearing data', 'error');
          }
        }
      );
    }
  });

  document.getElementById('btn-mock-data')?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const isAr = state.lang === 'ar';
    const msg = isAr
      ? 'سيتم إنشاء بيانات تجريبية موسعة: معلمين، أولياء أمور، طلاب، صفوف، جداول، حضور وغياب، درجات ورسوم. هل تريد المتابعة؟'
      : 'Create expanded sample data: teachers, parents, students, classes, schedules, attendance, grades, and fees?';
    if (!confirm(msg)) return;

    const btn = e.currentTarget;
    const oldHtml = btn.innerHTML;
    const setProgress = (text) => {
      btn.innerHTML = `<span>...</span><span>${text}</span>`;
    };
    btn.style.pointerEvents = 'none';

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const seed = 'expanded-mock-v2';
      const password = '123456';
      const classIds = Array.from({ length: 6 }, (_, i) => `mock-class-${String(i + 1).padStart(2, '0')}`);
      const phone = (i) => `050${String(7000000 + i).padStart(7, '0')}`;
      const dateOffset = (daysBack) => {
        const d = new Date(now);
        d.setDate(d.getDate() - daysBack);
        return d.toISOString().split('T')[0];
      };
      const weightedStatus = (studentIndex, dayIndex) => {
        const value = (studentIndex * 11 + dayIndex * 7) % 100;
        if (value < 78) return 'present';
        if (value < 88) return 'late';
        if (value < 95) return 'absent';
        return 'excused';
      };

      const teacherProfiles = [
        { name: 'Teacher 01 - Mathematics', email: 'teacher01@school.test', subjects: ['Mathematics', 'Physics'], baseSalary: 5200 },
        { name: 'Teacher 02 - Arabic', email: 'teacher02@school.test', subjects: ['Arabic', 'Islamic Studies'], baseSalary: 5000 },
        { name: 'Teacher 03 - English', email: 'teacher03@school.test', subjects: ['English'], baseSalary: 5100 },
        { name: 'Teacher 04 - Science', email: 'teacher04@school.test', subjects: ['Science', 'Biology'], baseSalary: 5300 },
        { name: 'Teacher 05 - Social Studies', email: 'teacher05@school.test', subjects: ['History', 'Geography'], baseSalary: 4900 },
        { name: 'Teacher 06 - Computer', email: 'teacher06@school.test', subjects: ['Computer Science'], baseSalary: 5400 },
        { name: 'Teacher 07 - Art', email: 'teacher07@school.test', subjects: ['Art', 'Activities'], baseSalary: 4700 },
        { name: 'Teacher 08 - PE', email: 'teacher08@school.test', subjects: ['Physical Education'], baseSalary: 4700 }
      ].map((teacher, index) => ({ ...teacher, phone: phone(index + 1), role: 'teacher' }));

      const parentProfiles = Array.from({ length: 12 }, (_, index) => ({
        name: `Parent ${String(index + 1).padStart(2, '0')}`,
        email: `parent${String(index + 1).padStart(2, '0')}@school.test`,
        phone: phone(index + 31),
        role: 'parent'
      }));

      const studentProfiles = Array.from({ length: 36 }, (_, index) => ({
        name: `Student ${String(index + 1).padStart(2, '0')}`,
        email: `student${String(index + 1).padStart(2, '0')}@school.test`,
        phone: phone(index + 61),
        role: 'student',
        parentIndex: Math.floor(index / 3),
        classId: classIds[index % classIds.length],
        grade: `Grade ${Math.floor((index % classIds.length) / 2) + 1}`
      }));

      const ensureUser = async (profile, role, existingList, fallbackId) => {
        try {
          return await adminCreateUser(profile.email, password, role, profile.name);
        } catch (err) {
          const existing = existingList?.find((user) => user.email === profile.email);
          if (existing?.id || existing?.uid) return existing.id || existing.uid;
          console.warn(`Using local mock id for ${profile.email}:`, err);
          return fallbackId;
        }
      };

      setProgress(isAr ? 'إنشاء الحسابات...' : 'Creating accounts...');
      const teacherIds = [];
      for (const [index, teacher] of teacherProfiles.entries()) {
        teacherIds.push(await ensureUser(teacher, 'teacher', state.teachers, `mock-teacher-${String(index + 1).padStart(2, '0')}`));
      }

      const parentIds = [];
      for (const [index, parent] of parentProfiles.entries()) {
        parentIds.push(await ensureUser(parent, 'parent', state.parents, `mock-parent-${String(index + 1).padStart(2, '0')}`));
      }

      const studentIds = [];
      for (const [index, student] of studentProfiles.entries()) {
        studentIds.push(await ensureUser(student, 'student', state.students, `mock-student-${String(index + 1).padStart(2, '0')}`));
      }

      const subjects = [
        { id: 'mock-subject-math', name: 'Mathematics', code: 'MATH' },
        { id: 'mock-subject-arabic', name: 'Arabic', code: 'ARB' },
        { id: 'mock-subject-english', name: 'English', code: 'ENG' },
        { id: 'mock-subject-science', name: 'Science', code: 'SCI' },
        { id: 'mock-subject-history', name: 'History', code: 'HIS' },
        { id: 'mock-subject-geography', name: 'Geography', code: 'GEO' },
        { id: 'mock-subject-computer', name: 'Computer Science', code: 'ICT' },
        { id: 'mock-subject-art', name: 'Art', code: 'ART' },
        { id: 'mock-subject-pe', name: 'Physical Education', code: 'PE' }
      ];

      const timeslots = [
        { id: 'mock-slot-1', startTime: '08:00', endTime: '08:45' },
        { id: 'mock-slot-2', startTime: '08:50', endTime: '09:35' },
        { id: 'mock-slot-3', startTime: '09:45', endTime: '10:30' },
        { id: 'mock-slot-4', startTime: '10:35', endTime: '11:20' },
        { id: 'mock-slot-5', startTime: '11:35', endTime: '12:20' },
        { id: 'mock-slot-6', startTime: '12:25', endTime: '13:10' }
      ];

      const writeOps = [];
      const queueSet = (collectionName, id, data) => {
        writeOps.push({
          ref: doc(db, collectionName, id),
          data: { ...data, id, mockSeed: seed, updatedAt: nowIso }
        });
      };

      teacherProfiles.forEach((teacher, index) => {
        const id = teacherIds[index];
        queueSet('users', id, { email: teacher.email, role: 'teacher', name: teacher.name, uid: id, createdAt: nowIso });
        queueSet('teachers', id, { ...teacher, uid: id, createdAt: nowIso });
      });

      parentProfiles.forEach((parent, index) => {
        const id = parentIds[index];
        const studentIdsForParent = studentIds.filter((_, studentIndex) => studentProfiles[studentIndex].parentIndex === index);
        queueSet('users', id, { email: parent.email, role: 'parent', name: parent.name, uid: id, studentIds: studentIdsForParent, createdAt: nowIso });
        queueSet('parents', id, { ...parent, uid: id, studentIds: studentIdsForParent, createdAt: nowIso });
      });

      studentProfiles.forEach((student, index) => {
        const id = studentIds[index];
        queueSet('users', id, { email: student.email, role: 'student', name: student.name, uid: id, parentId: parentIds[student.parentIndex], createdAt: nowIso });
        queueSet('students', id, {
          name: student.name,
          email: student.email,
          phone: student.phone,
          role: 'student',
          uid: id,
          parentId: parentIds[student.parentIndex],
          classId: student.classId,
          grade: student.grade,
          status: 'active',
          createdAt: nowIso
        });
      });

      subjects.forEach((subject) => queueSet('subjects', subject.id, subject));
      timeslots.forEach((slot, index) => queueSet('timeslots', slot.id, { ...slot, order: index + 1 }));

      const classes = classIds.map((id, index) => {
        const gradeNumber = Math.floor(index / 2) + 1;
        const section = index % 2 === 0 ? 'A' : 'B';
        return {
          id,
          name: `Grade ${gradeNumber} - ${section}`,
          grade: `Grade ${gradeNumber}`,
          teacherId: teacherIds[index % teacherIds.length],
          studentIds: studentIds.filter((_, studentIndex) => studentProfiles[studentIndex].classId === id),
          createdAt: nowIso
        };
      });
      classes.forEach((cls) => queueSet('classes', cls.id, cls));

      setProgress(isAr ? 'إنشاء الجداول والحضور...' : 'Building schedules and attendance...');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
      classes.forEach((cls, classIndex) => {
        for (let dayOfWeek = 0; dayOfWeek < 5; dayOfWeek += 1) {
          timeslots.forEach((slot, slotIndex) => {
            const subject = subjects[(classIndex + dayOfWeek + slotIndex) % subjects.length];
            const teacherId = teacherIds[(classIndex + dayOfWeek + slotIndex) % teacherIds.length];
            queueSet('schedules', `mock-schedule-${cls.id}-${dayOfWeek}-${slot.id}`, {
              classId: cls.id,
              dayOfWeek,
              day: dayNames[dayOfWeek],
              timeslotId: slot.id,
              subject: subject.name,
              teacherId,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: `${100 + classIndex}${slotIndex + 1}`
            });
          });
        }
      });

      const schoolDates = [];
      for (let daysBack = 0; schoolDates.length < 14 && daysBack < 24; daysBack += 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - daysBack);
        if (![5, 6].includes(d.getDay())) schoolDates.push(dateOffset(daysBack));
      }

      studentIds.forEach((studentId, studentIndex) => {
        const student = studentProfiles[studentIndex];
        schoolDates.forEach((date, dayIndex) => {
          queueSet('attendance', `mock-attendance-${studentId}-${date}`, {
            studentId,
            classId: student.classId,
            date,
            status: weightedStatus(studentIndex, dayIndex),
            teacherId: teacherIds[(studentIndex + dayIndex) % teacherIds.length]
          });
        });
      });

      studentIds.forEach((studentId, studentIndex) => {
        subjects.slice(0, 5).forEach((subject, subjectIndex) => {
          ['quiz', 'midterm', 'homework', 'final'].forEach((examType, examIndex) => {
            const score = 58 + ((studentIndex * 9 + subjectIndex * 7 + examIndex * 5) % 43);
            queueSet('grades', `mock-grade-${studentId}-${subject.code}-${examType}`, {
              studentId,
              subject: subject.name,
              examType,
              score,
              maxScore: 100,
              teacherId: teacherIds[(studentIndex + subjectIndex) % teacherIds.length],
              date: schoolDates[(subjectIndex + examIndex) % schoolDates.length]
            });
          });
        });
      });

      studentIds.forEach((studentId, studentIndex) => {
        const amount = 5000 + ((studentIndex % 3) * 500);
        const paidAmount = studentIndex % 4 === 0 ? amount : studentIndex % 4 === 1 ? Math.round(amount * 0.55) : 0;
        queueSet('fees', `mock-fee-${studentId}-term-1`, {
          studentId,
          amount,
          paidAmount,
          status: paidAmount >= amount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
          dueDate: '2026-05-15'
        });
      });

      [
        { id: 'mock-announcement-exams', title: 'Midterm exam schedule', body: 'Midterm exams are available in the sample schedule for testing.' },
        { id: 'mock-announcement-attendance', title: 'Attendance review', body: 'Sample attendance includes present, late, absent, and excused records.' },
        { id: 'mock-announcement-fees', title: 'Fee reminders', body: 'Sample fee records include paid, partial, and unpaid students.' }
      ].forEach((announcement) => {
        queueSet('announcements', announcement.id, { ...announcement, createdAt: nowIso, authorId: state.profile?.uid || null });
      });

      setProgress(isAr ? 'حفظ البيانات...' : 'Saving data...');
      for (let i = 0; i < writeOps.length; i += 400) {
        const batch = writeBatch(db);
        writeOps.slice(i, i + 400).forEach((op) => batch.set(op.ref, op.data, { merge: true }));
        await batch.commit();
      }

      showToast(isAr ? 'تم إنشاء البيانات التجريبية الموسعة بنجاح' : 'Expanded sample data created successfully', 'success');
      btn.innerHTML = oldHtml;
      btn.style.pointerEvents = 'auto';
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Mock data fatal error:', err);
      const details = err?.code || err?.message || '';
      showToast(isAr ? `تعذر حفظ البيانات التجريبية: ${details}` : `Error adding mock data: ${details}`, 'error');
      btn.innerHTML = oldHtml;
      btn.style.pointerEvents = 'auto';
    }
  });

  document.getElementById('btn-mock-data-legacy-disabled')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const isAr = state.lang === 'ar';
    const msg = isAr ? 'هل أنت متأكد من إضافة بيانات تجريبية شاملة لجميع الأقسام؟' : 'Add comprehensive mock data for all modules?';
    if (!confirm(msg)) return;

    const btn = e.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = `<span>⏳</span><span>${isAr ? 'جاري الإضافة...' : 'Adding...'}</span>`;
    btn.style.pointerEvents = 'none';

    try {
      // 1. Add Teachers
      const teachersData = [
        { name: 'أحمد محمود', email: 'ahmad@school.com', subjects: ['رياضيات', 'علوم'], phone: '0501234567', role: 'teacher', baseSalary: 5000 },
        { name: 'سارة خالد', email: 'sara@school.com', subjects: ['لغة عربية', 'تاريخ'], phone: '0501234568', role: 'teacher', baseSalary: 4500 }
      ];
      const teacherIds = [];
      for (let t of teachersData) {
        try {
          const uid = await adminCreateUser(t.email, '123456', 'teacher', t.name);
          await setDoc(doc(db, 'teachers', uid), { ...t, id: uid, createdAt: new Date().toISOString() }, { merge: true });
          teacherIds.push(uid);
        } catch (err) { 
            console.warn(`Skipping teacher ${t.email}:`, err);
            // If user exists, try to get ID from existing list
            const existing = state.teachers.find(x => x.email === t.email);
            if (existing) teacherIds.push(existing.id);
        }
      }

      // 2. Add Parents
      const parentsData = [
        { name: 'خالد عبدالله', email: 'khaled@parent.com', phone: '0509876543', role: 'parent' },
        { name: 'فاطمة علي', email: 'fatima@parent.com', phone: '0509876544', role: 'parent' }
      ];
      const parentIds = [];
      for (let p of parentsData) {
        try {
          const uid = await adminCreateUser(p.email, '123456', 'parent', p.name);
          await setDoc(doc(db, 'parents', uid), { ...p, id: uid, createdAt: new Date().toISOString() }, { merge: true });
          parentIds.push(uid);
        } catch (err) { 
            console.warn(`Skipping parent ${p.email}:`, err); 
            const existing = state.parents.find(x => x.email === p.email);
            if (existing) parentIds.push(existing.id);
        }
      }

      // 3. Add Subjects
      const subjectsData = ['رياضيات', 'لغة عربية', 'علوم', 'لغة إنجليزية', 'تاريخ'];
      for (let s of subjectsData) {
        try {
          const q = query(collection(db, 'subjects'), where('name', '==', s));
          const snap = await getDocs(q);
          if (snap.empty) {
            await addDoc(collection(db, 'subjects'), { name: s, code: 'SUBJ-'+Math.floor(Math.random()*1000) });
          }
        } catch (err) { console.warn(`Skipping subject ${s}:`, err); }
      }

      // 4. Add Students
      const studentsData = [
        { name: 'عمر خالد', email: 'omar@student.com', parentId: parentIds[0] || 'mock-p1', role: 'student' },
        { name: 'محمد علي', email: 'mohammed@student.com', parentId: parentIds[1] || 'mock-p2', role: 'student' }
      ];
      const studentIds = [];
      for (let s of studentsData) {
        try {
          const uid = await adminCreateUser(s.email, '123456', 'student', s.name);
          await setDoc(doc(db, 'students', uid), { ...s, id: uid, createdAt: new Date().toISOString() }, { merge: true });
          studentIds.push(uid);
        } catch (err) { 
            console.warn(`Skipping student ${s.email}:`, err); 
            const existing = state.students.find(x => x.email === s.email);
            if (existing) studentIds.push(existing.id);
        }
      }

      // 5. Add Classes and linked data
      if (teacherIds.length > 0 && studentIds.length > 0) {
        const classRef = await addDoc(collection(db, 'classes'), { 
          name: 'الصف الأول - أ', 
          grade: 'الصف الأول', 
          teacherId: teacherIds[0], 
          studentIds: studentIds,
          createdAt: new Date().toISOString() 
        });

        // 6. Add Attendance for today
        const todayStr = new Date().toISOString().split('T')[0];
        for (let sid of studentIds) {
          await addDoc(collection(db, 'attendance'), {
            studentId: sid,
            date: todayStr,
            status: Math.random() > 0.1 ? 'present' : 'absent',
            classId: classRef.id
          });
          
          // 7. Add Grades
          await addDoc(collection(db, 'grades'), {
            studentId: sid,
            subject: 'رياضيات',
            score: Math.floor(Math.random() * 20) + 80,
            maxScore: 100,
            date: todayStr
          });

          // 8. Add Fees
          await addDoc(collection(db, 'fees'), {
            studentId: sid,
            amount: 5000,
            paidAmount: 2000,
            status: 'partial',
            dueDate: '2026-05-01'
          });
        }
      }

      showToast(isAr ? 'تمت إضافة البيانات التجريبية والربط بنجاح' : 'Mock data and links added successfully', 'success');
      btn.innerHTML = oldHtml;
      btn.style.pointerEvents = 'auto';
      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      console.error("Mock data fatal error:", err);
      showToast(isAr ? 'حدث خطأ أثناء إضافة البيانات' : 'Error adding mock data', 'error');
      btn.innerHTML = oldHtml;
      btn.style.pointerEvents = 'auto';
    }
  });

  document.getElementById('bulk-grading-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast(state.lang === 'ar' ? 'ميزة الرصد الجماعي قيد التفعيل' : 'Bulk grading feature is being activated', 'info');
  });
}
