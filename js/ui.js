import { state, t } from './state.js';

// ========================= TOAST NOTIFICATIONS =========================
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// ========================= CONFIRM DIALOG =========================
export function showConfirm(title, message, onConfirm, type = 'danger') {
  const overlay = document.getElementById('modal-overlay');
  const dialog = document.getElementById('confirm-dialog');
  const colors = {
    danger: '#ef4444', warning: '#f59e0b', info: '#6366f1', success: '#10b981'
  };
  dialog.innerHTML = `
    <div class="confirm-card">
      <div class="confirm-icon" style="color:${colors[type]}">
        ${type === 'danger' ? '🗑️' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}
      </div>
      <h3 class="confirm-title">${title}</h3>
      <p class="confirm-msg">${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-outline" id="confirm-cancel">${t('cancel')}</button>
        <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirm-ok">${t('confirm')}</button>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
  dialog.classList.remove('hidden');
  document.getElementById('confirm-cancel').onclick = () => { overlay.classList.add('hidden'); dialog.classList.add('hidden'); };
  overlay.onclick = () => { overlay.classList.add('hidden'); dialog.classList.add('hidden'); };
  document.getElementById('confirm-ok').onclick = () => {
    overlay.classList.add('hidden'); dialog.classList.add('hidden');
    onConfirm();
  };
}

// ========================= MODAL =========================
export function showModal(title, contentHTML, options = {}) {
  const overlay = document.getElementById('modal-overlay');
  const dialog = document.getElementById('confirm-dialog');
  dialog.innerHTML = `
    <div class="modal-card ${options.wide ? 'modal-wide' : ''}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-icon modal-close-btn" id="modal-close-x">✕</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
      ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
    </div>`;
  overlay.classList.remove('hidden');
  dialog.classList.remove('hidden');
  document.getElementById('modal-close-x').onclick = () => closeModal();
  overlay.onclick = () => closeModal();
  dialog.querySelector('.modal-card').onclick = e => e.stopPropagation();
  if (options.onOpen) options.onOpen();
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('confirm-dialog').classList.add('hidden');
}

// ========================= LOADING =========================
export function showLoading() {
  document.getElementById('loading-screen').classList.remove('hidden');
}
export function hideLoading() {
  document.getElementById('loading-screen').classList.add('hidden');
}

// ========================= HELPERS =========================
export function formatDate(date) {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString(state.lang === 'ar' ? 'ar-SA' : 'en-US');
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat(state.lang === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency', currency: 'SAR'
  }).format(amount || 0);
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
