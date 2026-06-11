/**
 * superAdmin.js — لوحة تحكم Super Admin
 */
import { state } from '../state.js';
import { showToast, showConfirm } from '../ui.js';
import { db } from '../db.js?v=20260611-tenants2';
import { doc, setDoc } from '../firebase-config.js?v=20260611-tenants2';
import {
  createActivationCode, listActivationCodes,
  listTenants, setTenantStatus,
} from '../services/tenantService.js?v=20260611-tenants2';
import { adminCreateUser } from '../auth.js?v=20260611-tenants2';
import {
  inspectLegacyData, migrateLegacyDataToMain
} from '../services/tenantMigrationService.js';

// ─── Render ───────────────────────────────────────────────────────────────────

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
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-primary" id="sa-create-account-btn">
          👤 ${isAr ? 'إنشاء حساب مدرسة' : 'Create School Account'}
        </button>
        <button class="btn btn-outline" id="sa-new-code-btn">
          🔑 ${isAr ? 'كود تفعيل فقط' : 'Code Only'}
        </button>
        <button class="btn btn-outline" id="sa-migrate-legacy-btn">
          ${isAr ? 'نقل البيانات القديمة' : 'Migrate Legacy Data'}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" id="sa-stats" style="margin-bottom:1.5rem">
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:1.5rem">⏳</div>
        <div style="font-size:.8rem;opacity:.6">${isAr ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar" style="margin-bottom:1rem">
      <button class="tab-btn active" data-tab="accounts">
        🏫 ${isAr ? 'المدارس المسجلة' : 'Registered Schools'}
      </button>
      <button class="tab-btn" data-tab="codes">
        🔑 ${isAr ? 'أكواد التفعيل' : 'Activation Codes'}
      </button>
    </div>

    <div id="sa-tab-accounts" class="sa-tab-panel">
      <div class="glass-card" style="padding:1rem">
        <div id="tenants-table-wrap">
          <p class="text-muted text-center">⏳</p>
        </div>
      </div>
    </div>

    <div id="sa-tab-codes" class="sa-tab-panel" style="display:none">
      <div class="glass-card" style="padding:1rem">
        <div id="codes-table-wrap">
          <p class="text-muted text-center">⏳</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function attachSuperAdminEvents() {
  if (!state.isSuperAdmin) return;

  await Promise.all([loadTenants(), loadCodes()]);

  document.getElementById('sa-create-account-btn')?.addEventListener('click', showCreateAccountModal);
  document.getElementById('sa-new-code-btn')?.addEventListener('click', showNewCodeModal);
  document.getElementById('sa-migrate-legacy-btn')?.addEventListener('click', migrateLegacyData);

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sa-tab-panel').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      document.getElementById(`sa-tab-${btn.dataset.tab}`).style.display = '';
    });
  });
}

async function migrateLegacyData() {
  const isAr = state.lang === 'ar';
  const button = document.getElementById('sa-migrate-legacy-btn');

  try {
    button.disabled = true;
    button.textContent = isAr ? 'جاري الفحص...' : 'Inspecting...';
    const legacy = await inspectLegacyData();

    if (!legacy.length) {
      showToast(isAr ? 'لا توجد بيانات قديمة تحتاج إلى نقل' : 'No legacy data needs migration', 'info');
      return;
    }

    const total = legacy.reduce((sum, item) => sum + item.count, 0);
    showConfirm(
      isAr ? 'نقل البيانات القديمة' : 'Migrate Legacy Data',
      isAr
        ? `سيتم نسخ ${total} سجلاً إلى المدرسة الأساسية دون حذف الأصل. هل تريد المتابعة؟`
        : `${total} records will be copied to the main tenant without deleting the originals. Continue?`,
      async () => {
        try {
          button.disabled = true;
          button.textContent = isAr ? 'جاري النقل...' : 'Migrating...';
          const report = await migrateLegacyDataToMain();
          const migrated = report.reduce((sum, item) => sum + item.count, 0);
          showToast(
            isAr ? `تم نقل ${migrated} سجلاً إلى المدرسة الأساسية` : `Migrated ${migrated} records to the main tenant`,
            'success',
            6000
          );
        } catch (error) {
          console.error('[SuperAdmin] migration error:', error);
          showToast(error.message || 'Migration failed', 'error');
        } finally {
          button.disabled = false;
          button.textContent = isAr ? 'نقل البيانات القديمة' : 'Migrate Legacy Data';
        }
      }
    );
  } catch (error) {
    console.error('[SuperAdmin] migration error:', error);
    showToast(error.message || 'Migration failed', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = isAr ? 'نقل البيانات القديمة' : 'Migrate Legacy Data';
    }
  }
}

