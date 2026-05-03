import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency, checkValid } from '../ui.js';
import { notificationService } from '../services/notificationService.js';

// ========================= ENHANCED FINANCE MODULE =========================

const FEE_TYPES = {
  tuition:    { ar: 'رسوم دراسية',   en: 'Tuition',      icon: '🎓', color: '#6366f1' },
  activity:   { ar: 'رسوم أنشطة',   en: 'Activities',   icon: '⚽', color: '#3b82f6' },
  transport:  { ar: 'رسوم مواصلات', en: 'Transport',    icon: '🚌', color: '#f59e0b' },
  hostel:     { ar: 'رسوم سكن',     en: 'Hostel',       icon: '🏠', color: '#8b5cf6' },
  uniform:    { ar: 'رسوم زي',      en: 'Uniform',      icon: '👕', color: '#10b981' },
  exam:       { ar: 'رسوم امتحانات', en: 'Exams',        icon: '📝', color: '#06b6d4' },
  library:    { ar: 'رسوم مكتبة',   en: 'Library',      icon: '📚', color: '#84cc16' },
  other:      { ar: 'أخرى',         en: 'Other',         icon: '💼', color: '#6b7280' },
};

export function renderFinance() {
  if (state.schoolType === 'public') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card"><span class="empty-icon">🏛️</span><h3>${state.lang==='ar'?'النظام المالي غير متاح':'Finance Not Available'}</h3><p class="text-muted">${state.lang==='ar'?'النظام المالي متاح فقط للمدارس الخاصة':'Finance is only available for private schools'}</p></div></div>`;
  }

  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';

  let fees = state.fees;
  if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    fees = fees.filter(f => kidIds.includes(f.studentId));
  }
  if (role === 'student') {
    fees = fees.filter(f => f.studentId === state.profile?.uid);
  }

  const totalFees   = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees    = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pendingFees = totalFees - paidFees;
  const paidPct     = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0;

  // Overdue fees
  const today = new Date().toISOString().split('T')[0];
  const overdueFees = fees.filter(f => f.dueDate && f.dueDate < today && (f.paidAmount || 0) < (f.amount || 0));

  // Group by type for analytics
  const byType = {};
  fees.forEach(f => {
    const type = f.feeType || 'other';
    if (!byType[type]) byType[type] = { total: 0, paid: 0 };
    byType[type].total += f.amount || 0;
    byType[type].paid  += f.paidAmount || 0;
  });

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('finance')}</h2>
      <div class="header-actions">
        ${isAdmin ? `
          <button class="btn btn-outline" id="discounts-btn">🎟️ ${isAr ? 'الخصومات' : 'Discounts'}</button>
          <button class="btn btn-outline" id="bulk-fee-btn">📋 ${isAr ? 'إضافة جماعية' : 'Bulk Add'}</button>
          <button class="btn btn-primary" id="add-fee-btn">+ ${isAr ? 'إضافة رسوم' : 'Add Fee'}</button>` : ''}
      </div>
    </div>

    <!-- Main Stats -->
    <div class="stats-grid grid-4" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${formatCurrency(totalFees)}</h3><p>${isAr ? 'إجمالي الرسوم' : 'Total Fees'}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">✅</div>
        <div class="stat-info"><h3>${formatCurrency(paidFees)}</h3><p>${isAr ? 'المحصّل' : 'Collected'}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">⏰</div>
        <div class="stat-info"><h3>${formatCurrency(pendingFees)}</h3><p>${isAr ? 'المتبقي' : 'Pending'}</p></div>
      </div>
      <div class="stat-card gradient-purple">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info"><h3>${overdueFees.length}</h3><p>${isAr ? 'متأخرة السداد' : 'Overdue'}</p></div>
      </div>
    </div>

    <!-- Collection Progress -->
    <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
        <span style="font-weight:600;">${isAr ? 'نسبة التحصيل' : 'Collection Rate'}</span>
        <span style="font-size:1.5rem;font-weight:800;color:${paidPct >= 80 ? '#10b981' : paidPct >= 50 ? '#f59e0b' : '#ef4444'};">${paidPct}%</span>
      </div>
      <div class="progress-bar" style="height:10px;">
        <div class="progress-fill gradient-green" style="width:${paidPct}%;transition:width .5s ease;"></div>
      </div>
    </div>

    <!-- Fee Type Breakdown -->
    ${Object.keys(byType).length > 0 ? `
    <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem;">
      <h3 style="margin:0 0 1rem;font-size:1rem;">${isAr ? '📊 توزيع الرسوم حسب النوع' : '📊 Fees by Type'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;">
        ${Object.entries(byType).map(([type, data]) => {
          const ft = FEE_TYPES[type] || FEE_TYPES.other;
          const pct = data.total > 0 ? Math.round((data.paid / data.total) * 100) : 0;
          return `
            <div style="padding:1rem;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
                <span>${ft.icon}</span>
                <span style="font-weight:600;font-size:.85rem;">${isAr ? ft.ar : ft.en}</span>
              </div>
              <div style="font-size:1.1rem;font-weight:700;">${formatCurrency(data.paid)} <span style="font-size:.75rem;color:var(--text-muted);">/ ${formatCurrency(data.total)}</span></div>
              <div style="height:4px;background:var(--border);border-radius:4px;margin-top:.5rem;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${ft.color};border-radius:4px;"></div>
              </div>
              <div style="font-size:.75rem;color:${ft.color};margin-top:.25rem;">${pct}%</div>
            </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Overdue Alert -->
    ${overdueFees.length > 0 && isAdmin ? `
    <div class="glass-card" style="padding:1rem 1.5rem;margin-bottom:1.5rem;border:1px solid #ef444444;background:#ef444408;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <span style="font-size:1.5rem;">⚠️</span>
          <div>
            <strong style="color:#ef4444;">${overdueFees.length} ${isAr ? 'رسوم متأخرة السداد' : 'overdue fees'}</strong>
            <div style="font-size:.82rem;color:var(--text-muted);">${isAr ? 'إجمالي المتأخر:' : 'Total overdue:'} ${formatCurrency(overdueFees.reduce((s,f) => s + (f.amount||0)-(f.paidAmount||0), 0))}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-danger" id="filter-overdue-btn">${isAr ? 'عرض المتأخرة' : 'Show Overdue'}</button>
      </div>
    </div>` : ''}

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <input type="text" id="fee-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="fee-type-filter" class="form-select">
        <option value="">${isAr ? 'كل الأنواع' : 'All Types'}</option>
        ${Object.entries(FEE_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
      </select>
      <select id="fee-status-filter" class="form-select">
        <option value="">${isAr ? 'كل الحالات' : 'All Statuses'}</option>
        <option value="paid">${isAr ? 'مدفوع' : 'Paid'}</option>
        <option value="partial">${isAr ? 'جزئي' : 'Partial'}</option>
        <option value="unpaid">${isAr ? 'غير مدفوع' : 'Unpaid'}</option>
        <option value="overdue">${isAr ? 'متأخر' : 'Overdue'}</option>
      </select>
      <select id="fee-class-filter" class="form-select">
        <option value="">${isAr ? 'كل الصفوف' : 'All Classes'}</option>
        ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>

    <!-- Fees Table -->
    <div class="table-responsive glass-card">
      <table class="data-table" id="fees-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${isAr ? 'الطالب' : 'Student'}</th>
            <th>${isAr ? 'النوع' : 'Type'}</th>
            <th>${isAr ? 'المبلغ' : 'Amount'}</th>
            <th>${isAr ? 'المدفوع' : 'Paid'}</th>
            <th>${isAr ? 'المتبقي' : 'Remaining'}</th>
            <th>${isAr ? 'الاستحقاق' : 'Due Date'}</th>
            <th>${isAr ? 'الحالة' : 'Status'}</th>
            ${isAdmin ? `<th>${isAr ? 'إجراءات' : 'Actions'}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${fees.length === 0
            ? `<tr><td colspan="${isAdmin ? 9 : 8}" class="text-center text-muted">${t('noData')}</td></tr>`
            : fees.map((f, i) => {
              const student  = state.students.find(s => s.id === f.studentId);
              const cls      = state.classes.find(c => c.id === student?.classId || (c.studentIds||[]).includes(student?.id));
              const paid     = f.paidAmount || 0;
              const amount   = f.amount || 0;
              const remaining = amount - paid;
              const isOverdue = f.dueDate && f.dueDate < today && remaining > 0;
              const status   = paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
              const ft       = FEE_TYPES[f.feeType] || FEE_TYPES.other;
              const statusMap = {
                paid:    { ar: 'مدفوع',       en: 'Paid',     cls: 'success' },
                partial: { ar: 'جزئي',         en: 'Partial',  cls: 'warning' },
                unpaid:  { ar: 'غير مدفوع',   en: 'Unpaid',   cls: 'danger'  },
              };
              const sl = statusMap[status];
              return `
                <tr data-type="${f.feeType||'other'}" data-status="${isOverdue?'overdue':status}" data-class="${cls?.id||''}">
                  <td>${i + 1}</td>
                  <td>
                    <div style="font-weight:600;">${student?.name || '—'}</div>
                    ${cls ? `<div style="font-size:.75rem;color:var(--text-muted);">${cls.name}</div>` : ''}
                  </td>
                  <td>
                    <span style="font-size:.85rem;">${ft.icon} ${isAr ? ft.ar : ft.en}</span>
                    ${f.description ? `<div style="font-size:.72rem;color:var(--text-muted);">${f.description}</div>` : ''}
                  </td>
                  <td style="font-weight:600;">${formatCurrency(amount)}</td>
                  <td style="color:#10b981;">${formatCurrency(paid)}</td>
                  <td style="color:${remaining > 0 ? '#ef4444' : '#10b981'};font-weight:${remaining > 0 ? '700' : '400'};">${remaining > 0 ? formatCurrency(remaining) : '✅'}</td>
                  <td>
                    <span style="color:${isOverdue ? '#ef4444' : 'var(--text)'};">
                      ${f.dueDate ? new Date(f.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {day:'numeric',month:'short'}) : '—'}
                      ${isOverdue ? `<br><small style="color:#ef4444;">${isAr ? 'متأخر' : 'Overdue'}</small>` : ''}
                    </span>
                  </td>
                  <td><span class="badge badge-${sl.cls}">${sl[state.lang]}</span></td>
                  ${isAdmin ? `
                    <td>
                      <button class="btn btn-sm btn-outline edit-fee" data-id="${f.id}">✏️</button>
                      ${remaining > 0 ? `<button class="btn btn-sm btn-success pay-fee" data-id="${f.id}">${isAr ? 'دفع' : 'Pay'}</button>` : ''}
                      <button class="btn btn-sm btn-danger delete-fee" data-id="${f.id}">🗑️</button>
                    </td>` : ''}
                </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

export function attachFinanceEvents() {
  const isAr = state.lang === 'ar';

  document.getElementById('add-fee-btn')?.addEventListener('click', () => showFeeForm());
  document.getElementById('bulk-fee-btn')?.addEventListener('click', showBulkFeeForm);
  document.getElementById('discounts-btn')?.addEventListener('click', showDiscountsPanel);

  document.getElementById('filter-overdue-btn')?.addEventListener('click', () => {
    const statusFilter = document.getElementById('fee-status-filter');
    if (statusFilter) { statusFilter.value = 'overdue'; applyFilters(); }
  });

  document.getElementById('fee-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#fees-table tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('fee-type-filter')?.addEventListener('change', applyFilters);
  document.getElementById('fee-status-filter')?.addEventListener('change', applyFilters);
  document.getElementById('fee-class-filter')?.addEventListener('change', applyFilters);

  document.querySelectorAll('.edit-fee').forEach(b => b.addEventListener('click', () => {
    const f = state.fees.find(x => x.id === b.dataset.id);
    if (f) showFeeForm(f);
  }));
  document.querySelectorAll('.pay-fee').forEach(b => b.addEventListener('click', () => showPaymentForm(b.dataset.id)));
  document.querySelectorAll('.delete-fee').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'), t('confirmDelete'), async () => {
      try { await deleteDoc(doc(db, 'fees', b.dataset.id)); showToast(t('deletedSuccess'), 'success'); }
      catch { showToast(t('errorOccurred'), 'error'); }
    });
  }));
}

