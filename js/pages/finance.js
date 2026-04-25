import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency } from '../ui.js';
import { notificationService } from '../services/notificationService.js';

export function renderFinance() {
  if (state.schoolType === 'public') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card"><span class="empty-icon">🏛️</span><h3>${state.lang==='ar'?'النظام المالي غير متاح':'Finance Not Available'}</h3><p class="text-muted">${state.lang==='ar'?'النظام المالي متاح فقط للمدارس الخاصة':'Finance is only available for private schools'}</p></div></div>`;
  }
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  let fees = state.fees;
  if (role === 'parent') {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    fees = fees.filter(f => kidIds.includes(f.studentId));
  }
  const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pendingFees = totalFees - paidFees;
  const paidPct = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0;

  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('finance')}</h2>${isAdmin ? `<button class="btn btn-primary" id="add-fee-btn">+ ${state.lang==='ar'?'إضافة رسوم':'Add Fee'}</button>` : ''}</div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-emerald"><div class="stat-icon">💰</div><div class="stat-info"><h3>${formatCurrency(totalFees)}</h3><p>${state.lang==='ar'?'إجمالي الرسوم':'Total Fees'}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">✅</div><div class="stat-info"><h3>${formatCurrency(paidFees)}</h3><p>${state.lang==='ar'?'المدفوع':'Paid'}</p></div></div>
      <div class="stat-card gradient-red"><div class="stat-icon">⏰</div><div class="stat-info"><h3>${formatCurrency(pendingFees)}</h3><p>${t('pending')}</p></div></div>
    </div>
    <div class="glass-card" style="padding:1.5rem;margin-bottom:1.5rem;">
      <div class="progress-label"><span>${state.lang==='ar'?'نسبة التحصيل':'Collection Rate'}</span><span>${paidPct}%</span></div>
      <div class="progress-bar"><div class="progress-fill gradient-green" style="width:${paidPct}%"></div></div>
    </div>
    <div class="table-responsive glass-card">
      <table class="data-table"><thead><tr><th>#</th><th>${state.lang==='ar'?'الطالب':'Student'}</th><th>${state.lang==='ar'?'المبلغ':'Amount'}</th><th>${state.lang==='ar'?'المدفوع':'Paid'}</th><th>${state.lang==='ar'?'الحالة':'Status'}</th>${isAdmin?`<th>${state.lang==='ar'?'إجراءات':'Actions'}</th>`:''}</tr></thead>
      <tbody>${fees.map((f,i) => {
        const student = state.students.find(s => s.id === f.studentId);
        const status = (f.paidAmount||0) >= (f.amount||0) ? 'paid' : (f.paidAmount||0) > 0 ? 'partial' : 'unpaid';
        const statusLabel = { paid: {ar:'مدفوع',en:'Paid',cls:'success'}, partial: {ar:'جزئي',en:'Partial',cls:'warning'}, unpaid: {ar:'غير مدفوع',en:'Unpaid',cls:'danger'} };
        const sl = statusLabel[status];
        return `<tr><td>${i+1}</td><td>${student?.name||'—'}</td><td>${formatCurrency(f.amount)}</td><td>${formatCurrency(f.paidAmount)}</td><td><span class="badge badge-${sl.cls}">${sl[state.lang]}</span></td>${isAdmin?`<td><button class="btn btn-sm btn-outline edit-fee" data-id="${f.id}">✏️</button> <button class="btn btn-sm btn-success pay-fee" data-id="${f.id}">${state.lang==='ar'?'تسجيل دفع':'Pay'}</button> <button class="btn btn-sm btn-danger delete-fee" data-id="${f.id}">🗑️</button></td>`:''}</tr>`;
      }).join('')||`<tr><td colspan="${isAdmin?6:5}" class="text-center text-muted">${t('noData')}</td></tr>`}</tbody></table>
    </div>
  </div>`;
}

export function attachFinanceEvents() {
  document.getElementById('add-fee-btn')?.addEventListener('click', () => showFeeForm());
  document.querySelectorAll('.edit-fee').forEach(b => b.addEventListener('click', () => { const f=state.fees.find(x=>x.id===b.dataset.id); if(f) showFeeForm(f); }));
  document.querySelectorAll('.pay-fee').forEach(b => b.addEventListener('click', () => showPaymentForm(b.dataset.id)));
  document.querySelectorAll('.delete-fee').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'fees',b.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
  }));
}

function showFeeForm(fee = null) {
  const isEdit = !!fee;
  showModal(isEdit ? (state.lang==='ar'?'تعديل رسوم':'Edit Fee') : (state.lang==='ar'?'إضافة رسوم':'Add Fee'), `
    <form id="fee-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'الطالب':'Student'}</label>
        <select id="ff-student" class="form-select" required>${state.students.map(s=>`<option value="${s.id}" ${fee?.studentId===s.id?'selected':''}>${s.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>${state.lang==='ar'?'المبلغ':'Amount'}</label><input type="number" id="ff-amount" class="form-input" value="${fee?.amount||''}" required></div>
      <div class="form-group"><label>${state.lang==='ar'?'تاريخ الاستحقاق':'Due Date'}</label><input type="date" id="ff-due" class="form-input" value="${fee?.dueDate||''}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'ملاحظات':'Notes'}</label><input type="text" id="ff-notes" class="form-input" value="${fee?.notes||''}"></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('fee-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = { studentId: document.getElementById('ff-student').value, amount: Number(document.getElementById('ff-amount').value), dueDate: document.getElementById('ff-due').value, notes: document.getElementById('ff-notes').value.trim(), paidAmount: fee?.paidAmount || 0 };
    try { 
      if(isEdit) await updateDoc(doc(db,'fees',fee.id),data); 
      else await addDoc(collection(db,'fees'),data); 
      
      // Trigger notification for new/updated unpaid fee
      const student = state.students.find(s => s.id === data.studentId);
      if (student?.parentId && data.amount > data.paidAmount) {
        notificationService.triggerEventNotification('invoice_overdue', {
          recipientId: student.parentId,
          amount: formatCurrency(data.amount - data.paidAmount)
        });
      }

      closeModal(); 
      showToast(t('savedSuccess'),'success'); 
    } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}

function showPaymentForm(feeId) {
  const fee = state.fees.find(f => f.id === feeId);
  if (!fee) return;
  const remaining = (fee.amount || 0) - (fee.paidAmount || 0);
  showModal(state.lang==='ar'?'تسجيل دفعة':'Record Payment', `
    <form id="pay-form">
      <div class="form-group"><label>${state.lang==='ar'?'المتبقي':'Remaining'}: ${formatCurrency(remaining)}</label><input type="number" id="pay-amount" class="form-input" max="${remaining}" value="${remaining}" required></div>
      <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-success">${t('save')}</button></div>
    </form>`);
  document.getElementById('pay-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const amount = Number(document.getElementById('pay-amount').value);
    try { await updateDoc(doc(db,'fees',feeId), { paidAmount: (fee.paidAmount||0) + amount }); closeModal(); showToast(t('savedSuccess'),'success'); } catch(e) { showToast(t('errorOccurred'),'error'); }
  });
}
