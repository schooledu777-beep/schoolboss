import { state, t } from '../state.js';
import { formatCurrency } from '../ui.js';
import { ensureHtml2Pdf } from '../services/pdfService.js';

// ========================= ADVANCED ANALYTICS DASHBOARD =========================

export function renderAnalytics() {
  const isAr = state.lang === 'ar';
  if (state.profile?.role !== 'admin') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card">
      <span class="empty-icon">🔒</span><h3>${isAr ? 'للمدير فقط' : 'Admin Only'}</h3></div></div>`;
  }

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📊 ${isAr ? 'التقارير والتحليلات' : 'Analytics & Reports'}</h2>
      <div class="header-actions">
        <button class="btn btn-outline" id="export-analytics-btn">📥 ${isAr ? 'تصدير PDF' : 'Export PDF'}</button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="glass-card" style="padding:.5rem;margin-bottom:1.5rem;display:flex;gap:.35rem;flex-wrap:wrap;">
      ${[
        { key: 'academic',  icon: '🎓', ar: 'أكاديمي',    en: 'Academic'    },
        { key: 'attendance',icon: '✅', ar: 'الحضور',     en: 'Attendance'  },
        { key: 'finance',   icon: '💰', ar: 'مالي',       en: 'Finance'     },
        { key: 'students',  icon: '👥', ar: 'الطلاب',     en: 'Students'    },
      ].map((tab, i) => `
        <button class="btn analytics-tab ${i === 0 ? 'btn-primary' : 'btn-outline'}" data-tab="${tab.key}"
          style="flex:1;min-width:100px;">
          ${tab.icon} ${isAr ? tab.ar : tab.en}
        </button>`).join('')}
    </div>

    <!-- Academic Tab -->
    <div id="tab-academic" class="analytics-panel">
      ${renderAcademicAnalytics(isAr)}
    </div>

    <!-- Attendance Tab -->
    <div id="tab-attendance" class="analytics-panel" style="display:none;">
      ${renderAttendanceAnalytics(isAr)}
    </div>

    <!-- Finance Tab -->
    <div id="tab-finance" class="analytics-panel" style="display:none;">
      ${renderFinanceAnalytics(isAr)}
    </div>

    <!-- Students Tab -->
    <div id="tab-students" class="analytics-panel" style="display:none;">
      ${renderStudentsAnalytics(isAr)}
    </div>
  </div>`;
}

