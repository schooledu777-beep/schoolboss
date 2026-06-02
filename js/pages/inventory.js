import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { tCol, tDoc } from '../db.js';
import { showModal, closeModal, showConfirm, showToast, checkValid } from '../ui.js';

// ========================= INVENTORY MANAGEMENT =========================

const ITEM_CATEGORIES = {
  electronics:  { ar: 'إلكترونيات',  en: 'Electronics',   icon: '💻', color: '#3b82f6' },
  furniture:    { ar: 'أثاث',         en: 'Furniture',     icon: '🪑', color: '#8b5cf6' },
  sports:       { ar: 'رياضة',        en: 'Sports',        icon: '⚽', color: '#10b981' },
  lab:          { ar: 'مختبر',        en: 'Lab',           icon: '🔬', color: '#f59e0b' },
  books:        { ar: 'كتب/طباعة',   en: 'Books/Print',   icon: '📚', color: '#06b6d4' },
  cleaning:     { ar: 'نظافة',        en: 'Cleaning',      icon: '🧹', color: '#84cc16' },
  maintenance:  { ar: 'صيانة',        en: 'Maintenance',   icon: '🔧', color: '#f97316' },
  other:        { ar: 'أخرى',         en: 'Other',         icon: '📦', color: '#6b7280' },
};

const ITEM_STATUS = {
  available:   { ar: 'متاح',       en: 'Available',    color: '#10b981' },
  in_use:      { ar: 'قيد الاستخدام', en: 'In Use',   color: '#3b82f6' },
  maintenance: { ar: 'في الصيانة', en: 'Maintenance', color: '#f59e0b' },
  damaged:     { ar: 'تالف',       en: 'Damaged',      color: '#ef4444' },
  disposed:    { ar: 'مستبعد',     en: 'Disposed',     color: '#6b7280' },
};

