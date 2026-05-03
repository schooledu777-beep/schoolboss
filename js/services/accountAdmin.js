import { state } from '../state.js';
import { db, doc, updateDoc, setDoc } from '../firebase-config.js?v=20260503-admin-accounts';
import { showModal, closeModal, showToast, escapeHTML } from '../ui.js?v=20260502-photo-sync';
import { adminUpdateManagedPassword, adminSendPasswordReset } from '../auth.js?v=20260503-admin-accounts';

const ROLE_COLLECTIONS = {
  student: 'students',
  teacher: 'teachers',
  parent: 'parents'
};

function accountLabel(role) {
  if (state.lang === 'ar') return ({ student: 'طالب', teacher: 'معلم', parent: 'ولي أمر' }[role] || role);
  return ({ student: 'Student', teacher: 'Teacher', parent: 'Parent' }[role] || role);
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = 'Edu';
  for (let i = 0; i < 7; i++) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value + '!';
}

function getAccountDoc(account, role) {
  return doc(db, ROLE_COLLECTIONS[role], account.id || account.uid);
}

function managedPassword(account) {
  return account?.authManaged?.temporaryPassword || '';
}

export function showAdminAccountModal(account, role) {
  if (state.profile?.role !== 'admin' || !account) return;

  const isAr = state.lang === 'ar';
  const currentPassword = managedPassword(account);
  const status = account.accountStatus || 'active';
  const hasEmail = !!account.email;

  showModal(
    isAr ? `إدارة حساب ${accountLabel(role)}` : `Manage ${accountLabel(role)} Account`,
    `
    <div class="admin-account-panel" data-account-id="${escapeHTML(account.id || account.uid || '')}" data-role="${role}">
      <div class="sp-section-card">
        <h4 class="sp-section-title">${isAr ? 'بيانات الدخول' : 'Login Details'}</h4>
        <div class="sp-info-grid">
          <div class="sp-info-item">
            <span class="sp-info-icon">✉️</span>
            <div>
              <span class="sp-info-label">${isAr ? 'البريد الإلكتروني' : 'Email'}</span>
              <span class="sp-info-value">${escapeHTML(account.email || '—')}</span>
            </div>
          </div>
          <div class="sp-info-item">
            <span class="sp-info-icon">🛡️</span>
            <div>
              <span class="sp-info-label">${isAr ? 'الدور' : 'Role'}</span>
              <span class="sp-info-value">${accountLabel(role)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sp-section-card">
        <h4 class="sp-section-title">${isAr ? 'كلمة المرور المؤقتة المحفوظة' : 'Saved Temporary Password'}</h4>
        <p class="text-muted" style="font-size:.82rem;margin-bottom:1rem">
          ${isAr
            ? 'هذه ليست قراءة لكلمة Firebase الحالية. تظهر فقط الكلمات التي أنشأها المدير من داخل النظام.'
            : 'This is not reading the current Firebase password. It only shows passwords created by admin inside this system.'}
        </p>
        <div class="password-wrapper">
          <input class="form-input" id="saved-temp-password" type="password" readonly value="${escapeHTML(currentPassword || (isAr ? 'غير محفوظة' : 'Not saved'))}">
          <button type="button" class="password-toggle" id="admin-reveal-password">👁</button>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
          <button class="btn btn-sm btn-outline" id="copy-temp-password" ${currentPassword ? '' : 'disabled'}>${isAr ? 'نسخ' : 'Copy'}</button>
          <button class="btn btn-sm btn-outline" id="send-reset-email" ${hasEmail ? '' : 'disabled'}>${isAr ? 'إرسال رابط إعادة تعيين' : 'Send Reset Email'}</button>
        </div>
      </div>

      <form id="admin-account-form" class="form-grid">
        <div class="form-group">
          <label>${isAr ? 'كلمة مرور جديدة' : 'New Password'}</label>
          <input type="text" id="new-admin-password" class="form-input" minlength="6" placeholder="${isAr ? 'اتركها فارغة إذا لا تريد تغييرها' : 'Leave blank if unchanged'}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'حالة الحساب داخل التطبيق' : 'App Account Status'}</label>
          <select id="admin-account-status" class="form-select">
            <option value="active" ${status === 'active' ? 'selected' : ''}>${isAr ? 'نشط' : 'Active'}</option>
            <option value="suspended" ${status === 'suspended' ? 'selected' : ''}>${isAr ? 'موقوف' : 'Suspended'}</option>
          </select>
        </div>
        <div class="form-actions" style="grid-column:1/-1">
          <button type="button" class="btn btn-outline" id="generate-admin-password">${isAr ? 'توليد كلمة' : 'Generate'}</button>
          <button type="button" class="btn btn-outline" onclick="closeModal()">${isAr ? 'إغلاق' : 'Close'}</button>
          <button type="submit" class="btn btn-primary">${isAr ? 'حفظ الصلاحيات' : 'Save Account Settings'}</button>
        </div>
      </form>
    </div>`
  );

  document.getElementById('admin-reveal-password')?.addEventListener('click', () => {
    const input = document.getElementById('saved-temp-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('copy-temp-password')?.addEventListener('click', async () => {
    if (!currentPassword) return;
    await navigator.clipboard?.writeText(currentPassword);
    showToast(isAr ? 'تم نسخ كلمة المرور' : 'Password copied', 'success');
  });

  document.getElementById('send-reset-email')?.addEventListener('click', async () => {
    try {
      await adminSendPasswordReset(account.email);
      showToast(isAr ? 'تم إرسال رابط إعادة التعيين للبريد' : 'Reset email sent', 'success');
    } catch (err) {
      console.error(err);
      showToast(isAr ? 'تعذر إرسال رابط إعادة التعيين' : 'Could not send reset email', 'error');
    }
  });

  document.getElementById('generate-admin-password')?.addEventListener('click', () => {
    document.getElementById('new-admin-password').value = generatePassword();
  });

  document.getElementById('admin-account-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-admin-password').value.trim();
    const newStatus = document.getElementById('admin-account-status').value;
    const updatedAt = new Date().toISOString();
    let authSynced = false;

    try {
      if (newPassword && newPassword.length < 6) {
        showToast(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters', 'error');
        return;
      }

      if (newPassword && account.email && currentPassword) {
        await adminUpdateManagedPassword(account.email, currentPassword, newPassword);
        authSynced = true;
      }

      const patch = {
        accountStatus: newStatus,
        updatedAt
      };

      if (newPassword) {
        patch.authManaged = {
          temporaryPassword: newPassword,
          passwordUpdatedAt: updatedAt,
          passwordSource: authSynced ? 'admin-synced-firebase' : 'admin-saved-temp',
          mustChange: true
        };
      }

      await updateDoc(getAccountDoc(account, role), patch);
      if (account.uid || account.id) {
        await setDoc(doc(db, 'users', account.uid || account.id), {
          uid: account.uid || account.id,
          email: account.email || '',
          name: account.name || '',
          role,
          ...patch
        }, { merge: true });
      }

      Object.assign(account, patch);
      closeModal();
      showToast(
        newPassword && !authSynced
          ? (isAr ? 'تم حفظ كلمة مؤقتة. لتغيير Firebase فعليًا أرسل رابط إعادة تعيين أو استخدم كلمة محفوظة سابقة.' : 'Temporary password saved. Send a reset email if Firebase could not be updated.')
          : (isAr ? 'تم تحديث صلاحيات الحساب' : 'Account settings updated'),
        newPassword && !authSynced ? 'warning' : 'success',
        5000
      );
    } catch (err) {
      console.error(err);
      showToast(isAr ? 'تعذر تحديث الحساب. قد تكون كلمة المرور القديمة غير مطابقة.' : 'Could not update account. The saved old password may be stale.', 'error', 5000);
    }
  });
}