function applyFilters() {
  const type   = document.getElementById('fee-type-filter')?.value;
  const status = document.getElementById('fee-status-filter')?.value;
  const cls    = document.getElementById('fee-class-filter')?.value;
  document.querySelectorAll('#fees-table tbody tr').forEach(row => {
    const typeOk   = !type   || row.dataset.type   === type;
    const statusOk = !status || row.dataset.status === status;
    const classOk  = !cls    || row.dataset.class  === cls;
    row.style.display = typeOk && statusOk && classOk ? '' : 'none';
  });
}

function showFeeForm(fee = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!fee;

  showModal(isEdit ? (isAr ? 'تعديل رسوم' : 'Edit Fee') : (isAr ? 'إضافة رسوم' : 'Add Fee'), `
    <form id="fee-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'الطالب' : 'Student'}</label>
        <select id="ff-student" class="form-select" required>
          <option value="">${isAr ? 'اختر الطالب' : 'Select student'}</option>
          ${state.students.map(s => `<option value="${s.id}" ${fee?.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الرسوم' : 'Fee Type'}</label>
        <select id="ff-type" class="form-select">
          ${Object.entries(FEE_TYPES).map(([k, v]) => `
            <option value="${k}" ${(fee?.feeType || 'tuition') === k ? 'selected' : ''}>${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'المبلغ الإجمالي' : 'Total Amount'}</label>
        <input type="number" id="ff-amount" class="form-input" value="${fee?.amount || ''}" required min="1">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الخصم (%)' : 'Discount (%)'}</label>
        <input type="number" id="ff-discount" class="form-input" value="${fee?.discountPct || 0}" min="0" max="100">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
        <input type="date" id="ff-due" class="form-input" value="${fee?.dueDate || ''}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الفصل الدراسي' : 'Term'}</label>
        <select id="ff-term" class="form-select">
          <option value="">${isAr ? 'غير محدد' : 'Not specified'}</option>
          <option value="term1" ${fee?.term === 'term1' ? 'selected' : ''}>${isAr ? 'الفصل الأول' : 'Term 1'}</option>
          <option value="term2" ${fee?.term === 'term2' ? 'selected' : ''}>${isAr ? 'الفصل الثاني' : 'Term 2'}</option>
          <option value="term3" ${fee?.term === 'term3' ? 'selected' : ''}>${isAr ? 'الفصل الثالث' : 'Term 3'}</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'الوصف / الملاحظات' : 'Description / Notes'}</label>
        <input type="text" id="ff-notes" class="form-input" value="${fee?.description || ''}"
          placeholder="${isAr ? 'مثال: رسوم الفصل الأول' : 'e.g. First term fees'}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('fee-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const studentId  = document.getElementById('ff-student').value;
    const rawAmount  = Number(document.getElementById('ff-amount').value);
    const discountPct = Number(document.getElementById('ff-discount').value) || 0;
    const amount     = Math.round(rawAmount * (1 - discountPct / 100));

    if (!checkValid({
      student: { value: studentId, required: true, label: isAr ? 'الطالب' : 'Student' },
      amount:  { value: rawAmount, required: true, min: 1, label: isAr ? 'المبلغ' : 'Amount' },
    }, state.lang)) return;

    const data = {
      studentId,
      feeType:     document.getElementById('ff-type').value,
      amount,
      rawAmount,
      discountPct,
      dueDate:     document.getElementById('ff-due').value,
      term:        document.getElementById('ff-term').value,
      description: document.getElementById('ff-notes').value.trim(),
      paidAmount:  fee?.paidAmount || 0,
      createdAt:   fee?.createdAt  || new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateDoc(doc(db, 'fees', fee.id), data);
      else        await addDoc(collection(db, 'fees'), data);
      const student = state.students.find(s => s.id === data.studentId);
      if (student?.parentId && data.amount > data.paidAmount) {
        notificationService.triggerEventNotification('invoice_overdue', {
          recipientId: student.parentId,
          amount: formatCurrency(data.amount - data.paidAmount)
        });
      }
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Finance] Fee save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}

function showPaymentForm(feeId) {
  const isAr = state.lang === 'ar';
  const fee = state.fees.find(f => f.id === feeId);
  if (!fee) return;
  const remaining = (fee.amount || 0) - (fee.paidAmount || 0);

  showModal(isAr ? 'تسجيل دفعة' : 'Record Payment', `
    <form id="pay-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1;">
        <div style="display:flex;justify-content:space-between;padding:1rem;background:var(--surface-2);border-radius:10px;margin-bottom:1rem;">
          <div><div style="font-size:.8rem;color:var(--text-muted);">${isAr ? 'المبلغ الإجمالي' : 'Total'}</div><div style="font-weight:700;">${formatCurrency(fee.amount)}</div></div>
          <div><div style="font-size:.8rem;color:var(--text-muted);">${isAr ? 'المدفوع' : 'Paid'}</div><div style="font-weight:700;color:#10b981;">${formatCurrency(fee.paidAmount || 0)}</div></div>
          <div><div style="font-size:.8rem;color:var(--text-muted);">${isAr ? 'المتبقي' : 'Remaining'}</div><div style="font-weight:700;color:#ef4444;">${formatCurrency(remaining)}</div></div>
        </div>
      </div>
      <div class="form-group">
        <label>${isAr ? 'مبلغ الدفعة' : 'Payment Amount'}</label>
        <input type="number" id="pay-amount" class="form-input" max="${remaining}" value="${remaining}" required min="1">
      </div>
      <div class="form-group">
        <label>${isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
        <select id="pay-method" class="form-select">
          <option value="cash">${isAr ? 'نقداً' : 'Cash'}</option>
          <option value="bank">${isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
          <option value="card">${isAr ? 'بطاقة' : 'Card'}</option>
          <option value="check">${isAr ? 'شيك' : 'Check'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'رقم الإيصال (اختياري)' : 'Receipt No. (optional)'}</label>
        <input type="text" id="pay-receipt" class="form-input" placeholder="${isAr ? 'مثال: RCP-2026-001' : 'e.g. RCP-2026-001'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ الدفع' : 'Payment Date'}</label>
        <input type="date" id="pay-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-success">${isAr ? '💳 تأكيد الدفع' : '💳 Confirm Payment'}</button>
      </div>
    </form>`);

  document.getElementById('pay-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const amount = Number(document.getElementById('pay-amount').value);
    if (amount <= 0 || amount > remaining) {
      showToast(isAr ? 'مبلغ غير صالح' : 'Invalid amount', 'error');
      return;
    }
    const newPaid = (fee.paidAmount || 0) + amount;
    const paymentRecord = {
      amount,
      method:    document.getElementById('pay-method').value,
      receiptNo: document.getElementById('pay-receipt').value.trim(),
      date:      document.getElementById('pay-date').value,
      recordedBy: state.profile?.uid,
      recordedAt: new Date().toISOString(),
    };

    // Keep payment history
    const paymentHistory = [...(fee.paymentHistory || []), paymentRecord];

    try {
      await updateDoc(doc(db, 'fees', feeId), {
        paidAmount: newPaid,
        paymentHistory,
        lastPaymentDate: paymentRecord.date,
      });
      closeModal();
      showToast(isAr ? 'تم تسجيل الدفعة بنجاح ✅' : 'Payment recorded ✅', 'success');
    } catch {
      showToast(t('errorOccurred'), 'error');
    }
  });
}

function showBulkFeeForm() {
  const isAr = state.lang === 'ar';
  showModal(isAr ? 'إضافة رسوم جماعية' : 'Bulk Add Fees', `
    <form id="bulk-fee-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'الصف' : 'Class'}</label>
        <select id="bf-class" class="form-select" required>
          <option value="">${isAr ? 'اختر الصف' : 'Select class'}</option>
          <option value="all">${isAr ? 'كل الطلاب' : 'All Students'}</option>
          ${state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الرسوم' : 'Fee Type'}</label>
        <select id="bf-type" class="form-select">
          ${Object.entries(FEE_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${isAr ? v.ar : v.en}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'المبلغ لكل طالب' : 'Amount per Student'}</label>
        <input type="number" id="bf-amount" class="form-input" required min="1">
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
        <input type="date" id="bf-due" class="form-input">
      </div>
      <div class="form-group">
        <label>${isAr ? 'الفصل الدراسي' : 'Term'}</label>
        <select id="bf-term" class="form-select">
          <option value="term1">${isAr ? 'الفصل الأول' : 'Term 1'}</option>
          <option value="term2">${isAr ? 'الفصل الثاني' : 'Term 2'}</option>
          <option value="term3">${isAr ? 'الفصل الثالث' : 'Term 3'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الوصف' : 'Description'}</label>
        <input type="text" id="bf-desc" class="form-input" placeholder="${isAr ? 'مثال: رسوم الفصل الأول' : 'e.g. Term 1 fees'}">
      </div>
      <div id="bf-preview" style="grid-column:1/-1;padding:.75rem;background:var(--surface-2);border-radius:8px;font-size:.85rem;display:none;"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" id="bf-preview-btn">${isAr ? '👁️ معاينة' : '👁️ Preview'}</button>
        <button type="submit" class="btn btn-primary">${isAr ? 'إضافة للجميع' : 'Add for All'}</button>
      </div>
    </form>`);

  document.getElementById('bf-preview-btn')?.addEventListener('click', () => {
    const classId = document.getElementById('bf-class').value;
    let students = state.students;
    if (classId && classId !== 'all') {
      const cls = state.classes.find(c => c.id === classId);
      const ids = cls?.studentIds || state.students.filter(s => s.classId === classId).map(s => s.id);
      students = students.filter(s => ids.includes(s.id));
    }
    const preview = document.getElementById('bf-preview');
    preview.style.display = 'block';
    preview.innerHTML = `${isAr ? 'سيتم إضافة رسوم لـ ' : 'Will add fees for '}<strong>${students.length}</strong> ${isAr ? 'طالب' : 'students'}`;
  });

  document.getElementById('bulk-fee-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const classId = document.getElementById('bf-class').value;
    const amount  = Number(document.getElementById('bf-amount').value);
    if (!classId || !amount) {
      showToast(isAr ? 'يرجى تعبئة الحقول المطلوبة' : 'Fill required fields', 'warning');
      return;
    }

    let students = state.students;
    if (classId !== 'all') {
      const cls = state.classes.find(c => c.id === classId);
      const ids = cls?.studentIds || state.students.filter(s => s.classId === classId).map(s => s.id);
      students = students.filter(s => ids.includes(s.id));
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      const promises = students.map(s => addDoc(collection(db, 'fees'), {
        studentId:   s.id,
        feeType:     document.getElementById('bf-type').value,
        amount,
        rawAmount:   amount,
        discountPct: 0,
        dueDate:     document.getElementById('bf-due').value,
        term:        document.getElementById('bf-term').value,
        description: document.getElementById('bf-desc').value.trim(),
        paidAmount:  0,
        createdAt:   new Date().toISOString(),
      }));
      await Promise.all(promises);
      closeModal();
      showToast(isAr ? `تم إضافة رسوم لـ ${students.length} طالب ✅` : `Fees added for ${students.length} students ✅`, 'success');
    } catch (err) {
      console.error('[Finance] Bulk fee error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = isAr ? 'إضافة للجميع' : 'Add for All';
    }
  });
}

function showDiscountsPanel() {
  const isAr = state.lang === 'ar';
  const discounts = state.discounts || [];

  showModal(isAr ? '🎟️ الخصومات والمنح' : '🎟️ Discounts & Scholarships', `
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
        <button class="btn btn-primary btn-sm" id="add-discount-btn">+ ${isAr ? 'إضافة خصم' : 'Add Discount'}</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr>
            <th>${isAr ? 'الطالب' : 'Student'}</th>
            <th>${isAr ? 'نوع الخصم' : 'Discount Type'}</th>
            <th>${isAr ? 'النسبة' : 'Percentage'}</th>
            <th>${isAr ? 'السبب' : 'Reason'}</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${discounts.length === 0
              ? `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`
              : discounts.map(d => {
                const student = state.students.find(s => s.id === d.studentId);
                return `<tr>
                  <td style="font-weight:600;">${student?.name || '—'}</td>
                  <td>${d.discountType || '—'}</td>
                  <td><span class="badge badge-success">${d.percentage}%</span></td>
                  <td>${d.reason || '—'}</td>
                  <td>
                    <button class="btn btn-sm btn-danger delete-discount" data-id="${d.id}">🗑️</button>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>`, 'wide');

  document.getElementById('add-discount-btn')?.addEventListener('click', showDiscountForm);
  document.querySelectorAll('.delete-discount').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteDoc(doc(db, 'discounts', btn.dataset.id));
        showToast(t('deletedSuccess'), 'success');
        showDiscountsPanel();
      } catch { showToast(t('errorOccurred'), 'error'); }
    });
  });
}

function showDiscountForm() {
  const isAr = state.lang === 'ar';
  showModal(isAr ? 'إضافة خصم' : 'Add Discount', `
    <form id="discount-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'الطالب' : 'Student'}</label>
        <select id="df-student" class="form-select" required>
          <option value="">${isAr ? 'اختر الطالب' : 'Select student'}</option>
          ${state.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الخصم' : 'Discount Type'}</label>
        <select id="df-type" class="form-select">
          <option value="scholarship">${isAr ? 'منحة دراسية' : 'Scholarship'}</option>
          <option value="sibling">${isAr ? 'خصم الأشقاء' : 'Sibling Discount'}</option>
          <option value="excellence">${isAr ? 'خصم التفوق' : 'Excellence Discount'}</option>
          <option value="staff">${isAr ? 'خصم موظفي المدرسة' : 'Staff Discount'}</option>
          <option value="financial">${isAr ? 'دعم مالي' : 'Financial Aid'}</option>
          <option value="other">${isAr ? 'أخرى' : 'Other'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نسبة الخصم (%)' : 'Discount Percentage (%)'}</label>
        <input type="number" id="df-pct" class="form-input" min="1" max="100" required>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'السبب / الملاحظات' : 'Reason / Notes'}</label>
        <textarea id="df-reason" class="form-input" rows="2"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('discount-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const studentId  = document.getElementById('df-student').value;
    const percentage = Number(document.getElementById('df-pct').value);
    if (!studentId || !percentage) {
      showToast(isAr ? 'يرجى تعبئة الحقول المطلوبة' : 'Fill required fields', 'warning');
      return;
    }
    try {
      await addDoc(collection(db, 'discounts'), {
        studentId,
        discountType: document.getElementById('df-type').value,
        percentage,
        reason:       document.getElementById('df-reason').value.trim(),
        createdBy:    state.profile?.uid,
        createdAt:    new Date().toISOString(),
      });
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch { showToast(t('errorOccurred'), 'error'); }
  });
}