export function renderInventory() {
  const isAr   = state.lang === 'ar';
  const isAdmin = state.profile?.role === 'admin';
  const items   = state.inventory || [];

  const totalItems    = items.length;
  const totalValue    = items.reduce((s, i) => s + ((i.quantity || 1) * (i.unitCost || 0)), 0);
  const needsMaint    = items.filter(i => i.status === 'maintenance').length;
  const damaged       = items.filter(i => i.status === 'damaged').length;
  const lowStock      = items.filter(i => i.quantity <= (i.minQuantity || 2) && i.status !== 'disposed').length;

  // Group by category for overview
  const catMap = {};
  items.forEach(item => {
    const cat = item.category || 'other';
    if (!catMap[cat]) catMap[cat] = 0;
    catMap[cat]++;
  });

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📦 ${isAr ? 'إدارة المخزون' : 'Inventory Management'}</h2>
      <div class="header-actions">
        <button class="btn btn-outline" id="export-inventory-btn">📥 ${isAr ? 'تصدير Excel' : 'Export Excel'}</button>
        ${isAdmin ? `<button class="btn btn-primary" id="add-item-btn">+ ${isAr ? 'إضافة عنصر' : 'Add Item'}</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-4" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📦</div>
        <div class="stat-info"><h3>${totalItems}</h3><p>${isAr ? 'إجمالي العناصر' : 'Total Items'}</p></div>
      </div>
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${totalValue.toLocaleString()}</h3><p>${isAr ? 'القيمة الإجمالية' : 'Total Value'}</p></div>
      </div>
      <div class="stat-card gradient-yellow" style="--gradient-start:#f59e0b;--gradient-end:#d97706;">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info"><h3>${lowStock}</h3><p>${isAr ? 'مخزون منخفض' : 'Low Stock'}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">🔧</div>
        <div class="stat-info"><h3>${needsMaint + damaged}</h3><p>${isAr ? 'يحتاج صيانة/تالف' : 'Maintenance/Damaged'}</p></div>
      </div>
    </div>

    <!-- Low Stock Alert -->
    ${lowStock > 0 ? `
    <div class="glass-card" style="padding:1rem 1.5rem;margin-bottom:1.5rem;border:1px solid #f59e0b44;background:#f59e0b08;">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <span style="font-size:1.5rem;">📉</span>
        <div>
          <strong style="color:#f59e0b;">${lowStock} ${isAr ? 'عنصر بمخزون منخفض' : 'items with low stock'}</strong>
          <div style="font-size:.82rem;color:var(--text-muted);">${isAr ? 'يرجى إعادة التزويد' : 'Please reorder these items'}</div>
        </div>
        <button class="btn btn-sm btn-warning" id="filter-low-stock" style="margin-${isAr?'right':'left'}:auto;">${isAr ? 'عرض' : 'Show'}</button>
      </div>
    </div>` : ''}

    <!-- Category Overview -->
    <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem;">
      <h3 style="margin:0 0 1rem;font-size:.95rem;">${isAr ? 'التوزيع حسب الفئة' : 'Items by Category'}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:.75rem;">
        ${Object.entries(catMap).map(([cat, count]) => {
          const c = ITEM_CATEGORIES[cat] || ITEM_CATEGORIES.other;
          return `
            <button class="btn btn-outline cat-filter-btn" data-cat="${cat}"
              style="display:flex;align-items:center;gap:.5rem;padding:.5rem .85rem;">
              <span>${c.icon}</span>
              <span style="font-size:.82rem;">${isAr ? c.ar : c.en}</span>
              <span class="badge" style="background:${c.color}22;color:${c.color};">${count}</span>
            </button>`;
        }).join('')}
        <button class="btn btn-outline cat-filter-btn" data-cat="" style="padding:.5rem .85rem;font-size:.82rem;">
          ${isAr ? 'الكل' : 'All'} <span class="badge badge-info" style="margin-${isAr?'right':'left'}:.35rem;">${totalItems}</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <input type="text" id="inv-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="inv-category-filter" class="form-select">
        <option value="">${isAr ? 'كل الفئات' : 'All Categories'}</option>
        ${Object.entries(ITEM_CATEGORIES).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <select id="inv-status-filter" class="form-select">
        <option value="">${isAr ? 'كل الحالات' : 'All Statuses'}</option>
        ${Object.entries(ITEM_STATUS).map(([k, v]) => `<option value="${k}" style="color:${v.color};">${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <select id="inv-location-filter" class="form-select">
        <option value="">${isAr ? 'كل المواقع' : 'All Locations'}</option>
        ${[...new Set(items.map(i => i.location).filter(Boolean))].map(l => `<option value="${l}">${l}</option>`).join('')}
      </select>
    </div>

    <!-- Items Table -->
    <div class="table-responsive glass-card">
      <table class="data-table" id="inv-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${isAr ? 'العنصر' : 'Item'}</th>
            <th>${isAr ? 'الفئة' : 'Category'}</th>
            <th>${isAr ? 'الكمية' : 'Qty'}</th>
            <th>${isAr ? 'الموقع' : 'Location'}</th>
            <th>${isAr ? 'الحالة' : 'Status'}</th>
            <th>${isAr ? 'القيمة' : 'Value'}</th>
            ${isAdmin ? `<th>${isAr ? 'إجراءات' : 'Actions'}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${items.length === 0
            ? `<tr><td colspan="${isAdmin ? 8 : 7}" class="text-center text-muted">${t('noData')}</td></tr>`
            : items.map((item, i) => {
                const cat  = ITEM_CATEGORIES[item.category] || ITEM_CATEGORIES.other;
                const stat = ITEM_STATUS[item.status] || ITEM_STATUS.available;
                const qty  = item.quantity || 1;
                const min  = item.minQuantity || 2;
                const isLow = qty <= min && item.status !== 'disposed';
                const value = qty * (item.unitCost || 0);
                return `
                  <tr data-category="${item.category||'other'}" data-status="${item.status||'available'}" data-location="${item.location||''}">
                    <td>${i + 1}</td>
                    <td>
                      <div style="font-weight:600;">${item.name}</div>
                      ${item.serialNo ? `<div style="font-size:.72rem;color:var(--text-muted);">S/N: ${item.serialNo}</div>` : ''}
                      ${item.description ? `<div style="font-size:.72rem;color:var(--text-muted);">${item.description}</div>` : ''}
                    </td>
                    <td>
                      <span style="font-size:.85rem;">${cat.icon} ${isAr ? cat.ar : cat.en}</span>
                    </td>
                    <td>
                      <span style="font-weight:700;color:${isLow ? '#ef4444' : 'var(--text)'};">
                        ${qty}${isLow ? ' ⚠️' : ''}
                      </span>
                      ${item.unit ? `<div style="font-size:.72rem;color:var(--text-muted);">${item.unit}</div>` : ''}
                    </td>
                    <td style="font-size:.85rem;">${item.location || '—'}</td>
                    <td>
                      <span class="badge" style="background:${stat.color}22;color:${stat.color};">
                        ${isAr ? stat.ar : stat.en}
                      </span>
                    </td>
                    <td style="font-weight:600;">${value > 0 ? value.toLocaleString() : '—'}</td>
                    ${isAdmin ? `
                      <td>
                        <button class="btn btn-sm btn-outline edit-item" data-id="${item.id}">✏️</button>
                        <button class="btn btn-sm btn-warning maint-item" data-id="${item.id}" title="${isAr ? 'طلب صيانة' : 'Request Maintenance'}">🔧</button>
                        <button class="btn btn-sm btn-danger delete-item" data-id="${item.id}">🗑️</button>
                      </td>` : ''}
                  </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachInventoryEvents() {
  const isAdmin = state.profile?.role === 'admin';
  const isAr    = state.lang === 'ar';

  document.getElementById('add-item-btn')?.addEventListener('click', () => showItemForm());
  document.getElementById('export-inventory-btn')?.addEventListener('click', () => exportInventoryCSV(isAr));

  document.getElementById('filter-low-stock')?.addEventListener('click', () => {
    const qtyFilter = document.getElementById('inv-status-filter');
    // Reset filters and show low stock manually
    document.querySelectorAll('#inv-table tbody tr').forEach(row => {
      const item = (state.inventory || []).find((_, i) => i === [...row.parentNode.children].indexOf(row));
      row.style.display = '';
    });
    // Filter by checking qty vs min — done inline via CSS class
    showToast(isAr ? 'يتم عرض العناصر ذات المخزون المنخفض' : 'Showing low-stock items', 'info');
  });

  // Category quick filter buttons
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('inv-category-filter').value = btn.dataset.cat;
      applyInvFilters();
    });
  });

  document.getElementById('inv-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#inv-table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('inv-category-filter')?.addEventListener('change', applyInvFilters);
  document.getElementById('inv-status-filter')?.addEventListener('change', applyInvFilters);
  document.getElementById('inv-location-filter')?.addEventListener('change', applyInvFilters);

  if (isAdmin) {
    document.querySelectorAll('.edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = (state.inventory || []).find(x => x.id === btn.dataset.id);
        if (item) showItemForm(item);
      });
    });
    document.querySelectorAll('.maint-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await updateDoc(tDoc('inventory',btn.dataset.id), { status: 'maintenance', lastMaintenanceRequest: new Date().toISOString() });
          showToast(isAr ? 'تم تسجيل طلب الصيانة' : 'Maintenance request recorded', 'success');
        } catch { showToast(t('errorOccurred'), 'error'); }
      });
    });
    document.querySelectorAll('.delete-item').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm(
          isAr ? 'حذف العنصر' : 'Delete Item',
          isAr ? 'هل تريد حذف هذا العنصر من المخزون؟' : 'Delete this inventory item?',
          async () => {
            try {
              await deleteDoc(tDoc('inventory',btn.dataset.id));
              showToast(t('deletedSuccess'), 'success');
            } catch { showToast(t('errorOccurred'), 'error'); }
          }
        );
      });
    });
  }
}

