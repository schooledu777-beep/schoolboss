import { state, t } from '../state.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency, checkValid } from '../ui.js';
import {
  saveBus, deleteBus,
  saveRoute, deleteRoute,
  assignStudent, updateRouteStudent, removeRouteStudent,
  saveTransportFee, deleteTransportFee, generateMonthlyFees,
  getTransportStats
} from '../services/transportService.js';

// ========================= HELPERS =========================
const ar = () => state.lang === 'ar';
const lbl = (a, e) => ar() ? a : e;

function statusBadge(status) {
  const map = {
    active:   { cls: 'success', ar: 'نشط', en: 'Active' },
    inactive: { cls: 'danger',  ar: 'متوقف', en: 'Inactive' },
    onroute:  { cls: 'info',    ar: 'في الطريق', en: 'On Route' },
    paid:     { cls: 'success', ar: 'مدفوع', en: 'Paid' },
    partial:  { cls: 'warning', ar: 'جزئي', en: 'Partial' },
    unpaid:   { cls: 'danger',  ar: 'غير مدفوع', en: 'Unpaid' },
    suspended:{ cls: 'warning', ar: 'موقوف', en: 'Suspended' },
  };
  const s = map[status] || { cls: 'info', ar: status, en: status };
  return `<span class="badge badge-${s.cls}">${ar() ? s.ar : s.en}</span>`;
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ========================= MAIN RENDER =========================
export function renderTransportation() {
  const tab = window._transportTab || 'overview';
  const stats = getTransportStats();

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>🚌 ${t('transportation')}</h2>
    </div>

    <!-- Stats Row -->
    <div class="stats-grid grid-4" style="margin-bottom:1.5rem">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">🚌</div>
        <div class="stat-info"><h3>${stats.totalBuses}</h3><p>${t('totalBuses')} <span class="text-xs text-muted">(${stats.activeBuses} ${lbl('نشط','active')})</span></p></div>
      </div>
      <div class="stat-card gradient-purple">
        <div class="stat-icon">🗺️</div>
        <div class="stat-info"><h3>${stats.totalRoutes}</h3><p>${t('totalRoutes')}</p></div>
      </div>
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">👨‍🎓</div>
        <div class="stat-info"><h3>${stats.totalStudents}</h3><p>${t('transportStudents')}</p></div>
      </div>
      <div class="stat-card gradient-orange">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${stats.collRate}%</h3><p>${t('collectionRate')}</p></div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar" id="transport-tabs">
      ${[
        { id: 'overview',  icon: '📊', ar: 'نظرة عامة', en: 'Overview' },
        { id: 'buses',     icon: '🚌', ar: 'الحافلات', en: 'Buses' },
        { id: 'routes',    icon: '🗺️', ar: 'المسارات', en: 'Routes' },
        { id: 'students',  icon: '👨‍🎓', ar: 'الطلاب', en: 'Students' },
        { id: 'fees',      icon: '💰', ar: 'الأجور', en: 'Fees' },
      ].map(t2 => `
        <button class="tab-btn ${tab === t2.id ? 'active' : ''}" data-tab="${t2.id}">
          ${t2.icon} ${ar() ? t2.ar : t2.en}
        </button>`).join('')}
    </div>

    <div id="transport-tab-content">
      ${renderTabContent(tab)}
    </div>
  </div>`;
}

function renderTabContent(tab) {
  switch (tab) {
    case 'overview':  return renderOverview();
    case 'buses':     return renderBuses();
    case 'routes':    return renderRoutes();
    case 'students':  return renderStudentAssignments();
    case 'fees':      return renderFees();
    default:          return renderOverview();
  }
}

// ========================= TAB: OVERVIEW =========================
function renderOverview() {
  const buses = state.buses;
  if (!buses.length) return emptyState('🚌', lbl('لا توجد حافلات مسجلة بعد','No buses registered yet'));

  return `<div class="transport-overview">
    ${buses.map(bus => {
      const route = state.routes.find(r => r.busId === bus.id);
      const rsCount = route ? state.routeStudents.filter(rs => rs.routeId === route.id && rs.status === 'active').length : 0;
      const pct = bus.capacity > 0 ? Math.min(100, Math.round((rsCount / bus.capacity) * 100)) : 0;
      const pctColor = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
      const stops = route?.stops || [];

      return `
      <div class="bus-tracking-card glass-card">
        <div class="bus-track-header">
          <div class="bus-track-left">
            <div class="bus-track-icon">${bus.status === 'active' ? '🟢' : '🔴'} 🚌</div>
            <div>
              <div class="bus-track-title">${bus.plateNumber}</div>
              <div class="bus-track-sub">${bus.model || ''} · ${lbl('سائق:','Driver:')} ${bus.driverName || lbl('غير محدد','N/A')}</div>
            </div>
          </div>
          <div class="bus-track-right">
            ${statusBadge(bus.status)}
            <div class="bus-capacity-badge">${rsCount}/${bus.capacity} ${lbl('طالب','students')}</div>
          </div>
        </div>

        ${route ? `
        <div class="bus-track-route">
          <span class="bus-route-name">📍 ${route.name}</span>
          <span class="bus-route-times">🌅 ${route.morningTime || '--:--'} &nbsp;|&nbsp; 🌆 ${route.afternoonTime || '--:--'}</span>
        </div>
        <div class="bus-progress-wrap">
          <div class="bus-progress-bar"><div class="bus-progress-fill" style="width:${pct}%;background:${pctColor}"></div></div>
          <span class="bus-progress-label">${pct}% ${lbl('ممتلئة','full')}</span>
        </div>
        ${stops.length ? `
        <div class="bus-stops-row">
          ${stops.sort((a,b)=>a.order-b.order).map((stop, i) => `
            <div class="bus-stop-dot">
              <div class="stop-circle ${i === 0 ? 'stop-first' : i === stops.length-1 ? 'stop-last' : ''}"></div>
              <div class="stop-name">${stop.name}</div>
              <div class="stop-time text-xs text-muted">${stop.time || ''}</div>
            </div>
            ${i < stops.length-1 ? '<div class="stop-line"></div>' : ''}
          `).join('')}
        </div>` : ''}
        ` : `<div class="text-muted text-sm" style="padding:.5rem 0">${lbl('لا يوجد مسار معين لهذه الحافلة','No route assigned to this bus')}</div>`}

        ${bus.driverPhone ? `
        <div class="bus-driver-contact">
          <a href="tel:${bus.driverPhone}" class="btn btn-sm btn-outline">📞 ${bus.driverPhone}</a>
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ========================= TAB: BUSES =========================
function renderBuses() {
  return `
  <div class="section-toolbar">
    <button class="btn btn-primary" id="add-bus-btn">+ ${t('addBus')}</button>
  </div>
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead><tr>
        <th>#</th>
        <th>${t('plateNumber')}</th>
        <th>${t('busModel')}</th>
        <th>${t('busCapacity')}</th>
        <th>${t('driverName')}</th>
        <th>${t('driverPhone')}</th>
        <th>${lbl('المسار','Route')}</th>
        <th>${lbl('الحالة','Status')}</th>
        <th>${lbl('إجراءات','Actions')}</th>
      </tr></thead>
      <tbody>
        ${state.buses.map((bus, i) => {
          const route = state.routes.find(r => r.busId === bus.id);
          return `<tr>
            <td>${i+1}</td>
            <td><strong>${bus.plateNumber}</strong></td>
            <td>${bus.model || '—'}</td>
            <td>${bus.capacity || '—'}</td>
            <td>${bus.driverName || '—'}</td>
            <td>${bus.driverPhone ? `<a href="tel:${bus.driverPhone}">${bus.driverPhone}</a>` : '—'}</td>
            <td>${route ? route.name : `<span class="text-muted">${lbl('غير محدد','Not assigned')}</span>`}</td>
            <td>${statusBadge(bus.status || 'active')}</td>
            <td>
              <button class="btn btn-sm btn-outline edit-bus" data-id="${bus.id}">✏️</button>
              <button class="btn btn-sm btn-danger delete-bus" data-id="${bus.id}">🗑️</button>
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="9" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

// ========================= TAB: ROUTES =========================
function renderRoutes() {
  return `
  <div class="section-toolbar">
    <button class="btn btn-primary" id="add-route-btn">+ ${t('addRoute')}</button>
  </div>
  <div class="routes-grid">
    ${state.routes.map(route => {
      const bus = state.buses.find(b => b.id === route.busId);
      const studentCount = state.routeStudents.filter(rs => rs.routeId === route.id && rs.status === 'active').length;
      const stops = route.stops || [];
      return `
      <div class="route-card glass-card">
        <div class="route-card-header">
          <div>
            <div class="route-card-title">🗺️ ${route.name}</div>
            <div class="route-card-sub">${bus ? `🚌 ${bus.plateNumber}` : lbl('لا حافلة','No bus')} · ${studentCount} ${lbl('طالب','students')}</div>
          </div>
          <div class="route-card-actions">
            <button class="btn btn-sm btn-outline edit-route" data-id="${route.id}">✏️</button>
            <button class="btn btn-sm btn-danger delete-route" data-id="${route.id}">🗑️</button>
          </div>
        </div>
        <div class="route-info-row">
          <span>💰 ${formatCurrency(route.monthlyCost || 0)} / ${lbl('شهر','mo')}</span>
          <span>🌅 ${route.morningTime || '--'} — 🌆 ${route.afternoonTime || '--'}</span>
        </div>
        ${stops.length ? `
        <div class="route-stops-list">
          ${stops.sort((a,b)=>a.order-b.order).map(s => `
            <div class="route-stop-item">
              <span class="stop-dot"></span>
              <span class="stop-name-sm">${s.name}</span>
              ${s.time ? `<span class="stop-time-sm text-muted">${s.time}</span>` : ''}
            </div>`).join('')}
        </div>` : `<div class="text-muted text-sm">${lbl('لا محطات مضافة','No stops added')}</div>`}
      </div>`;
    }).join('') || emptyState('🗺️', lbl('لا توجد مسارات بعد','No routes yet'))}
  </div>`;
}

// ========================= TAB: STUDENT ASSIGNMENTS =========================
function renderStudentAssignments() {
  const allRoutes = state.routes;

  return `
  <div class="section-toolbar">
    <button class="btn btn-primary" id="assign-student-btn">+ ${t('assignStudent')}</button>
  </div>

  ${allRoutes.length === 0
    ? emptyState('🗺️', lbl('أضف مسارات أولاً','Add routes first'))
    : allRoutes.map(route => {
        const routeStudents = state.routeStudents.filter(rs => rs.routeId === route.id);
        if (!routeStudents.length) return '';
        return `
        <div class="glass-card" style="margin-bottom:1rem;padding:1.25rem">
          <div class="route-students-header">
            <h4>🗺️ ${route.name}</h4>
            <span class="badge badge-info">${routeStudents.length} ${lbl('طالب','students')}</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr>
                <th>${lbl('الطالب','Student')}</th>
                <th>${lbl('الصف','Class')}</th>
                <th>${t('boardingStop')}</th>
                <th>${t('direction')}</th>
                <th>${lbl('الحالة','Status')}</th>
                <th>${lbl('إجراءات','Actions')}</th>
              </tr></thead>
              <tbody>
                ${routeStudents.map(rs => {
                  const student = state.students.find(s => s.id === rs.studentId);
                  const cls = state.classes.find(c => c.id === student?.classId);
                  const dirMap = { both: lbl('ذهاب وإياب','Both'), morning: lbl('ذهاب','Morning'), afternoon: lbl('إياب','Afternoon') };
                  return `<tr>
                    <td>${student?.name || '—'}</td>
                    <td>${cls?.name || '—'}</td>
                    <td>${rs.boardingStop || '—'}</td>
                    <td>${dirMap[rs.direction] || rs.direction}</td>
                    <td>${statusBadge(rs.status || 'active')}</td>
                    <td>
                      <button class="btn btn-sm btn-outline edit-rs" data-id="${rs.id}">✏️</button>
                      <button class="btn btn-sm btn-danger remove-rs" data-id="${rs.id}">🗑️</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      }).join('') || emptyState('👨‍🎓', lbl('لا يوجد طلاب مسجلون في مسارات','No students assigned to routes'))}

  ${state.routeStudents.length === 0 && allRoutes.length > 0
    ? emptyState('👨‍🎓', lbl('لا يوجد طلاب مسجلون في مسارات','No students assigned to routes'))
    : ''}
  `;
}

// ========================= TAB: FEES =========================
function renderFees() {
  const now = new Date();
  const activeMonth = window._transportFeeMonth ?? now.getMonth();
  const activeYear  = window._transportFeeYear  ?? now.getFullYear();

  const fees = state.transportFees.filter(f => f.month === activeMonth && f.year === activeYear);
  const total   = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paid    = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pending = total - paid;
  const pct     = total > 0 ? Math.round((paid / total) * 100) : 0;

  return `
  <div class="fees-toolbar">
    <div class="month-picker-wrap">
      <select id="fee-month-sel" class="form-select" style="width:auto">
        ${MONTHS_AR.map((m, i) => `<option value="${i}" ${i===activeMonth?'selected':''}>${ar() ? m : MONTHS_EN[i]}</option>`).join('')}
      </select>
      <select id="fee-year-sel" class="form-select" style="width:auto">
        ${[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y =>
          `<option value="${y}" ${y===activeYear?'selected':''}>${y}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn btn-outline" id="gen-fees-btn">⚡ ${lbl('توليد أجور الشهر','Generate Month Fees')}</button>
      <button class="btn btn-primary" id="add-transport-fee-btn">+ ${lbl('إضافة أجرة','Add Fee')}</button>
    </div>
  </div>

  <div class="stats-grid grid-3" style="margin:1rem 0">
    <div class="stat-card gradient-blue"><div class="stat-icon">💵</div><div class="stat-info"><h3>${formatCurrency(total)}</h3><p>${lbl('إجمالي الأجور','Total Fees')}</p></div></div>
    <div class="stat-card gradient-emerald"><div class="stat-icon">✅</div><div class="stat-info"><h3>${formatCurrency(paid)}</h3><p>${lbl('المحصّل','Collected')}</p></div></div>
    <div class="stat-card gradient-red"><div class="stat-icon">⏰</div><div class="stat-info"><h3>${formatCurrency(pending)}</h3><p>${lbl('المتبقي','Remaining')}</p></div></div>
  </div>

  <div class="glass-card" style="padding:1rem 1.25rem;margin-bottom:1.25rem">
    <div class="progress-label"><span>${lbl('نسبة التحصيل','Collection Rate')}</span><span>${pct}%</span></div>
    <div class="progress-bar"><div class="progress-fill gradient-green" style="width:${pct}%"></div></div>
  </div>

  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead><tr>
        <th>#</th>
        <th>${lbl('الطالب','Student')}</th>
        <th>${lbl('المسار','Route')}</th>
        <th>${lbl('المبلغ','Amount')}</th>
        <th>${lbl('المدفوع','Paid')}</th>
        <th>${lbl('الحالة','Status')}</th>
        <th>${lbl('إجراءات','Actions')}</th>
      </tr></thead>
      <tbody>
        ${fees.map((f, i) => {
          const student = state.students.find(s => s.id === f.studentId);
          const route   = state.routes.find(r => r.id === f.routeId);
          const status  = (f.paidAmount||0) >= (f.amount||0) ? 'paid'
                        : (f.paidAmount||0) > 0 ? 'partial' : 'unpaid';
          return `<tr>
            <td>${i+1}</td>
            <td>${student?.name || '—'}</td>
            <td>${route?.name || '—'}</td>
            <td>${formatCurrency(f.amount)}</td>
            <td>${formatCurrency(f.paidAmount)}</td>
            <td>${statusBadge(status)}</td>
            <td>
              <button class="btn btn-sm btn-success pay-transport-fee" data-id="${f.id}">💳 ${lbl('دفع','Pay')}</button>
              <button class="btn btn-sm btn-outline edit-transport-fee" data-id="${f.id}">✏️</button>
              <button class="btn btn-sm btn-danger delete-transport-fee" data-id="${f.id}">🗑️</button>
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="7" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

// ========================= EMPTY STATE =========================
function emptyState(icon, msg) {
  return `<div class="empty-state glass-card"><span class="empty-icon">${icon}</span><h3 class="text-muted">${msg}</h3></div>`;
}

// ========================= ATTACH EVENTS =========================
export function attachTransportationEvents() {
  // Tab switching
  document.getElementById('transport-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    window._transportTab = btn.dataset.tab;
    document.getElementById('transport-tab-content').innerHTML = renderTabContent(btn.dataset.tab);
    document.querySelectorAll('#transport-tabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    attachTabEvents(btn.dataset.tab);
  });
  attachTabEvents(window._transportTab || 'overview');
}

function attachTabEvents(tab) {
  switch (tab) {
    case 'buses':    attachBusEvents();    break;
    case 'routes':   attachRouteEvents();  break;
    case 'students': attachStudentAssignEvents(); break;
    case 'fees':     attachFeeEvents();    break;
  }
}

// ========================= BUS EVENTS =========================
function attachBusEvents() {
  document.getElementById('add-bus-btn')?.addEventListener('click', () => showBusForm());
  document.querySelectorAll('.edit-bus').forEach(b => b.addEventListener('click', () => {
    const bus = state.buses.find(x => x.id === b.dataset.id);
    if (bus) showBusForm(bus);
  }));
  document.querySelectorAll('.delete-bus').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try { await deleteBus(b.dataset.id); showToast(t('deletedSuccess'), 'success'); }
      catch { showToast(t('errorOccurred'), 'error'); }
    });
  }));
}

function showBusForm(bus = null) {
  const isEdit = !!bus;
  showModal(isEdit ? lbl('تعديل حافلة','Edit Bus') : t('addBus'), `
    <form id="bus-form" class="form-grid">
      <div class="form-group">
        <label>${t('plateNumber')} *</label>
        <input type="text" id="bf-plate" class="form-input" value="${bus?.plateNumber||''}" required>
      </div>
      <div class="form-group">
        <label>${t('busModel')}</label>
        <input type="text" id="bf-model" class="form-input" value="${bus?.model||''}">
      </div>
      <div class="form-group">
        <label>${t('busCapacity')} *</label>
        <input type="number" id="bf-cap" class="form-input" min="1" max="80" value="${bus?.capacity||''}">
      </div>
      <div class="form-group">
        <label>${t('driverName')}</label>
        <input type="text" id="bf-driver" class="form-input" value="${bus?.driverName||''}">
      </div>
      <div class="form-group">
        <label>${t('driverPhone')}</label>
        <input type="tel" id="bf-phone" class="form-input" value="${bus?.driverPhone||''}">
      </div>
      <div class="form-group">
        <label>${lbl('الحالة','Status')}</label>
        <select id="bf-status" class="form-select">
          <option value="active" ${bus?.status==='active'||!bus?'selected':''}}>${lbl('نشط','Active')}</option>
          <option value="inactive" ${bus?.status==='inactive'?'selected':''}>${lbl('متوقف','Inactive')}</option>
        </select>
      </div>
      <div class="form-group full-width">
        <label>${lbl('ملاحظات','Notes')}</label>
        <input type="text" id="bf-notes" class="form-input" value="${bus?.notes||''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);
  document.getElementById('bus-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!checkValid({
      plate: { value: document.getElementById('bf-plate').value, required: true, label: t('plateNumber') },
      cap:   { value: Number(document.getElementById('bf-cap').value), required: true, min: 1, label: t('busCapacity') },
    }, state.lang)) return;
    const data = {
      plateNumber: document.getElementById('bf-plate').value.trim(),
      model:       document.getElementById('bf-model').value.trim(),
      capacity:    Number(document.getElementById('bf-cap').value),
      driverName:  document.getElementById('bf-driver').value.trim(),
      driverPhone: document.getElementById('bf-phone').value.trim(),
      status:      document.getElementById('bf-status').value,
      notes:       document.getElementById('bf-notes').value.trim(),
    };
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      await saveBus(data, bus?.id);
      showToast(t('savedSuccess'), 'success');
      closeModal();
    } catch { showToast(t('errorOccurred'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = t('save'); }
  });
}

// ========================= ROUTE EVENTS =========================
function attachRouteEvents() {
  document.getElementById('add-route-btn')?.addEventListener('click', () => showRouteForm());
  document.querySelectorAll('.edit-route').forEach(b => b.addEventListener('click', () => {
    const route = state.routes.find(x => x.id === b.dataset.id);
    if (route) showRouteForm(route);
  }));
  document.querySelectorAll('.delete-route').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try { await deleteRoute(b.dataset.id); showToast(t('deletedSuccess'), 'success'); }
      catch { showToast(t('errorOccurred'), 'error'); }
    });
  }));
}

function showRouteForm(route = null) {
  const isEdit = !!route;
  const initialStops = route?.stops || [{ name: '', time: '', order: 0 }];
  const busOptions = state.buses.map(b => `<option value="${b.id}" ${route?.busId===b.id?'selected':''}>${b.plateNumber} (${b.driverName||lbl('بدون سائق','No driver')})</option>`).join('');

  showModal(isEdit ? lbl('تعديل مسار','Edit Route') : t('addRoute'), `
    <form id="route-form" class="form-grid">
      <div class="form-group full-width">
        <label>${t('routeName')} *</label>
        <input type="text" id="rf-name" class="form-input" value="${route?.name||''}" required>
      </div>
      <div class="form-group">
        <label>${t('monthlyCost')} (${ar()?'ر.س':'SAR'}) *</label>
        <input type="number" id="rf-cost" class="form-input" min="0" value="${route?.monthlyCost||''}">
      </div>
      <div class="form-group">
        <label>${lbl('الحافلة','Bus')}</label>
        <select id="rf-bus" class="form-select">
          <option value="">${lbl('اختر حافلة','Select bus')}</option>
          ${busOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${t('morningTime')}</label>
        <input type="time" id="rf-morning" class="form-input" value="${route?.morningTime||''}">
      </div>
      <div class="form-group">
        <label>${t('afternoonTime')}</label>
        <input type="time" id="rf-afternoon" class="form-input" value="${route?.afternoonTime||''}">
      </div>
      <div class="form-group full-width">
        <label>${lbl('وصف المسار','Route Description')}</label>
        <input type="text" id="rf-desc" class="form-input" value="${route?.description||''}">
      </div>

      <!-- Stops -->
      <div class="form-group full-width">
        <label>${t('stops')}</label>
        <div id="stops-container">
          ${initialStops.map((s, i) => stopRow(s, i)).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline" id="add-stop-btn" style="margin-top:.5rem">
          + ${lbl('إضافة محطة','Add Stop')}
        </button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  // Dynamic stop adding
  let stopCount = initialStops.length;
  document.getElementById('add-stop-btn')?.addEventListener('click', () => {
    const container = document.getElementById('stops-container');
    const div = document.createElement('div');
    div.innerHTML = stopRow({ name: '', time: '' }, stopCount++);
    container.appendChild(div.firstElementChild);
  });
  document.getElementById('stops-container')?.addEventListener('click', e => {
    if (e.target.closest('.remove-stop-btn')) e.target.closest('.stop-row').remove();
  });

  document.getElementById('route-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('rf-name').value.trim();
    if (!checkValid({ name: { value: name, required: true, label: t('routeName') } }, state.lang)) return;

    const stopRows = document.querySelectorAll('#stops-container .stop-row');
    const stops = Array.from(stopRows).map((row, i) => ({
      name:  row.querySelector('.stop-name-input').value.trim(),
      time:  row.querySelector('.stop-time-input').value,
      order: i
    })).filter(s => s.name);

    const data = {
      name,
      description: document.getElementById('rf-desc').value.trim(),
      busId:        document.getElementById('rf-bus').value || null,
      monthlyCost:  Number(document.getElementById('rf-cost').value) || 0,
      morningTime:  document.getElementById('rf-morning').value,
      afternoonTime:document.getElementById('rf-afternoon').value,
      stops,
    };
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      await saveRoute(data, route?.id);
      showToast(t('savedSuccess'), 'success');
      closeModal();
    } catch { showToast(t('errorOccurred'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = t('save'); }
  });
}

function stopRow(stop, idx) {
  return `<div class="stop-row" style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem">
    <input type="text" class="form-input stop-name-input" placeholder="${lbl('اسم المحطة','Stop name')}" value="${stop.name||''}" style="flex:1">
    <input type="time" class="form-input stop-time-input" value="${stop.time||''}" style="width:120px">
    <button type="button" class="btn btn-sm btn-danger remove-stop-btn" style="flex-shrink:0">✕</button>
  </div>`;
}

// ========================= STUDENT ASSIGN EVENTS =========================
function attachStudentAssignEvents() {
  document.getElementById('assign-student-btn')?.addEventListener('click', () => showAssignForm());
  document.querySelectorAll('.edit-rs').forEach(b => b.addEventListener('click', () => {
    const rs = state.routeStudents.find(x => x.id === b.dataset.id);
    if (rs) showAssignForm(rs);
  }));
  document.querySelectorAll('.remove-rs').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try { await removeRouteStudent(b.dataset.id); showToast(t('deletedSuccess'), 'success'); }
      catch { showToast(t('errorOccurred'), 'error'); }
    });
  }));
}

function showAssignForm(rs = null) {
  const isEdit = !!rs;
  const routeOptions = state.routes.map(r =>
    `<option value="${r.id}" ${rs?.routeId===r.id?'selected':''}>${r.name}</option>`).join('');
  const studentOptions = state.students.map(s =>
    `<option value="${s.id}" ${rs?.studentId===s.id?'selected':''}>${s.name}</option>`).join('');
  const selRoute = rs ? state.routes.find(r => r.id === rs.routeId) : state.routes[0];
  const stopOptions = (selRoute?.stops||[]).sort((a,b)=>a.order-b.order)
    .map(s => `<option value="${s.name}" ${rs?.boardingStop===s.name?'selected':''}>${s.name}</option>`).join('');

  showModal(isEdit ? lbl('تعديل تسجيل','Edit Assignment') : t('assignStudent'), `
    <form id="assign-form" class="form-grid">
      <div class="form-group full-width">
        <label>${t('students')} *</label>
        <select id="af-student" class="form-select" required ${isEdit?'disabled':''}>${studentOptions}</select>
      </div>
      <div class="form-group full-width">
        <label>${t('routeName')} *</label>
        <select id="af-route" class="form-select" required>${routeOptions}</select>
      </div>
      <div class="form-group">
        <label>${t('boardingStop')}</label>
        <select id="af-stop" class="form-select">${stopOptions}</select>
      </div>
      <div class="form-group">
        <label>${t('direction')}</label>
        <select id="af-dir" class="form-select">
          <option value="both"    ${rs?.direction==='both'||!rs?'selected':''}>${lbl('ذهاب وإياب','Both')}</option>
          <option value="morning" ${rs?.direction==='morning'?'selected':''}>${lbl('ذهاب فقط','Morning only')}</option>
          <option value="afternoon" ${rs?.direction==='afternoon'?'selected':''}>${lbl('إياب فقط','Afternoon only')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${lbl('الحالة','Status')}</label>
        <select id="af-status" class="form-select">
          <option value="active" ${rs?.status==='active'||!rs?'selected':''}>${lbl('نشط','Active')}</option>
          <option value="suspended" ${rs?.status==='suspended'?'selected':''}>${lbl('موقوف','Suspended')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${lbl('تاريخ البدء','Start Date')}</label>
        <input type="date" id="af-start" class="form-input" value="${rs?.startDate||new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('assign-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      studentId:   document.getElementById('af-student').value,
      routeId:     document.getElementById('af-route').value,
      boardingStop:document.getElementById('af-stop').value,
      direction:   document.getElementById('af-dir').value,
      status:      document.getElementById('af-status').value,
      startDate:   document.getElementById('af-start').value,
    };
    if (!checkValid({
      student: { value: data.studentId, required: true, label: t('students') },
      route:   { value: data.routeId,   required: true, label: t('routeName') },
    }, state.lang)) return;
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateRouteStudent(rs.id, data);
      else await assignStudent(data);
      showToast(t('savedSuccess'), 'success');
      closeModal();
    } catch (err) {
      showToast(err.message === 'already_assigned' ? lbl('الطالب مسجل مسبقاً في هذا المسار','Student already on this route') : t('errorOccurred'), 'error');
    } finally { btn.disabled = false; btn.innerHTML = t('save'); }
  });
}

// ========================= FEE EVENTS =========================
function attachFeeEvents() {
  document.getElementById('fee-month-sel')?.addEventListener('change', e => {
    window._transportFeeMonth = Number(e.target.value);
    document.getElementById('transport-tab-content').innerHTML = renderFees();
    attachFeeEvents();
  });
  document.getElementById('fee-year-sel')?.addEventListener('change', e => {
    window._transportFeeYear = Number(e.target.value);
    document.getElementById('transport-tab-content').innerHTML = renderFees();
    attachFeeEvents();
  });

  document.getElementById('gen-fees-btn')?.addEventListener('click', async () => {
    const m = window._transportFeeMonth ?? new Date().getMonth();
    const y = window._transportFeeYear  ?? new Date().getFullYear();
    const btn = document.getElementById('gen-fees-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      const count = await generateMonthlyFees(m, y);
      showToast(count > 0 ? lbl(`تم توليد ${count} أجرة جديدة`, `Generated ${count} new fees`) : lbl('لا توجد أجور جديدة للتوليد','No new fees to generate'), count > 0 ? 'success' : 'info');
    } catch { showToast(t('errorOccurred'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = `⚡ ${lbl('توليد أجور الشهر','Generate Month Fees')}`; }
  });

  document.getElementById('add-transport-fee-btn')?.addEventListener('click', () => showTransportFeeForm());

  document.querySelectorAll('.pay-transport-fee').forEach(b => b.addEventListener('click', () => {
    const fee = state.transportFees.find(f => f.id === b.dataset.id);
    if (fee) showPayForm(fee);
  }));
  document.querySelectorAll('.edit-transport-fee').forEach(b => b.addEventListener('click', () => {
    const fee = state.transportFees.find(f => f.id === b.dataset.id);
    if (fee) showTransportFeeForm(fee);
  }));
  document.querySelectorAll('.delete-transport-fee').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try { await deleteTransportFee(b.dataset.id); showToast(t('deletedSuccess'), 'success'); }
      catch { showToast(t('errorOccurred'), 'error'); }
    });
  }));
}

