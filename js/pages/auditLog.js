import { state, t } from '../state.js';
import { db, collection, addDoc } from '../firebase-config.js';
import { tCol, tDoc } from '../db.js';

// ========================= AUDIT LOG =========================
// Records every significant create/update/delete in Firestore

export function renderAuditLog() {
  const isAr = state.lang === 'ar';
  if (state.profile?.role !== 'admin') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card">
      <span class="empty-icon">🔒</span><h3>${isAr ? 'للمدير فقط' : 'Admin Only'}</h3></div></div>`;
  }

  const logs = [...(state.auditLogs || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const ACTION_ICONS = {
    create: { icon: '➕', color: '#10b981', ar: 'إضافة',  en: 'Create' },
    update: { icon: '✏️', color: '#3b82f6', ar: 'تعديل',  en: 'Update' },
    delete: { icon: '🗑️', color: '#ef4444', ar: 'حذف',    en: 'Delete' },
    login:  { icon: '🔑', color: '#8b5cf6', ar: 'دخول',   en: 'Login'  },
    export: { icon: '📤', color: '#f59e0b', ar: 'تصدير',  en: 'Export' },
  };

  const COLLECTION_LABELS = {
    students: { ar: 'الطلاب', en: 'Students' },
    teachers: { ar: 'المعلمون', en: 'Teachers' },
    parents: { ar: 'أولياء الأمور', en: 'Parents' },
    grades: { ar: 'الدرجات', en: 'Grades' },
    fees: { ar: 'الرسوم', en: 'Fees' },
    attendance: { ar: 'الحضور', en: 'Attendance' },
    homework: { ar: 'الواجبات', en: 'Homework' },
    exam_schedule: { ar: 'الامتحانات', en: 'Exams' },
    calendar_events: { ar: 'التقويم', en: 'Calendar' },
    clinic_visits: { ar: 'العيادة', en: 'Clinic' },
    inventory: { ar: 'المخزون', en: 'Inventory' },
    library: { ar: 'المكتبة', en: 'Library' },
    announcements: { ar: 'الإعلانات', en: 'Announcements' },
  };

  // Unique actors
  const actors = [...new Set(logs.map(l => l.actorId).filter(Boolean))];
  const collections = [...new Set(logs.map(l => l.collection).filter(Boolean))];

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>🔍 ${isAr ? 'سجل التدقيق' : 'Audit Log'}</h2>
      <div class="header-actions">
        <button class="btn btn-outline" id="audit-export-btn">📥 ${isAr ? 'تصدير' : 'Export'}</button>
        <button class="btn btn-danger btn-sm" id="audit-clear-btn" style="opacity:.7;">🗑️ ${isAr ? 'مسح السجل' : 'Clear Log'}</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-4" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${logs.length}</h3><p>${isAr ? 'إجمالي السجلات' : 'Total Records'}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">➕</div>
        <div class="stat-info"><h3>${logs.filter(l => l.action === 'create').length}</h3><p>${isAr ? 'عمليات إضافة' : 'Creates'}</p></div>
      </div>
      <div class="stat-card gradient-blue">
        <div class="stat-icon">✏️</div>
        <div class="stat-info"><h3>${logs.filter(l => l.action === 'update').length}</h3><p>${isAr ? 'عمليات تعديل' : 'Updates'}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">🗑️</div>
        <div class="stat-info"><h3>${logs.filter(l => l.action === 'delete').length}</h3><p>${isAr ? 'عمليات حذف' : 'Deletes'}</p></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <input type="text" id="audit-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="audit-action-filter" class="form-select">
        <option value="">${isAr ? 'كل العمليات' : 'All Actions'}</option>
        ${Object.entries(ACTION_ICONS).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <select id="audit-collection-filter" class="form-select">
        <option value="">${isAr ? 'كل المجموعات' : 'All Collections'}</option>
        ${collections.map(c => {
          const label = COLLECTION_LABELS[c] || { ar: c, en: c };
          return `<option value="${c}">${isAr ? label.ar : label.en}</option>`;
        }).join('')}
      </select>
      <input type="date" id="audit-date-filter" class="form-input">
    </div>

    <!-- Log Table -->
    <div class="table-responsive glass-card">
      <table class="data-table" id="audit-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
            <th>${isAr ? 'المستخدم' : 'User'}</th>
            <th>${isAr ? 'العملية' : 'Action'}</th>
            <th>${isAr ? 'المجموعة' : 'Collection'}</th>
            <th>${isAr ? 'التفاصيل' : 'Details'}</th>
          </tr>
        </thead>
        <tbody>
          ${logs.length === 0
            ? `<tr><td colspan="6" class="text-center text-muted">${isAr ? 'لا توجد سجلات بعد' : 'No audit records yet'}</td></tr>`
            : logs.map((log, i) => {
                const act = ACTION_ICONS[log.action] || { icon: '📌', color: '#6b7280', ar: log.action, en: log.action };
                const col = COLLECTION_LABELS[log.collection] || { ar: log.collection, en: log.collection };
                const actor = state.teachers.find(t => t.id === log.actorId)
                           || state.students.find(s => s.id === log.actorId)
                           || state.parents.find(p => p.id === log.actorId);
                const actorName = log.actorName || actor?.name || log.actorEmail || log.actorId?.slice(0, 8) || '—';
                const ts = log.timestamp ? new Date(log.timestamp) : null;
                const dateStr = ts ? ts.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                const timeStr = ts ? ts.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <tr data-action="${log.action}" data-collection="${log.collection||''}" data-date="${log.timestamp?.slice(0,10)||''}">
                    <td>${i + 1}</td>
                    <td>
                      <div style="font-size:.85rem;">${dateStr}</div>
                      <div style="font-size:.75rem;color:var(--text-muted);">${timeStr}</div>
                    </td>
                    <td>
                      <div style="font-size:.85rem;font-weight:600;">${actorName}</div>
                      ${log.actorRole ? `<div style="font-size:.72rem;color:var(--text-muted);">${isAr ? {admin:'مدير',teacher:'معلم',parent:'ولي أمر',student:'طالب'}[log.actorRole]||log.actorRole : log.actorRole}</div>` : ''}
                    </td>
                    <td>
                      <span class="badge" style="background:${act.color}22;color:${act.color};">
                        ${act.icon} ${isAr ? act.ar : act.en}
                      </span>
                    </td>
                    <td style="font-size:.85rem;">${isAr ? col.ar : col.en}</td>
                    <td style="font-size:.82rem;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${log.details||''}">
                      ${log.details || '—'}
                    </td>
                  </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachAuditLogEvents() {
  const isAr = state.lang === 'ar';

  document.getElementById('audit-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#audit-table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('audit-action-filter')?.addEventListener('change', applyAuditFilters);
  document.getElementById('audit-collection-filter')?.addEventListener('change', applyAuditFilters);
  document.getElementById('audit-date-filter')?.addEventListener('change', applyAuditFilters);

  document.getElementById('audit-export-btn')?.addEventListener('click', () => {
    exportAuditCSV(isAr);
  });

  document.getElementById('audit-clear-btn')?.addEventListener('click', () => {
    if (confirm(isAr ? 'هل تريد مسح جميع سجلات التدقيق؟ لا يمكن التراجع.' : 'Clear all audit logs? This cannot be undone.')) {
      // Only clears local state display — actual deletion from Firestore requires batch
      import('../ui.js').then(({ showToast }) => {
        showToast(isAr ? 'لمسح السجلات الكاملة استخدم Firebase Console' : 'Use Firebase Console to bulk delete', 'info');
      });
    }
  });
}

function applyAuditFilters() {
  const action = document.getElementById('audit-action-filter')?.value;
  const coll   = document.getElementById('audit-collection-filter')?.value;
  const date   = document.getElementById('audit-date-filter')?.value;
  document.querySelectorAll('#audit-table tbody tr').forEach(row => {
    const actionOk = !action || row.dataset.action     === action;
    const collOk   = !coll   || row.dataset.collection === coll;
    const dateOk   = !date   || row.dataset.date       === date;
    row.style.display = actionOk && collOk && dateOk ? '' : 'none';
  });
}

function exportAuditCSV(isAr) {
  const logs = state.auditLogs || [];
  const headers = isAr
    ? ['التاريخ', 'المستخدم', 'العملية', 'المجموعة', 'التفاصيل']
    : ['Timestamp', 'User', 'Action', 'Collection', 'Details'];

  const rows = logs.map(l => [
    l.timestamp || '',
    l.actorName || l.actorEmail || l.actorId || '',
    l.action || '',
    l.collection || '',
    (l.details || '').replace(/,/g, ';'),
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `audit_log_${new Date().toISOString().split('T')[0]}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Global audit recorder — call this from anywhere ─────────────────
export async function recordAudit(action, collectionName, details = '') {
  try {
    await addDoc(tCol('audit_logs'), {
      action,
      collection: collectionName,
      details,
      actorId:    state.profile?.uid   || state.user?.uid,
      actorName:  state.profile?.name  || '',
      actorEmail: state.profile?.email || state.user?.email || '',
      actorRole:  state.profile?.role  || '',
      timestamp:  new Date().toISOString(),
    });
  } catch (e) {
    // Non-critical — don't break the main action
    console.warn('[Audit] Failed to record:', e);
  }
}
