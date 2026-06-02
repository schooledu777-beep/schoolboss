/**
 * superAdmin.js — لوحة تحكم Super Admin
 * يُعرض فقط للمستخدم الذي email == BOOTSTRAP_ADMIN_EMAIL أو isSuperAdmin == true
 */
import { state } from '../state.js';
import { showToast, showConfirm } from '../ui.js';
import {
  createActivationCode, listActivationCodes,
  listTenants, setTenantStatus,
} from '../services/tenantService.js';

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderSuperAdmin() {
  if (!state.isSuperAdmin) {
    return `<div class="page-content animate-in">
      <div class="page-header"><h2>🔒 غير مصرح</h2></div></div>`;
  }
  const isAr = state.lang === 'ar';
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>🛡️ ${isAr ? 'لوحة Super Admin' : 'Super Admin Panel'}</h2>
      <button class="btn btn-primary" id="sa-new-code-btn">
        + ${isAr ? 'إنشاء كود تفعيل' : 'New Activation Code'}
      </button>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid" id="sa-stats" style="margin-bottom:1.5rem">
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">⏳</div>
        <div style="font-size:.8rem;opacity:.6">${isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar" style="margin-bottom:1rem">
      <button class="tab-btn active" data-tab="codes">
        🔑 ${isAr ? 'أكواد التفعيل' : 'Activation Codes'}
      </button>
      <button class="tab-btn" data-tab="tenants">
        🏫 ${isAr ? 'المدارس المسجلة' : 'Registered Schools'}
      </button>
    </div>

    <div id="sa-tab-codes" class="sa-tab-panel">
      <div class="glass-card" style="padding:1rem">
        <div id="codes-table-wrap">
          <p class="text-muted text-center">⏳ ${isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    </div>

    <div id="sa-tab-tenants" class="sa-tab-panel" style="display:none">
      <div class="glass-card" style="padding:1rem">
        <div id="tenants-table-wrap">
          <p class="text-muted text-center">⏳ ${isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function attachSuperAdminEvents() {
  if (!state.isSuperAdmin) return;

  // Load data
  await Promise.all([loadCodes(), loadTenants()]);

  // New code button
  document.getElementById('sa-new-code-btn')?.addEventListener('click', showNewCodeModal);

  // Tab switching
  document.querySelectorAll('.sa-tab-panel').forEach(() => {});
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sa-tab-panel').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      document.getElementById(`sa-tab-${btn.dataset.tab}`).style.display = '';
    });
  });
}

// ─── Load Codes ──────────────────────────────────────────────────────────────