function showTransportFeeForm(fee = null) {
  const now = new Date();
  showModal(fee ? lbl('تعديل أجرة','Edit Fee') : lbl('إضافة أجرة','Add Fee'), `
    <form id="tfee-form" class="form-grid">
      <div class="form-group">
        <label>${t('students')} *</label>
        <select id="tf-student" class="form-select" required>
          ${state.students.map(s => `<option value="${s.id}" ${fee?.studentId===s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${lbl('المسار','Route')} *</label>
        <select id="tf-route" class="form-select" required>
          ${state.routes.map(r => `<option value="${r.id}" ${fee?.routeId===r.id?'selected':''}>${r.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${lbl('الشهر','Month')}</label>
        <select id="tf-month" class="form-select">
          ${MONTHS_AR.map((m,i) => `<option value="${i}" ${(fee?.month??now.getMonth())===i?'selected':''}>${ar()?m:MONTHS_EN[i]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${lbl('السنة','Year')}</label>
        <input type="number" id="tf-year" class="form-input" value="${fee?.year||now.getFullYear()}">
      </div>
      <div class="form-group">
        <label>${lbl('المبلغ','Amount')} *</label>
        <input type="number" id="tf-amount" class="form-input" min="0" value="${fee?.amount||''}">
      </div>
      <div class="form-group">
        <label>${lbl('المدفوع','Paid Amount')}</label>
        <input type="number" id="tf-paid" class="form-input" min="0" value="${fee?.paidAmount||0}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);
  document.getElementById('tfee-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const amount = Number(document.getElementById('tf-amount').value);
    if (!checkValid({ amount: { value: amount, required: true, min: 0, label: lbl('المبلغ','Amount') } }, state.lang)) return;
    const paidAmount = Number(document.getElementById('tf-paid').value) || 0;
    const data = {
      studentId:  document.getElementById('tf-student').value,
      routeId:    document.getElementById('tf-route').value,
      month:      Number(document.getElementById('tf-month').value),
      year:       Number(document.getElementById('tf-year').value),
      amount, paidAmount,
      status: paidAmount >= amount ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    };
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      await saveTransportFee(data, fee?.id);
      showToast(t('savedSuccess'), 'success'); closeModal();
    } catch { showToast(t('errorOccurred'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = t('save'); }
  });
}

function showPayForm(fee) {
  const remaining = (fee.amount||0) - (fee.paidAmount||0);
  showModal(lbl('تسجيل دفع','Record Payment'), `
    <form id="pay-form" class="form-grid">
      <div class="form-group full-width">
        <div class="glass-card" style="padding:.75rem 1rem">
          <div style="display:flex;justify-content:space-between">
            <span>${lbl('المبلغ الإجمالي','Total')}</span><strong>${formatCurrency(fee.amount)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>${lbl('المدفوع','Paid')}</span><strong style="color:var(--success)">${formatCurrency(fee.paidAmount)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>${lbl('المتبقي','Remaining')}</span><strong style="color:var(--danger)">${formatCurrency(remaining)}</strong>
          </div>
        </div>
      </div>
      <div class="form-group full-width">
        <label>${lbl('مبلغ الدفع','Payment Amount')} *</label>
        <input type="number" id="pay-amount" class="form-input" min="1" max="${remaining}" value="${remaining}" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-success">💳 ${lbl('تأكيد الدفع','Confirm Payment')}</button>
      </div>
    </form>`);
  document.getElementById('pay-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payAmt = Number(document.getElementById('pay-amount').value);
    if (!checkValid({ pay: { value: payAmt, required: true, min: 1, label: lbl('مبلغ الدفع','Payment Amount') } }, state.lang)) return;
    const newPaid = Math.min((fee.paidAmount||0) + payAmt, fee.amount||0);
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      await saveTransportFee({ paidAmount: newPaid, status: newPaid >= fee.amount ? 'paid' : 'partial', paidDate: new Date().toISOString() }, fee.id);
      showToast(lbl('تم تسجيل الدفع','Payment recorded'), 'success'); closeModal();
    } catch { showToast(t('errorOccurred'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = `💳 ${lbl('تأكيد الدفع','Confirm Payment')}`; }
  });
}