// ── Academic Analytics ──────────────────────────────────────────────
function renderAcademicAnalytics(isAr) {
  const grades = state.grades || [];

  // Per-subject averages
  const subjectMap = {};
  grades.forEach(g => {
    if (!subjectMap[g.subject]) subjectMap[g.subject] = { total: 0, max: 0, count: 0 };
    subjectMap[g.subject].total += g.score || 0;
    subjectMap[g.subject].max   += g.maxScore || 100;
    subjectMap[g.subject].count++;
  });

  const subjects = Object.entries(subjectMap)
    .map(([name, d]) => ({ name, avg: d.max > 0 ? Math.round((d.total / d.max) * 100) : 0, count: d.count }))
    .sort((a, b) => b.avg - a.avg);

  // Per-class averages
  const classMap = {};
  grades.forEach(g => {
    const student = state.students.find(s => s.id === g.studentId);
    const cls = student ? (state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(student.id))) : null;
    if (!cls) return;
    if (!classMap[cls.id]) classMap[cls.id] = { name: cls.name, total: 0, max: 0 };
    classMap[cls.id].total += g.score || 0;
    classMap[cls.id].max   += g.maxScore || 100;
  });

  const classAvgs = Object.values(classMap)
    .map(c => ({ name: c.name, avg: c.max > 0 ? Math.round((c.total / c.max) * 100) : 0 }))
    .sort((a, b) => b.avg - a.avg);

  // Grade distribution
  const dist = { 'A (90-100)': 0, 'B (75-89)': 0, 'C (60-74)': 0, 'D (50-59)': 0, 'F (<50)': 0 };
  grades.forEach(g => {
    const pct = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0;
    if      (pct >= 90) dist['A (90-100)']++;
    else if (pct >= 75) dist['B (75-89)']++;
    else if (pct >= 60) dist['C (60-74)']++;
    else if (pct >= 50) dist['D (50-59)']++;
    else                dist['F (<50)']++;
  });
  const totalGrades = grades.length || 1;

  // Top/bottom students
  const studentScores = {};
  grades.forEach(g => {
    if (!studentScores[g.studentId]) studentScores[g.studentId] = { total: 0, max: 0 };
    studentScores[g.studentId].total += g.score || 0;
    studentScores[g.studentId].max   += g.maxScore || 100;
  });
  const studentList = Object.entries(studentScores)
    .map(([id, d]) => ({ id, avg: d.max > 0 ? Math.round((d.total / d.max) * 100) : 0 }))
    .sort((a, b) => b.avg - a.avg);
  const top5    = studentList.slice(0, 5);
  const bottom5 = studentList.slice(-5).reverse();

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">

    <!-- Grade Distribution Donut -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '📊 توزيع الدرجات' : '📊 Grade Distribution'}</h3>
      <div style="display:flex;flex-direction:column;gap:.6rem;">
        ${Object.entries(dist).map(([label, count]) => {
          const pct = Math.round((count / totalGrades) * 100);
          const color = label.startsWith('A') ? '#10b981' : label.startsWith('B') ? '#3b82f6' :
                        label.startsWith('C') ? '#f59e0b' : label.startsWith('D') ? '#f97316' : '#ef4444';
          return `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.25rem;">
                <span>${label}</span><span style="font-weight:700;color:${color};">${count} (${pct}%)</span>
              </div>
              <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .5s;"></div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Subject Averages -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '📘 متوسط المواد' : '📘 Subject Averages'}</h3>
      ${subjects.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        subjects.map(s => {
          const color = s.avg >= 80 ? '#10b981' : s.avg >= 60 ? '#f59e0b' : '#ef4444';
          return `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:.85rem;font-weight:600;margin-bottom:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</div>
                <div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${s.avg}%;background:${color};border-radius:4px;"></div>
                </div>
              </div>
              <span style="font-weight:800;color:${color};min-width:40px;text-align:${isAr?'left':'right'};">${s.avg}%</span>
            </div>`;
        }).join('')}
    </div>

    <!-- Class Averages -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '🏫 متوسط الصفوف' : '🏫 Class Averages'}</h3>
      ${classAvgs.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        classAvgs.map((c, i) => {
          const color = c.avg >= 80 ? '#10b981' : c.avg >= 60 ? '#f59e0b' : '#ef4444';
          const medals = ['🥇','🥈','🥉'];
          return `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
              <span style="font-size:1.2rem;min-width:28px;">${medals[i] || '📌'}</span>
              <div style="flex:1;">
                <div style="font-size:.85rem;font-weight:600;">${c.name}</div>
                <div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin-top:.2rem;">
                  <div style="height:100%;width:${c.avg}%;background:${color};border-radius:4px;"></div>
                </div>
              </div>
              <span style="font-weight:800;color:${color};min-width:40px;">${c.avg}%</span>
            </div>`;
        }).join('')}
    </div>

    <!-- Top Students -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">🏆 ${isAr ? 'أعلى الطلاب أداءً' : 'Top Performing Students'}</h3>
      ${top5.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        top5.map((s, i) => {
          const student = state.students.find(x => x.id === s.id);
          const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
          return `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border);">
              <span style="font-size:1.1rem;">${medals[i]}</span>
              <div style="flex:1;font-size:.85rem;font-weight:600;">${student?.name || '—'}</div>
              <span class="badge badge-success">${s.avg}%</span>
            </div>`;
        }).join('')}
    </div>

    <!-- Bottom Students (needs support) -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">⚠️ ${isAr ? 'طلاب يحتاجون دعماً' : 'Students Needing Support'}</h3>
      ${bottom5.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        bottom5.map(s => {
          const student = state.students.find(x => x.id === s.id);
          return `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border);">
              <span style="font-size:1.1rem;">📉</span>
              <div style="flex:1;font-size:.85rem;font-weight:600;">${student?.name || '—'}</div>
              <span class="badge badge-danger">${s.avg}%</span>
            </div>`;
        }).join('')}
    </div>

  </div>`;
}