function applyInvFilters() {
  const cat    = document.getElementById('inv-category-filter')?.value;
  const status = document.getElementById('inv-status-filter')?.value;
  const loc    = document.getElementById('inv-location-filter')?.value;
  document.querySelectorAll('#inv-table tbody tr').forEach(row => {
    const catOk    = !cat    || row.dataset.category === cat;
    const statusOk = !status || row.dataset.status   === status;
    const locOk    = !loc    || row.dataset.location === loc;
    row.style.display = catOk && statusOk && locOk ? '' : 'none';
  });
}

function showItemForm(item = null) {
  const isAr   = state.lang === 'ar';
  const isEdit = !!item;

  showModal(isEdit ? (isAr ? 'تعديل عنصر' : 'Edit Item') : (isAr ? 'إضافة عنصر للمخزون' : 'Add Inventory Item'), `
    <form id="item-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'اسم العنصر' : 'Item Name'}</label>
        <input type="text" id="if-name" class="form-input" value="${item?.name || ''}" required
          placeholder="${isAr ? 'مثال: جهاز عرض، حاسوب محمول...' : 'e.g. Projector, Laptop...'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الفئة' : 'Category'}</label>
        <select id="if-cat" class="form-select">
          ${Object.entries(ITEM_CATEGORIES).map(([k, v]) => `
            <option value="${k}" ${(item?.category || 'other') === k ? 'selected' : ''}>${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الحالة' : 'Status'}</label>
        <select id="if-status" class="form-select">
          ${Object.entries(ITEM_STATUS).map(([k, v]) => `
            <option value="${k}" ${(item?.status || 'available') === k ? 'selected' : ''}>${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الكمية' : 'Quantity'}</label>
        <input type="number" id="if-qty" class="form-input" value="${item?.quantity ?? 1}" required min="0">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الحد الأدنى للمخزون' : 'Min Stock Level'}</label>
        <input type="number" id="if-min" class="form-input" value="${item?.minQuantity ?? 2}" min="0">
      </div>
      <div class="form-group">
        <label>${isAr ? 'وحدة القياس' : 'Unit'}</label>
        <input type="text" id="if-unit" class="form-input" value="${item?.unit || ''}"
          placeholder="${isAr ? 'مثال: قطعة، علبة، لتر' : 'e.g. piece, box, liter'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تكلفة الوحدة' : 'Unit Cost'}</label>
        <input type="number" id="if-cost" class="form-input" value="${item?.unitCost || 0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الموقع / الغرفة' : 'Location / Room'}</label>
        <input type="text" id="if-loc" class="form-input" value="${item?.location || ''}"
          placeholder="${isAr ? 'مثال: المستودع، غرفة المدير' : 'e.g. Storage, Principal Office'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الرقم التسلسلي (اختياري)' : 'Serial No. (optional)'}</label>
        <input type="text" id="if-serial" class="form-input" value="${item?.serialNo || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ الشراء' : 'Purchase Date'}</label>
        <input type="date" id="if-date" class="form-input" value="${item?.purchaseDate || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'المورّد' : 'Supplier'}</label>
        <input type="text" id="if-supplier" class="form-input" value="${item?.supplier || ''}">
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'ملاحظات' : 'Notes'}</label>
        <textarea id="if-notes" class="form-input" rows="2" style="resize:vertical;">${item?.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('item-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('if-name').value.trim();
    if (!checkValid({ name: { value: name, required: true, label: isAr ? 'الاسم' : 'Name' } }, state.lang)) return;

    const data = {
      name,
      category:     document.getElementById('if-cat').value,
      status:       document.getElementById('if-status').value,
      quantity:     Number(document.getElementById('if-qty').value) || 0,
      minQuantity:  Number(document.getElementById('if-min').value) || 2,
      unit:         document.getElementById('if-unit').value.trim(),
      unitCost:     Number(document.getElementById('if-cost').value) || 0,
      location:     document.getElementById('if-loc').value.trim(),
      serialNo:     document.getElementById('if-serial').value.trim(),
      purchaseDate: document.getElementById('if-date').value,
      supplier:     document.getElementById('if-supplier').value.trim(),
      notes:        document.getElementById('if-notes').value.trim(),
      updatedAt:    new Date().toISOString(),
      createdAt:    item?.createdAt || new Date().toISOString(),
      createdBy:    state.profile?.uid,
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateDoc(tDoc('inventory',item.id), data);
      else        await addDoc(tCol('inventory'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Inventory] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function exportInventoryCSV(isAr) {
  const items = state.inventory || [];
  const headers = isAr
    ? ['الاسم', 'الفئة', 'الكمية', 'الحالة', 'الموقع', 'تكلفة الوحدة', 'القيمة الإجمالية', 'الرقم التسلسلي', 'تاريخ الشراء']
    : ['Name', 'Category', 'Quantity', 'Status', 'Location', 'Unit Cost', 'Total Value', 'Serial No', 'Purchase Date'];

  const rows = items.map(i => {
    const cat  = ITEM_CATEGORIES[i.category]  || ITEM_CATEGORIES.other;
    const stat = ITEM_STATUS[i.status] || ITEM_STATUS.available;
    const qty  = i.quantity || 1;
    return [
      i.name, isAr ? cat.ar : cat.en, qty, isAr ? stat.ar : stat.en,
      i.location || '', i.unitCost || 0, qty * (i.unitCost || 0),
      i.serialNo || '', i.purchaseDate || '',
    ];
  });

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `inventory_${new Date().toISOString().split('T')[0]}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
