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
  const colors = { danger:'#ef4444', warning:'#f59e0b', info:'#6366f1', success:'#10b981' };
  dialog.innerHTML = `
    <div class="confirm-card">
      <div class="confirm-icon" style="color:${colors[type]}">
        ${type==='danger'?'🗑️':type==='warning'?'⚠️':type==='success'?'✅':'ℹ️'}
      </div>
      <h3 class="confirm-title">${title}</h3>
      <p class="confirm-msg">${message}</p>
      <div class="confirm-actions">
        <button class="btn btn-outline" id="confirm-cancel">${t('cancel')}</button>
        <button class="btn btn-${type==='danger'?'danger':'primary'}" id="confirm-ok">${t('confirm')}</button>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
  const stopProp = (e) => e.stopPropagation();
  dialog.querySelector('.confirm-card').addEventListener('click', stopProp);
  document.getElementById('confirm-cancel').onclick = () => overlay.classList.add('hidden');
  overlay.onclick = () => overlay.classList.add('hidden');
  document.getElementById('confirm-ok').onclick = () => { overlay.classList.add('hidden'); onConfirm(); };
}

// ========================= MODAL =========================
export function showModal(title, contentHTML, options = {}) {
  const overlay = document.getElementById('modal-overlay');
  const dialog = document.getElementById('confirm-dialog');
  dialog.innerHTML = `
    <div class="modal-card ${options.wide ? 'modal-wide' : ''}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-icon" id="modal-close-x">✕</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
      ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
    </div>`;
  overlay.classList.remove('hidden');
  dialog.querySelector('.modal-card').addEventListener('click', e => e.stopPropagation());
  document.getElementById('modal-close-x').onclick = () => closeModal();
  overlay.onclick = () => closeModal();
  if (options.onOpen) options.onOpen();
}

export function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.getElementById('confirm-dialog').innerHTML = '';
}
// Make closeModal available globally for inline onclick handlers
window.closeModal = closeModal;

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

function isPortablePhotoURL(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

export function renderAvatar(name, photoURL, sizeClass = 'avatar-md') {
  const initials = getInitials(name);
  const colors = ['gradient-purple', 'gradient-cyan', 'gradient-green', 'gradient-amber', 'gradient-red'];
  const color = colors[(name || '').length % colors.length];

  if (isPortablePhotoURL(photoURL)) {
    const safeName = escapeHTML(name || '');
    const safeUrl = escapeHTML(photoURL);
    const safeInitials = escapeHTML(initials);
    return `<div class="avatar ${sizeClass}" title="${safeName}" data-initials="${safeInitials}">
      <img src="${safeUrl}" alt="${safeName}" loading="lazy" referrerpolicy="no-referrer"
        onerror="this.parentElement.classList.add('${color}');this.parentElement.textContent=this.parentElement.dataset.initials;"
        style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">
    </div>`;
  }

  return `<div class="avatar ${sizeClass} ${color}">${initials}</div>`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ========================= SECURITY =========================
/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Always use this when inserting user data into innerHTML.
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ========================= VALIDATION =========================
/**
 * Validates fields. Returns { valid, errors }
 * Usage: validateForm({ name: { value: v, required: true, label: 'الاسم' } }, lang)
 */
export function validateForm(fields, lang = 'ar') {
  const errors = [];
  for (const [, rules] of Object.entries(fields)) {
    const v = rules.value;
    const label = rules.label || '';
    const empty = v === '' || v === null || v === undefined;
    if (rules.required && empty) {
      errors.push(lang === 'ar' ? `حقل "${label}" مطلوب` : `"${label}" is required`);
      continue;
    }
    if (!empty) {
      if (rules.min !== undefined && Number(v) < rules.min)
        errors.push(lang === 'ar' ? `"${label}" يجب أن يكون ${rules.min} على الأقل` : `"${label}" must be ≥ ${rules.min}`);
      if (rules.max !== undefined && Number(v) > rules.max)
        errors.push(lang === 'ar' ? `"${label}" يجب ألا يتجاوز ${rules.max}` : `"${label}" must be ≤ ${rules.max}`);
      if (rules.minLength && String(v).length < rules.minLength)
        errors.push(lang === 'ar' ? `"${label}" يجب أن يحتوي على ${rules.minLength} أحرف على الأقل` : `"${label}" min ${rules.minLength} chars`);
      if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        errors.push(lang === 'ar' ? `"${label}" بريد إلكتروني غير صالح` : `"${label}" invalid email`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Shows first validation error as toast and returns false if invalid. */
export function checkValid(fields, lang = 'ar') {
  const { valid, errors } = validateForm(fields, lang);
  if (!valid) { showToast(errors[0], 'error', 4000); return false; }
  return true;
}

// ========================= UI COMPONENTS =========================
export function renderCard(title, content, options = {}) {
  return `
    <div class="glass-card ${options.className || ''}" style="padding:1.25rem;">
      ${title ? `<h3 style="font-size:1rem; font-weight:700; margin-bottom:1rem; color:var(--text);">${title}</h3>` : ''}
      <div>${content}</div>
    </div>`;
}

export function renderStatsCard(label, value, icon, gradient = 'gradient-purple') {
  return `
    <div class="stat-card ${gradient}">
      <div class="stat-icon">${icon}</div>
      <div class="stat-info">
        <p>${label}</p>
        <h3>${value}</h3>
      </div>
    </div>`;
}

export function renderBadge(text, type = 'info') {
  return `<span class="badge badge-${type}">${text}</span>`;
}

export function renderTable(headers, rows, options = {}) {
  if (!rows || rows.length === 0) return renderEmptyState(options.emptyMsg || t('noData'));
  
  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export function renderEmptyState(message) {
  return `
    <div class="text-center text-muted" style="padding:3rem 1rem;">
      <div style="font-size:3rem; margin-bottom:1rem; opacity:0.3;">📭</div>
      <p>${message}</p>
    </div>`;
}

export function renderSkeletonCard() {
  return `
    <div class="glass-card card skeleton">
      <div class="skeleton-title"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text" style="width:80%;"></div>
    </div>`;
}

// ========================= IMAGE VIEWER =========================
export function openImageViewer(url, title, canChange = false) {
  const viewer = document.getElementById('image-viewer');
  if (!viewer) return;
  
  const img = document.getElementById('viewer-img');
  const actions = document.getElementById('viewer-actions');
  
  const fallbackUrl = 'https://via.placeholder.com/400?text=No+Photo';
  img.onerror = () => { img.onerror = null; img.src = fallbackUrl; };
  img.src = isPortablePhotoURL(url) ? url : fallbackUrl;
  actions.innerHTML = '';
  
  if (canChange) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.innerHTML = `✏️ ${state.lang === 'ar' ? 'تغيير الصورة' : 'Change Photo'}`;
    btn.onclick = (e) => {
      e.stopPropagation();
      viewer.classList.remove('active');
      const input = document.querySelector('input[type="file"][id*="photo-input"]');
      if (input) input.click();
    };
    actions.appendChild(btn);
  }
  
  viewer.onclick = () => viewer.classList.remove('active');
  viewer.classList.add('active');
}

window.openImageViewer = openImageViewer;