// ── Attendance Analytics ────────────────────────────────────────────
function renderAttendanceAnalytics(isAr) {
  const attendance = state.attendance || [];
  const students   = state.students   || [];
  const classes    = state.classes    || [];

  // Overall rates
  const total   = attendance.length;
  const present = attendance.filter(a => a.status === 'present').length;
  const absent  = attendance.filter(a => a.status === 'absent').length;
  const late    = attendance.filter(a => a.status === 'late').length;
  const excused = attendance.filter(a => a.status === 'excused').length;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

  // Per-class attendance
  const classAtt = classes.map(cls => {
    const classStudentIds = cls.studentIds || students.filter(s => s.classId === cls.id).map(s => s.id);
    const classRecords = attendance.filter(a => classStudentIds.includes(a.studentId));
    const p = classRecords.filter(a => a.status === 'present').length;
    const pct = classRecords.length > 0 ? Math.round((p / classRecords.length) * 100) : 0;
    return { name: cls.name, pct, total: classRecords.length };
  }).filter(c => c.total > 0).sort((a, b) => b.pct - a.pct);

  // Chronic absentees (< 75%)
  const studentAtt = {};
  attendance.forEach(a => {
    if (!studentAtt[a.studentId]) studentAtt[a.studentId] = { present: 0, total: 0 };
    studentAtt[a.studentId].total++;
    if (a.status === 'present') studentAtt[a.studentId].present++;
  });
  const absentees = Object.entries(studentAtt)
    .map(([id, d]) => ({ id, pct: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0, total: d.total }))
    .filter(s => s.pct < 75 && s.total >= 5)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">

    <!-- Overall Stats -->
    <div class="glass-card" style="padding:1.5rem;grid-column:1/-1;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '📊 إحصائيات الحضور الكلية' : '📊 Overall Attendance Stats'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;">
        ${[
          { label: isAr ? 'نسبة الحضور' : 'Attendance Rate', val: `${rate}%`,   color: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444' },
          { label: isAr ? 'حاضر'       : 'Present',          val: present,       color: '#10b981' },
          { label: isAr ? 'غائب'       : 'Absent',           val: absent,        color: '#ef4444' },
          { label: isAr ? 'متأخر'      : 'Late',             val: late,          color: '#f59e0b' },
          { label: isAr ? 'مستأذن'     : 'Excused',          val: excused,       color: '#3b82f6' },
        ].map(s => `
          <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:10px;">
            <div style="font-size:1.5rem;font-weight:800;color:${s.color};">${s.val}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem;">${s.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Class Attendance -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '🏫 حضور الصفوف' : '🏫 Class Attendance'}</h3>
      ${classAtt.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        classAtt.map(c => {
          const color = c.pct >= 85 ? '#10b981' : c.pct >= 70 ? '#f59e0b' : '#ef4444';
          return `
            <div style="margin-bottom:.75rem;">
              <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.2rem;">
                <span style="font-weight:600;">${c.name}</span>
                <span style="color:${color};font-weight:700;">${c.pct}%</span>
              </div>
              <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${c.pct}%;background:${color};border-radius:4px;"></div>
              </div>
            </div>`;
        }).join('')}
    </div>

    <!-- Chronic Absentees -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">🚨 ${isAr ? 'طلاب كثيرو الغياب (أقل من 75%)' : 'Chronic Absentees (<75%)'}</h3>
      ${absentees.length === 0
        ? `<div style="text-align:center;padding:2rem;color:var(--text-muted);">✅ ${isAr ? 'لا يوجد طلاب بنسبة حضور منخفضة' : 'No chronic absentees'}</div>`
        : absentees.map(s => {
          const student = state.students.find(x => x.id === s.id);
          return `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border);">
              <span style="font-size:1.1rem;">⚠️</span>
              <div style="flex:1;font-size:.85rem;font-weight:600;">${student?.name || '—'}</div>
              <span class="badge badge-danger">${s.pct}%</span>
            </div>`;
        }).join('')}
    </div>
  </div>`;
}

// ── Finance Analytics ───────────────────────────────────────────────
function renderFinanceAnalytics(isAr) {
  const fees = state.fees || [];
  const total   = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paid    = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pending = total - paid;
  const rate    = total > 0 ? Math.round((paid / total) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];
  const overdue = fees.filter(f => f.dueDate && f.dueDate < today && (f.paidAmount||0) < (f.amount||0));

  // By fee type
  const typeMap = {};
  fees.forEach(f => {
    const k = f.feeType || 'other';
    if (!typeMap[k]) typeMap[k] = { total: 0, paid: 0, count: 0 };
    typeMap[k].total += f.amount || 0;
    typeMap[k].paid  += f.paidAmount || 0;
    typeMap[k].count++;
  });

  // By class
  const classMap = {};
  fees.forEach(f => {
    const student = state.students.find(s => s.id === f.studentId);
    const cls = student ? state.classes.find(c => c.id === student.classId || (c.studentIds||[]).includes(student.id)) : null;
    if (!cls) return;
    if (!classMap[cls.id]) classMap[cls.id] = { name: cls.name, total: 0, paid: 0 };
    classMap[cls.id].total += f.amount || 0;
    classMap[cls.id].paid  += f.paidAmount || 0;
  });
  const byClass = Object.values(classMap).sort((a, b) => b.paid - a.paid);

  const typeLabels = { tuition: {ar:'دراسية',en:'Tuition'}, activity: {ar:'أنشطة',en:'Activities'}, transport: {ar:'مواصلات',en:'Transport'}, hostel: {ar:'سكن',en:'Hostel'}, uniform: {ar:'زي',en:'Uniform'}, exam: {ar:'امتحانات',en:'Exams'}, library: {ar:'مكتبة',en:'Library'}, other: {ar:'أخرى',en:'Other'} };

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">

    <!-- Summary -->
    <div class="glass-card" style="padding:1.5rem;grid-column:1/-1;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '💰 ملخص مالي' : '💰 Financial Summary'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
        ${[
          { label: isAr ? 'إجمالي الرسوم'   : 'Total Fees',      val: formatCurrency(total),   color: '#6366f1' },
          { label: isAr ? 'المحصّل'          : 'Collected',        val: formatCurrency(paid),    color: '#10b981' },
          { label: isAr ? 'المتبقي'          : 'Pending',          val: formatCurrency(pending), color: '#ef4444' },
          { label: isAr ? 'نسبة التحصيل'    : 'Collection Rate',  val: `${rate}%`,              color: rate >= 80 ? '#10b981' : '#f59e0b' },
          { label: isAr ? 'فواتير متأخرة'   : 'Overdue Bills',    val: overdue.length,          color: '#f97316' },
        ].map(s => `
          <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:10px;">
            <div style="font-size:1.25rem;font-weight:800;color:${s.color};">${s.val}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem;">${s.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- By Type -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? 'توزيع الرسوم حسب النوع' : 'Fees by Type'}</h3>
      ${Object.entries(typeMap).map(([k, d]) => {
        const pct = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
        const label = typeLabels[k] || typeLabels.other;
        const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
        return `
          <div style="margin-bottom:.85rem;">
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.25rem;">
              <span style="font-weight:600;">${isAr ? label.ar : label.en} (${d.count})</span>
              <span style="color:${color};font-weight:700;">${formatCurrency(d.paid)} / ${formatCurrency(d.total)}</span>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div>
            </div>
          </div>`;
      }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
    </div>

    <!-- By Class -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? 'تحصيل الرسوم حسب الصف' : 'Collection by Class'}</h3>
      ${byClass.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        byClass.map(c => {
          const pct = c.total > 0 ? Math.round((c.paid / c.total) * 100) : 0;
          const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
          return `
            <div style="margin-bottom:.85rem;">
              <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.25rem;">
                <span style="font-weight:600;">${c.name}</span>
                <span style="color:${color};font-weight:700;">${pct}%</span>
              </div>
              <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div>
              </div>
            </div>`;
        }).join('')}
    </div>
  </div>`;
}

// ── Students Analytics ──────────────────────────────────────────────
function renderStudentsAnalytics(isAr) {
  const students = state.students || [];
  const classes  = state.classes  || [];

  const total   = students.length;
  const male    = students.filter(s => s.gender === 'male'   || s.gender === 'ذكر').length;
  const female  = students.filter(s => s.gender === 'female' || s.gender === 'أنثى').length;
  const other   = total - male - female;

  // By class
  const byClass = classes.map(cls => {
    const count = students.filter(s => s.classId === cls.id || (cls.studentIds||[]).includes(s.id)).length;
    return { name: cls.name, count };
  }).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  // Enrollment trend (by creation month if available)
  const monthMap = {};
  students.forEach(s => {
    if (!s.createdAt) return;
    const m = s.createdAt.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + 1;
  });
  const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">

    <!-- Overview -->
    <div class="glass-card" style="padding:1.5rem;grid-column:1/-1;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '👥 نظرة عامة على الطلاب' : '👥 Student Overview'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;">
        ${[
          { label: isAr ? 'إجمالي الطلاب' : 'Total Students', val: total,  color: '#6366f1' },
          { label: isAr ? 'ذكور'           : 'Male',            val: male,   color: '#3b82f6' },
          { label: isAr ? 'إناث'           : 'Female',          val: female, color: '#ec4899' },
          { label: isAr ? 'إجمالي الصفوف' : 'Total Classes',   val: classes.length, color: '#10b981' },
        ].map(s => `
          <div style="text-align:center;padding:1rem;background:var(--surface-2);border-radius:10px;">
            <div style="font-size:2rem;font-weight:800;color:${s.color};">${s.val}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem;">${s.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- By Class -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '🏫 الطلاب حسب الصف' : '🏫 Students per Class'}</h3>
      ${byClass.length === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` :
        byClass.map(c => {
          const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
          return `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.6rem;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:.82rem;font-weight:600;margin-bottom:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name}</div>
                <div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:#6366f1;border-radius:4px;"></div>
                </div>
              </div>
              <span style="font-weight:700;min-width:30px;text-align:center;">${c.count}</span>
            </div>`;
        }).join('')}
    </div>

    <!-- Gender Distribution -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '⚥ توزيع الجنس' : '⚥ Gender Distribution'}</h3>
      ${total === 0 ? `<p class="text-muted text-center">${t('noData')}</p>` : `
        ${[
          { label: isAr ? 'ذكور'  : 'Male',   val: male,   color: '#3b82f6' },
          { label: isAr ? 'إناث'  : 'Female', val: female, color: '#ec4899' },
          ...(other > 0 ? [{ label: isAr ? 'غير محدد' : 'Other', val: other, color: '#6b7280' }] : []),
        ].map(g => {
          const pct = total > 0 ? Math.round((g.val / total) * 100) : 0;
          return `
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
              <div style="width:48px;height:48px;border-radius:50%;background:${g.color}22;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:${g.color};">${pct}%</div>
              <div>
                <div style="font-weight:600;">${g.label}</div>
                <div style="font-size:.82rem;color:var(--text-muted);">${g.val} ${isAr ? 'طالب' : 'students'}</div>
              </div>
            </div>`;
        }).join('')}`}
    </div>

    ${months.length > 0 ? `
    <!-- Enrollment Trend -->
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin:0 0 1.25rem;font-size:1rem;">${isAr ? '📈 الالتحاق الشهري' : '📈 Monthly Enrollment'}</h3>
      ${months.map(([m, count]) => {
        const maxCount = Math.max(...months.map(([,c]) => c));
        const pct = Math.round((count / maxCount) * 100);
        const d = new Date(m + '-01');
        const label = d.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', year: '2-digit' });
        return `
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.6rem;">
            <span style="font-size:.78rem;color:var(--text-muted);min-width:55px;">${label}</span>
            <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:#6366f1;border-radius:4px;"></div>
            </div>
            <span style="font-weight:700;min-width:24px;">${count}</span>
          </div>`;
      }).join('')}
    </div>` : ''}

  </div>`;
}

export function attachAnalyticsEvents() {
  // Tab switching
  document.querySelectorAll('.analytics-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.analytics-tab').forEach(b => {
        b.classList.remove('btn-primary'); b.classList.add('btn-outline');
      });
      btn.classList.add('btn-primary'); btn.classList.remove('btn-outline');
      document.querySelectorAll('.analytics-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.style.display = '';
    });
  });

  // Export PDF
  document.getElementById('export-analytics-btn')?.addEventListener('click', async () => {
    try {
      await ensureHtml2Pdf();
      const el = document.querySelector('.page-content');
      window.html2pdf().set({
        margin: 10,
        filename: `analytics_${new Date().toISOString().split('T')[0]}.pdf`,
        html2canvas: { scale: 1.5 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
    } catch (error) {
      console.error('[Analytics] PDF library failed:', error);
      window.print();
    }
  });
}
