import { state, t } from '../state.js';
import { escapeHTML } from '../ui.js?v=20260502-photo-sync';

function normalizeDate(value) {
  if (!value) return '';
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return value;
}

function statusBadge(status) {
  const map = {
    pending: { cls: 'warning', ar: 'قيد الانتظار', en: 'Pending' },
    sent: { cls: 'success', ar: 'تم الإرسال', en: 'Sent' },
    failed: { cls: 'danger', ar: 'فشل', en: 'Failed' },
    processing: { cls: 'info', ar: 'قيد المعالجة', en: 'Processing' }
  };
  const item = map[status] || map.pending;
  return `<span class="badge badge-${item.cls}">${state.lang === 'ar' ? item.ar : item.en}</span>`;
}

export function renderNotificationOutbox() {
  const isAr = state.lang === 'ar';
  if (state.profile?.role !== 'admin') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card"><span class="empty-icon">🔒</span><h3>${isAr ? 'للمدير فقط' : 'Admin only'}</h3></div></div>`;
  }

  const rows = [...(state.notificationOutbox || [])].sort((a, b) => new Date(normalizeDate(b.created_at || b.createdAt)) - new Date(normalizeDate(a.created_at || a.createdAt)));
  const pending = rows.filter(item => item.status === 'pending').length;
  const sent = rows.filter(item => item.status === 'sent').length;
  const failed = rows.filter(item => item.status === 'failed').length;

  return `
    <div class="page-content animate-in">
      <div class="page-header">
        <div>
          <h2>${isAr ? 'سجل الإرسال' : 'Notification Outbox'}</h2>
          <p class="text-muted">${isAr ? 'طابور الإشعارات التي تنتظر عامل الإرسال الخارجي.' : 'Queue of notifications waiting for the external worker.'}</p>
        </div>
      </div>

      <div class="stats-grid grid-4" style="margin-bottom:1.5rem;">
        <div class="stat-card gradient-blue"><div class="stat-icon">📨</div><div class="stat-info"><h3>${rows.length}</h3><p>${isAr ? 'الإجمالي' : 'Total'}</p></div></div>
        <div class="stat-card gradient-purple"><div class="stat-icon">⏳</div><div class="stat-info"><h3>${pending}</h3><p>${isAr ? 'قيد الانتظار' : 'Pending'}</p></div></div>
        <div class="stat-card gradient-green"><div class="stat-icon">✅</div><div class="stat-info"><h3>${sent}</h3><p>${isAr ? 'تم الإرسال' : 'Sent'}</p></div></div>
        <div class="stat-card gradient-red"><div class="stat-icon">⚠️</div><div class="stat-info"><h3>${failed}</h3><p>${isAr ? 'فشل' : 'Failed'}</p></div></div>
      </div>

      <div class="filter-bar glass-card">
        <input class="form-input" id="outbox-search" placeholder="🔍 ${t('search')}...">
        <select class="form-select" id="outbox-status-filter">
          <option value="">${isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="pending">${isAr ? 'قيد الانتظار' : 'Pending'}</option>
          <option value="sent">${isAr ? 'تم الإرسال' : 'Sent'}</option>
          <option value="failed">${isAr ? 'فشل' : 'Failed'}</option>
        </select>
        <select class="form-select" id="outbox-type-filter">
          <option value="">${isAr ? 'كل القنوات' : 'All channels'}</option>
          <option value="push">Push</option>
          <option value="sms">SMS</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>

      <div class="table-responsive glass-card">
        <table class="data-table" id="outbox-table">
          <thead>
            <tr>
              <th>#</th>
              <th>${isAr ? 'المستلم' : 'Recipient'}</th>
              <th>${isAr ? 'القناة' : 'Channel'}</th>
              <th>${isAr ? 'العنوان' : 'Title'}</th>
              <th>${isAr ? 'الرسالة' : 'Body'}</th>
              <th>${isAr ? 'الحالة' : 'Status'}</th>
              <th>${isAr ? 'التاريخ' : 'Date'}</th>
              <th>${isAr ? 'الخطأ' : 'Error'}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((item, index) => {
              const created = normalizeDate(item.created_at || item.createdAt);
              return `
                <tr data-status="${escapeHTML(item.status || 'pending')}" data-type="${escapeHTML(item.type || '')}">
                  <td>${index + 1}</td>
                  <td><strong>${escapeHTML(item.recipient_name || item.recipient_id || '')}</strong><br><small>${escapeHTML(item.contact_info || '')}</small></td>
                  <td><span class="badge">${escapeHTML(item.type || 'push')}</span></td>
                  <td>${escapeHTML(item.title || '')}</td>
                  <td style="max-width:320px;white-space:normal">${escapeHTML(item.body || '')}</td>
                  <td>${statusBadge(item.status || 'pending')}</td>
                  <td>${created ? new Date(created).toLocaleString(isAr ? 'ar-SA' : 'en-US') : '—'}</td>
                  <td>${escapeHTML(item.error_message || '') || '—'}</td>
                </tr>`;
            }).join('') || `<tr><td colspan="8" class="text-center text-muted">${t('noData')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

export function attachNotificationOutboxEvents() {
  const apply = () => {
    const q = document.getElementById('outbox-search')?.value.toLowerCase() || '';
    const status = document.getElementById('outbox-status-filter')?.value || '';
    const type = document.getElementById('outbox-type-filter')?.value || '';
    document.querySelectorAll('#outbox-table tbody tr').forEach(row => {
      const qOk = !q || row.textContent.toLowerCase().includes(q);
      const statusOk = !status || row.dataset.status === status;
      const typeOk = !type || row.dataset.type === type;
      row.style.display = qOk && statusOk && typeOk ? '' : 'none';
    });
  };
  document.getElementById('outbox-search')?.addEventListener('input', apply);
  document.getElementById('outbox-status-filter')?.addEventListener('change', apply);
  document.getElementById('outbox-type-filter')?.addEventListener('change', apply);
}