// ─── Create School Account Modal ──────────────────────────────────────────────
// هذا هو المسار الرئيسي: Super Admin ينشئ إيميل + كلمة سر + يعطيها للعميل

function showCreateAccountModal() {
  const isAr = state.lang === 'ar';
  removeModal('sa-create-modal');

  const overlay = createOverlay('sa-create-modal', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
      <h3 style="margin:0">👤 ${isAr ? 'إنشاء حساب مدرسة جديدة' : 'Create New School Account'}</h3>
      <button class="btn btn-sm btn-outline close-sa-modal">✕</button>
    </div>

    <form id="sa-create-form" class="form-grid">
      <div class="form-group full-width">
        <label>${isAr ? 'اسم المدرسة *' : 'School Name *'}</label>
        <input type="text" id="ca-school" class="form-input"
          placeholder="${isAr ? 'مدرسة الرياض الإبداعية' : 'Riyadh Creative School'}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'إيميل المدير *' : 'Admin Email *'}</label>
        <input type="email" id="ca-email" class="form-input"
          placeholder="admin@school.com" required>
      </div>
      <div class="form-group" style="position:relative">
        <label>${isAr ? 'كلمة المرور *' : 'Password *'}</label>
        <div style="display:flex;gap:.5rem">
          <input type="text" id="ca-password" class="form-input"
            placeholder="${isAr ? '6 أحرف على الأقل' : 'Min 6 characters'}" required minlength="6"
            value="${generatePassword()}">
          <button type="button" class="btn btn-outline" id="ca-regen-pwd" title="${isAr?'توليد كلمة مرور جديدة':'Regenerate'}">🔄</button>
        </div>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الخطة' : 'Plan'}</label>
        <select id="ca-plan" class="form-select">
          <option value="basic">${isAr?'أساسية':'Basic'}</option>
          <option value="pro" selected>${isAr?'احترافية':'Pro'}</option>
          <option value="enterprise">${isAr?'مؤسسية':'Enterprise'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'عدد الطلاب (حد أقصى)' : 'Max Students'}</label>
        <input type="number" id="ca-max" class="form-input" value="500" min="50" max="5000">
      </div>
      <div class="form-group full-width">
        <label>${isAr ? 'ملاحظة داخلية' : 'Internal Note'}</label>
        <input type="text" id="ca-note" class="form-input"
          placeholder="${isAr ? 'مثلاً: عميل يناير - متابعة أحمد' : 'e.g. Jan client - Ahmed follow-up'}">
      </div>

      <!-- Result card — hidden until success -->
      <div id="ca-result" class="hidden full-width" style="
        background:rgba(34,197,94,.08);border:1.5px solid var(--success);
        border-radius:.85rem;padding:1.5rem;margin-top:.5rem">
        <h4 style="margin:0 0 1rem;color:var(--success)">
          ✅ ${isAr ? 'تم إنشاء الحساب بنجاح!' : 'Account created successfully!'}
        </h4>
        <div class="form-grid" style="gap:.75rem">
          <div class="form-group">
            <label style="font-size:.75rem;opacity:.7">${isAr ? 'اسم المدرسة' : 'School'}</label>
            <div id="ca-r-school" style="font-weight:600"></div>
          </div>
          <div class="form-group">
            <label style="font-size:.75rem;opacity:.7">${isAr ? 'الإيميل' : 'Email'}</label>
            <div id="ca-r-email" style="font-weight:600;color:var(--primary-light)"></div>
          </div>
          <div class="form-group">
            <label style="font-size:.75rem;opacity:.7">${isAr ? 'كلمة المرور' : 'Password'}</label>
            <div id="ca-r-password" style="font-size:1.2rem;font-weight:800;letter-spacing:.1em;color:var(--primary-light);cursor:pointer" title="${isAr?'اضغط للنسخ':'Click to copy'}"></div>
          </div>
          <div class="form-group">
            <label style="font-size:.75rem;opacity:.7">${isAr ? 'رابط الدخول' : 'Login URL'}</label>
            <div style="font-size:.8rem;opacity:.7;word-break:break-all" id="ca-r-url"></div>
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="ca-copy-all" style="margin-top:.75rem;width:100%">
          📋 ${isAr ? 'نسخ بيانات الدخول كاملة' : 'Copy All Credentials'}
        </button>
      </div>

      <div class="form-actions full-width" style="margin-top:.5rem">
        <button type="button" class="btn btn-outline close-sa-modal">${isAr ? 'إغلاق' : 'Close'}</button>
        <button type="submit" class="btn btn-primary" id="ca-submit-btn">
          ✨ ${isAr ? 'إنشاء الحساب' : 'Create Account'}
        </button>
      </div>
    </form>`);

  // Regenerate password
  overlay.querySelector('#ca-regen-pwd')?.addEventListener('click', () => {
    overlay.querySelector('#ca-password').value = generatePassword();
  });

  // Close buttons
  overlay.querySelectorAll('.close-sa-modal').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Submit
  overlay.querySelector('#sa-create-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn       = overlay.querySelector('#ca-submit-btn');
    const schoolName = overlay.querySelector('#ca-school').value.trim();
    const email      = overlay.querySelector('#ca-email').value.trim();
    const password   = overlay.querySelector('#ca-password').value.trim();
    const plan       = overlay.querySelector('#ca-plan').value;
    const maxStudents= Number(overlay.querySelector('#ca-max').value);
    const note       = overlay.querySelector('#ca-note').value.trim();

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري الإنشاء...' : 'Creating...'}`;

    try {
      // 1. Create Firebase Auth account (secondary app — doesn't log out super admin)
      const uid = await adminCreateUser(email, password, 'admin', schoolName, { tenantId: null });

      // 2. Create activation code + tenant config in one step
      const { code } = await createActivationCode({ schoolName, plan, maxStudents, note });

      // 3. Import and consume the code immediately (no need for client to enter it)
      const { consumeActivationCode } = await import('../services/tenantService.js?v=20260611-tenants2');
      const tenantId = await consumeActivationCode(code, uid, email, schoolName);

      // 4. Patch user profile with tenantId so it's ready on first login
      await setDoc(doc(db, 'users', uid), {
        tenantId,
        role: 'admin',
        name: schoolName,
        accountStatus: 'active',
      }, { merge: true });

      // Show result card
      const result = overlay.querySelector('#ca-result');
      overlay.querySelector('#ca-r-school').textContent   = schoolName;
      overlay.querySelector('#ca-r-email').textContent    = email;
      overlay.querySelector('#ca-r-password').textContent = password;
      overlay.querySelector('#ca-r-url').textContent      = window.location.origin + window.location.pathname;
      result.classList.remove('hidden');

      // Click password to copy
      overlay.querySelector('#ca-r-password').addEventListener('click', () => {
        navigator.clipboard?.writeText(password).catch(() => {});
        showToast(isAr ? '✅ تم نسخ كلمة المرور' : '✅ Password copied', 'success');
      });

      // Copy all button
      overlay.querySelector('#ca-copy-all').addEventListener('click', () => {
        const text = `${isAr?'مدرسة':'School'}: ${schoolName}\n${isAr?'إيميل':'Email'}: ${email}\n${isAr?'كلمة المرور':'Password'}: ${password}\n${isAr?'رابط الدخول':'URL'}: ${window.location.origin + window.location.pathname}`;
        navigator.clipboard?.writeText(text).catch(() => {});
        showToast(isAr ? '✅ تم نسخ جميع البيانات' : '✅ All credentials copied', 'success');
      });

      btn.textContent = isAr ? '+ حساب آخر' : '+ Another';
      btn.disabled = false;

      // Reset form for next entry
      overlay.querySelector('#ca-school').value = '';
      overlay.querySelector('#ca-email').value  = '';
      overlay.querySelector('#ca-password').value = generatePassword();

      // Refresh tenants list
      await loadTenants();

    } catch(err) {
      console.error('[SuperAdmin] createAccount error:', err);
      showToast(isAr ? `❌ ${err.message || 'حدث خطأ'}` : `❌ ${err.message || 'Error'}`, 'error');
      btn.disabled = false;
      btn.innerHTML = `✨ ${isAr ? 'إنشاء الحساب' : 'Create Account'}`;
    }
  });
}