async function loadCodes() {
  const isAr = state.lang === 'ar';
  const wrap = document.getElementById('codes-table-wrap');
  if (!wrap) return;

  try {
    const codes = await listActivationCodes();

    // Stats
    const pending  = codes.filter(c => c.status === 'pending').length;
    const used     = codes.filter(c => c.status === 'used').length;
    const total    = codes.length;
    const statsEl  = document.getElementById('sa-stats');
    if (statsEl) statsEl.innerHTML = `
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">🔑</div>
        <div style="font-size:1.6rem;font-weight:700">${total}</div>
        <div style="font-size:.8rem;opacity:.6">${isAr ? 'إجمالي الأكواد' : 'Total Codes'}</div>
      </div>
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">⏳</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--warning)">${pending}</div>
        <div style="font-size:.8rem;opacity:.6">${isAr ? 'بانتظار التفعيل' : 'Pending'}</div>
      </div>
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">✅</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--success)">${used}</div>
        <div style="font-size:.8rem;opacity:.6">${isAr ? 'مُفعَّل' : 'Activated'}</div>
      </div>`;

    if (!codes.length) {
      wrap.innerHTML = `<p class="text-muted text-center">${isAr ? 'لا توجد أكواد بعد' : 'No codes yet'}</p>`;
      return;
    }

    const statusBadge = s => ({
      pending:   '<span class="badge badge-warning">⏳ انتظار</span>',
      used:      '<span class="badge badge-success">✅ مُفعَّل</span>',
      suspended: '<span class="badge badge-danger">🚫 موقوف</span>',
      active:    '<span class="badge badge-info">🟢 نشط</span>',
    }[s] || `<span class="badge">${s}</span>`);

    wrap.innerHTML = `
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr>
          <th>${isAr?'الكود':'Code'}</th>
          <th>${isAr?'اسم المدرسة':'School'}</th>
          <th>${isAr?'الخطة':'Plan'}</th>
          <th>${isAr?'الحالة':'Status'}</th>
          <th>${isAr?'الاستخدام':'Used By'}</th>
          <th>${isAr?'الإنشاء':'Created'}</th>
          <th>${isAr?'إجراءات':'Actions'}</th>
        </tr></thead>
        <tbody>
        ${codes.map(c => `
          <tr>
            <td><code style="font-size:.9rem;letter-spacing:.1em;color:var(--primary-light)">${c.id}</code></td>
            <td>${c.schoolName || '—'}</td>
            <td><span class="badge badge-info">${c.plan || '—'}</span></td>
            <td>${statusBadge(c.status)}</td>
            <td style="font-size:.8rem;opacity:.7">${c.usedBy ? `${c.usedBy.slice(0,8)}…` : '—'}</td>
            <td style="font-size:.8rem;opacity:.7">${c.createdAt?.slice(0,10) || '—'}</td>
            <td>
              <button class="btn btn-sm btn-outline copy-code-btn" data-code="${c.id}" title="${isAr?'نسخ الكود':'Copy code'}">📋</button>
              ${c.status !== 'suspended' ? `<button class="btn btn-sm btn-danger suspend-code-btn" data-code="${c.id}">🚫</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

    // Copy buttons
    wrap.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.code).catch(() => {});
        showToast(isAr ? `✅ تم نسخ الكود: ${btn.dataset.code}` : `✅ Copied: ${btn.dataset.code}`, 'success');
      });
    });

  } catch(e) {
    console.error('[SuperAdmin] loadCodes error:', e);
    wrap.innerHTML = `<p class="text-muted text-center text-danger">⚠️ ${e.message}</p>`;
  }
}

// ─── Load Tenants ─────────────────────────────────────────────────────────────

async function loadTenants() {
  const isAr = state.lang === 'ar';
  const wrap = document.getElementById('tenants-table-wrap');
  if (!wrap) return;

  try {
    const tenants = await listTenants();
    if (!tenants.length) {
      wrap.innerHTML = `<p class="text-muted text-center">${isAr ? 'لا توجد مدارس مسجلة بعد' : 'No schools registered yet'}</p>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr>
          <th>${isAr?'اسم المدرسة':'School'}</th>
          <th>${isAr?'المدير':'Admin'}</th>
          <th>${isAr?'الخطة':'Plan'}</th>
          <th>${isAr?'الحالة':'Status'}</th>
          <th>${isAr?'تاريخ التسجيل':'Registered'}</th>
          <th>${isAr?'إجراءات':'Actions'}</th>
        </tr></thead>
        <tbody>
        ${tenants.map(t => `
          <tr>
            <td><strong>${t.name || '—'}</strong></td>
            <td style="font-size:.85rem">${t.adminEmail || '—'}</td>
            <td><span class="badge badge-info">${t.plan || '—'}</span></td>
            <td>${t.status === 'active'
              ? '<span class="badge badge-success">🟢 نشط</span>'
              : '<span class="badge badge-danger">🚫 موقوف</span>'}</td>
            <td style="font-size:.8rem;opacity:.7">${t.createdAt?.slice(0,10) || '—'}</td>
            <td>
              ${t.status === 'active'
                ? `<button class="btn btn-sm btn-danger sa-suspend-tenant" data-id="${t.id}" data-name="${t.name||''}">🚫 ${isAr?'إيقاف':'Suspend'}</button>`
                : `<button class="btn btn-sm btn-outline sa-activate-tenant" data-id="${t.id}" data-name="${t.name||''}">✅ ${isAr?'تفعيل':'Activate'}</button>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

    wrap.querySelectorAll('.sa-suspend-tenant').forEach(btn =>
      btn.addEventListener('click', async () => {
        showConfirm(
          isAr ? 'إيقاف المدرسة' : 'Suspend School',
          isAr ? `هل تريد إيقاف مدرسة "${btn.dataset.name}"؟ لن يتمكن المدير من الدخول.`
               : `Suspend school "${btn.dataset.name}"? The admin will lose access.`,
          async () => {
            await setTenantStatus(btn.dataset.id, 'suspended');
            showToast(isAr ? '🚫 تم إيقاف المدرسة' : '🚫 School suspended', 'warning');
            await loadTenants();
          }
        );
      })
    );
    wrap.querySelectorAll('.sa-activate-tenant').forEach(btn =>
      btn.addEventListener('click', async () => {
        await setTenantStatus(btn.dataset.id, 'active');
        showToast(isAr ? '✅ تم تفعيل المدرسة' : '✅ School activated', 'success');
        await loadTenants();
      })
    );

  } catch(e) {
    wrap.innerHTML = `<p class="text-muted text-center text-danger">⚠️ ${e.message}</p>`;
  }
}

// ─── New Activation Code Modal ────────────────────────────────────────────────

function showNewCodeModal() {
  const isAr = state.lang === 'ar';
  // Remove any existing modal
  document.getElementById('sa-code-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sa-code-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:480px;padding:2rem;border-radius:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <h3 style="margin:0">🔑 ${isAr ? 'كود تفعيل جديد' : 'New Activation Code'}</h3>
        <button id="sa-modal-close" class="btn btn-sm btn-outline">✕</button>
      </div>
      <form id="sa-code-form" class="form-grid">
        <div class="form-group full-width">
          <label>${isAr ? 'اسم المدرسة (اختياري)' : 'School Name (optional)'}</label>
          <input type="text" id="nc-school" class="form-input" placeholder="${isAr ? 'مدرسة النموذج الإبداعي' : 'Example School'}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'الخطة' : 'Plan'}</label>
          <select id="nc-plan" class="form-select">
            <option value="basic">${isAr ? 'أساسية' : 'Basic'}</option>
            <option value="pro" selected>${isAr ? 'احترافية' : 'Pro'}</option>
            <option value="enterprise">${isAr ? 'مؤسسية' : 'Enterprise'}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${isAr ? 'عدد الطلاب (حد أقصى)' : 'Max Students'}</label>
          <input type="number" id="nc-max" class="form-input" value="500" min="50" max="5000">
        </div>
        <div class="form-group">
          <label>${isAr ? 'صلاحية الكود (أيام)' : 'Code Validity (days)'}</label>
          <input type="number" id="nc-days" class="form-input" value="365" min="1">
        </div>
        <div class="form-group full-width">
          <label>${isAr ? 'ملاحظة داخلية' : 'Internal Note'}</label>
          <input type="text" id="nc-note" class="form-input" placeholder="${isAr ? 'مثلاً: مدرسة الرياض - اتصال يناير' : 'e.g. Riyadh school - Jan contact'}">
        </div>
        <div id="nc-result" class="hidden full-width" style="background:rgba(var(--success-rgb),.1);border:1px solid var(--success);border-radius:.75rem;padding:1.25rem;margin-top:.5rem;text-align:center">
          <p style="margin:0 0 .5rem;font-size:.85rem;opacity:.7">${isAr ? 'تم توليد الكود بنجاح — انسخه والآن' : 'Code generated — copy it now'}</p>
          <div id="nc-code-display" style="font-size:1.6rem;font-weight:800;letter-spacing:.2em;color:var(--primary-light);cursor:pointer;user-select:all"></div>
          <p style="margin:.5rem 0 0;font-size:.78rem;opacity:.6">${isAr ? 'اضغط على الكود لنسخه' : 'Click code to copy'}</p>
        </div>
        <div class="form-actions full-width">
          <button type="button" id="sa-modal-close2" class="btn btn-outline">${isAr ? 'إغلاق' : 'Close'}</button>
          <button type="submit" class="btn btn-primary" id="nc-submit-btn">
            ${isAr ? '✨ إنشاء الكود' : '✨ Generate Code'}
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#sa-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#sa-modal-close2')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#sa-code-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = overlay.querySelector('#nc-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      const { code } = await createActivationCode({
        schoolName:    overlay.querySelector('#nc-school').value.trim(),
        plan:          overlay.querySelector('#nc-plan').value,
        maxStudents:   Number(overlay.querySelector('#nc-max').value),
        expiresInDays: Number(overlay.querySelector('#nc-days').value),
        note:          overlay.querySelector('#nc-note').value.trim(),
      });

      const resultEl  = overlay.querySelector('#nc-result');
      const codeDisp  = overlay.querySelector('#nc-code-display');
      codeDisp.textContent = code;
      resultEl.classList.remove('hidden');

      codeDisp.addEventListener('click', () => {
        navigator.clipboard?.writeText(code).catch(() => {});
        showToast(`✅ ${isAr ? 'تم نسخ الكود' : 'Copied'}: ${code}`, 'success');
      });

      btn.textContent = isAr ? '+ كود آخر' : '+ Another';
      btn.disabled = false;

      // Refresh the codes table in the background
      await loadCodes();
    } catch(err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = isAr ? '✨ إنشاء الكود' : '✨ Generate Code';
    }
  });
}