// ─── Activation Code Only Modal ───────────────────────────────────────────────
// للحالات التي يريد فيها العميل التسجيل بنفسه

function showNewCodeModal() {
  const isAr = state.lang === 'ar';
  removeModal('sa-code-modal');

  const overlay = createOverlay('sa-code-modal', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
      <h3 style="margin:0">🔑 ${isAr ? 'كود تفعيل (للتسجيل الذاتي)' : 'Activation Code (Self-Register)'}</h3>
      <button class="btn btn-sm btn-outline close-sa-modal">✕</button>
    </div>
    <form id="sa-code-form" class="form-grid">
      <div class="form-group full-width">
        <label>${isAr ? 'اسم المدرسة (اختياري)' : 'School Name (optional)'}</label>
        <input type="text" id="nc-school" class="form-input" placeholder="${isAr?'مدرسة النموذج':'Example School'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الخطة' : 'Plan'}</label>
        <select id="nc-plan" class="form-select">
          <option value="basic">${isAr?'أساسية':'Basic'}</option>
          <option value="pro" selected>${isAr?'احترافية':'Pro'}</option>
          <option value="enterprise">${isAr?'مؤسسية':'Enterprise'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'حد أقصى للطلاب' : 'Max Students'}</label>
        <input type="number" id="nc-max" class="form-input" value="500" min="50">
      </div>
      <div id="nc-result" class="hidden full-width" style="
        background:rgba(var(--success-rgb),.1);border:1px solid var(--success);
        border-radius:.75rem;padding:1.25rem;text-align:center">
        <p style="margin:0 0 .5rem;font-size:.85rem;opacity:.7">
          ${isAr ? 'أرسل هذا الكود للعميل' : 'Send this code to the client'}
        </p>
        <div id="nc-code-display"
          style="font-size:1.8rem;font-weight:800;letter-spacing:.2em;color:var(--primary-light);cursor:pointer;user-select:all"></div>
        <p style="margin:.5rem 0 0;font-size:.78rem;opacity:.5">${isAr?'اضغط للنسخ':'Click to copy'}</p>
      </div>
      <div class="form-actions full-width">
        <button type="button" class="btn btn-outline close-sa-modal">${isAr?'إغلاق':'Close'}</button>
        <button type="submit" class="btn btn-primary" id="nc-submit-btn">
          ✨ ${isAr?'توليد الكود':'Generate Code'}
        </button>
      </div>
    </form>`);

  overlay.querySelectorAll('.close-sa-modal').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#sa-code-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = overlay.querySelector('#nc-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      const { code } = await createActivationCode({
        schoolName:  overlay.querySelector('#nc-school').value.trim(),
        plan:        overlay.querySelector('#nc-plan').value,
        maxStudents: Number(overlay.querySelector('#nc-max').value),
        expiresInDays: 365,
      });
      const disp = overlay.querySelector('#nc-code-display');
      disp.textContent = code;
      overlay.querySelector('#nc-result').classList.remove('hidden');
      disp.addEventListener('click', () => {
        navigator.clipboard?.writeText(code).catch(() => {});
        showToast(`✅ ${isAr?'تم نسخ الكود':'Copied'}: ${code}`, 'success');
      });
      btn.textContent = isAr ? '+ كود آخر' : '+ Another';
      btn.disabled = false;
      await loadCodes();
    } catch(err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = isAr ? '✨ توليد الكود' : '✨ Generate Code';
    }
  });
}

// ─── Load Tenants ─────────────────────────────────────────────────────────────

async function loadTenants() {
  const isAr = state.lang === 'ar';
  const wrap = document.getElementById('tenants-table-wrap');
  if (!wrap) return;

  try {
    const tenants = await listTenants();
    const pending = (await listActivationCodes()).filter(c => c.status === 'pending').length;

    // Stats
    const statsEl = document.getElementById('sa-stats');
    if (statsEl) statsEl.innerHTML = `
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">🏫</div>
        <div style="font-size:1.8rem;font-weight:700">${tenants.length}</div>
        <div style="font-size:.8rem;opacity:.6">${isAr?'مدارس مسجلة':'Schools'}</div>
      </div>
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">✅</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--success)">
          ${tenants.filter(t => t.status === 'active').length}
        </div>
        <div style="font-size:.8rem;opacity:.6">${isAr?'نشطة':'Active'}</div>
      </div>
      <div class="glass-card stat-card" style="padding:1.25rem;text-align:center">
        <div style="font-size:2rem">⏳</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--warning)">${pending}</div>
        <div style="font-size:.8rem;opacity:.6">${isAr?'أكواد معلقة':'Pending Codes'}</div>
      </div>`;

    if (!tenants.length) {
      wrap.innerHTML = `<p class="text-muted text-center" style="padding:2rem">
        ${isAr ? '🏫 لا توجد مدارس مسجلة بعد — ابدأ بإنشاء حساب أول مدرسة' : 'No schools yet — create the first one!'}
      </p>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr>
          <th>#</th>
          <th>${isAr?'اسم المدرسة':'School'}</th>
          <th>${isAr?'إيميل المدير':'Admin Email'}</th>
          <th>${isAr?'الخطة':'Plan'}</th>
          <th>${isAr?'الطلاب (حد)':'Max Students'}</th>
          <th>${isAr?'الحالة':'Status'}</th>
          <th>${isAr?'تاريخ التسجيل':'Registered'}</th>
          <th>${isAr?'إجراءات':'Actions'}</th>
        </tr></thead>
        <tbody>
        ${tenants.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${t.name || '—'}</strong></td>
            <td style="font-size:.85rem">${t.adminEmail || '—'}</td>
            <td><span class="badge badge-info">${t.plan || '—'}</span></td>
            <td style="text-align:center">${t.maxStudents || '—'}</td>
            <td>${t.status === 'active'
              ? '<span class="badge badge-success">🟢 نشط</span>'
              : '<span class="badge badge-danger">🚫 موقوف</span>'}</td>
            <td style="font-size:.8rem;opacity:.7">${t.createdAt?.slice(0,10) || '—'}</td>
            <td>
              ${t.status === 'active'
                ? `<button class="btn btn-sm btn-danger sa-suspend-tenant" data-id="${t.id}" data-name="${t.name||''}">🚫</button>`
                : `<button class="btn btn-sm btn-outline sa-activate-tenant" data-id="${t.id}">✅</button>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

    wrap.querySelectorAll('.sa-suspend-tenant').forEach(btn =>
      btn.addEventListener('click', () =>
        showConfirm(
          isAr ? 'إيقاف المدرسة' : 'Suspend School',
          isAr ? `إيقاف "${btn.dataset.name}"؟` : `Suspend "${btn.dataset.name}"?`,
          async () => {
            await setTenantStatus(btn.dataset.id, 'suspended');
            showToast(isAr?'🚫 تم الإيقاف':'🚫 Suspended','warning');
            await loadTenants();
          }
        )
      )
    );
    wrap.querySelectorAll('.sa-activate-tenant').forEach(btn =>
      btn.addEventListener('click', async () => {
        await setTenantStatus(btn.dataset.id, 'active');
        showToast(isAr?'✅ تم التفعيل':'✅ Activated','success');
        await loadTenants();
      })
    );

  } catch(e) {
    wrap.innerHTML = `<p class="text-danger text-center">⚠️ ${e.message}</p>`;
  }
}

// ─── Load Codes ───────────────────────────────────────────────────────────────

async function loadCodes() {
  const isAr = state.lang === 'ar';
  const wrap = document.getElementById('codes-table-wrap');
  if (!wrap) return;
  try {
    const codes = await listActivationCodes();
    if (!codes.length) {
      wrap.innerHTML = `<p class="text-muted text-center" style="padding:2rem">${isAr?'لا توجد أكواد':'No codes yet'}</p>`;
      return;
    }
    const badge = s => ({
      pending:   '<span class="badge badge-warning">⏳ انتظار</span>',
      used:      '<span class="badge badge-success">✅ مُستخدم</span>',
      suspended: '<span class="badge badge-danger">🚫 موقوف</span>',
    }[s] || `<span class="badge">${s}</span>`);

    wrap.innerHTML = `
      <div class="table-responsive">
      <table class="data-table">
        <thead><tr>
          <th>${isAr?'الكود':'Code'}</th>
          <th>${isAr?'المدرسة':'School'}</th>
          <th>${isAr?'الخطة':'Plan'}</th>
          <th>${isAr?'الحالة':'Status'}</th>
          <th>${isAr?'تاريخ الإنشاء':'Created'}</th>
          <th></th>
        </tr></thead>
        <tbody>
        ${codes.map(c => `
          <tr>
            <td><code style="letter-spacing:.1em;color:var(--primary-light)">${c.id}</code></td>
            <td>${c.schoolName || '—'}</td>
            <td><span class="badge badge-info">${c.plan||'—'}</span></td>
            <td>${badge(c.status)}</td>
            <td style="font-size:.8rem;opacity:.7">${c.createdAt?.slice(0,10)||'—'}</td>
            <td>
              <button class="btn btn-sm btn-outline copy-code-btn" data-code="${c.id}">📋</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

    wrap.querySelectorAll('.copy-code-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.code).catch(() => {});
        showToast(`✅ ${btn.dataset.code}`, 'success');
      })
    );
  } catch(e) {
    wrap.innerHTML = `<p class="text-danger text-center">⚠️ ${e.message}</p>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createOverlay(id, bodyHTML) {
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
  overlay.innerHTML = `
    <div class="glass-card" style="width:100%;max-width:520px;padding:2rem;border-radius:1rem;max-height:90vh;overflow-y:auto">
      ${bodyHTML}
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function removeModal(id) {
  document.getElementById(id)?.remove();
}
