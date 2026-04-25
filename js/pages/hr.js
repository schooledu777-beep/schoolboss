import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency } from '../ui.js';
import { hrService } from '../services/hrService.js';

export function renderHR() {
  const isAdmin = state.profile?.role === 'admin';
  const activeTab = state.hrTab || 'staff';

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('hr')}</h2>
      <div class="header-actions">
        ${isAdmin ? `<button class="btn btn-primary" id="add-staff-btn">+ ${state.lang==='ar'?'إضافة موظف':'Add Staff'}</button>` : ''}
      </div>
    </div>

    <div class="tabs-nav glass-card" style="margin-bottom:1.5rem;">
      <button class="tab-btn ${activeTab==='staff'?'active':''}" data-tab="staff">${t('teachers')}</button>
      <button class="tab-btn ${activeTab==='leaves'?'active':''}" data-tab="leaves">${t('leaves')}</button>
      <button class="tab-btn ${activeTab==='payroll'?'active':''}" data-tab="payroll">${t('payroll')}</button>
    </div>

    <div id="hr-tab-content">
      ${activeTab === 'staff' ? renderStaffTab(isAdmin) : activeTab === 'leaves' ? renderLeavesTab(isAdmin) : renderPayrollTab(isAdmin)}
    </div>
  </div>`;
}

function renderStaffTab(isAdmin) {
  const staff = state.teachers; // Extended teachers collection
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الاسم':'Name'}</th>
          <th>${state.lang==='ar'?'التخصص':'Specialty'}</th>
          <th>${state.lang==='ar'?'الراتب الأساسي':'Base Salary'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${staff.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.specialty || '—'}</td>
            <td>${formatCurrency(s.baseSalary || 0)}</td>
            <td>
              ${isAdmin ? `<button class="btn btn-sm btn-outline edit-staff" data-id="${s.id}">✏️</button>` : ''}
            </td>
          </tr>
        `).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderLeavesTab(isAdmin) {
  const leaves = state.leaves;
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الموظف':'Staff'}</th>
          <th>${state.lang==='ar'?'النوع':'Type'}</th>
          <th>${state.lang==='ar'?'من':'From'}</th>
          <th>${state.lang==='ar'?'إلى':'To'}</th>
          <th>${state.lang==='ar'?'الحالة':'Status'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${leaves.map(l => {
          const s = state.teachers.find(st => st.id === l.staffId);
          return `
          <tr>
            <td>${s?.name || '—'}</td>
            <td>${l.type === 'sick' ? (state.lang==='ar'?'مرضي':'Sick') : l.type === 'unpaid' ? (state.lang==='ar'?'بدون راتب':'Unpaid') : (state.lang==='ar'?'سنوي':'Annual')}</td>
            <td>${l.startDate}</td>
            <td>${l.endDate}</td>
            <td><span class="badge badge-${l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'}">${l.status}</span></td>
            <td>
              ${isAdmin && l.status === 'pending' ? `
                <button class="btn btn-sm btn-success approve-leave" data-id="${l.id}">✅</button>
                <button class="btn btn-sm btn-danger reject-leave" data-id="${l.id}">❌</button>
              ` : ''}
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderPayrollTab(isAdmin) {
  return `
  <div class="glass-card" style="padding:1.5rem;">
    <h3>${state.lang==='ar'?'احتساب الرواتب':'Generate Payroll'}</h3>
    <form id="payroll-form" class="form-grid">
      <div class="form-group"><label>${state.lang==='ar'?'الشهر':'Month'}</label><input type="number" id="pay-month" class="form-input" min="1" max="12" value="${new Date().getMonth()+1}"></div>
      <div class="form-group"><label>${state.lang==='ar'?'السنة':'Year'}</label><input type="number" id="pay-year" class="form-input" value="${new Date().getFullYear()}"></div>
      <div class="form-actions"><button type="submit" class="btn btn-primary">${state.lang==='ar'?'حساب الجميع':'Calculate for All'}</button></div>
    </form>
    <div id="payroll-results" style="margin-top:2rem;"></div>
  </div>`;
}

export function attachHREvents() {
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    state.hrTab = b.dataset.tab;
    document.getElementById('main-content').innerHTML = renderHR();
    attachHREvents();
  }));

  document.querySelectorAll('.approve-leave').forEach(b => b.addEventListener('click', async () => {
    await hrService.approveLeave(b.dataset.id);
    showToast(t('savedSuccess'), 'success');
  }));

  document.querySelectorAll('.reject-leave').forEach(b => b.addEventListener('click', async () => {
    await hrService.rejectLeave(b.dataset.id);
    showToast(t('savedSuccess'), 'success');
  }));

  document.getElementById('add-staff-btn')?.addEventListener('click', () => {
    // Redirect to teachers page or show a generic staff form
    // Since we merged staff into teachers for now:
    showToast(state.lang==='ar'?'سيتم توجيهك لصفحة المعلمين لإضافة الموظف':'Redirecting to Teachers page to add staff', 'info');
    setTimeout(() => window.location.hash = 'teachers', 1000);
  });

  document.getElementById('payroll-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const month = Number(document.getElementById('pay-month').value);
    const year = Number(document.getElementById('pay-year').value);
    const results = state.teachers.map(s => hrService.calculateMonthlyPayroll(s.id, month, year)).filter(r => r !== null);
    
    document.getElementById('payroll-results').innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>${state.lang==='ar'?'الموظف':'Staff'}</th>
              <th>${state.lang==='ar'?'الأساسي':'Base'}</th>
              <th>${state.lang==='ar'?'الخصومات':'Deductions'}</th>
              <th>${state.lang==='ar'?'الصافي':'Net'}</th>
              <th>${state.lang==='ar'?'إجراء':'Action'}</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td>${r.staffName}</td>
                <td>${formatCurrency(r.baseSalary)}</td>
                <td>${formatCurrency(r.deductions)} (${r.deductionDays} d)</td>
                <td><strong>${formatCurrency(r.finalSalary)}</strong></td>
                <td><button class="btn btn-sm btn-outline print-slip" data-staff="${r.staffId}">${state.lang==='ar'?'كشف':'Slip'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    
    document.querySelectorAll('.print-slip').forEach(b => b.addEventListener('click', () => {
        const res = results.find(x => x.staffId === b.dataset.staff);
        showSalarySlip(res);
    }));
  });
}

function showSalarySlip(res) {
    showModal(state.lang==='ar'?'قسيمة الراتب':'Salary Slip', `
        <div class="salary-slip" style="padding:1rem;line-height:1.8;">
            <div style="text-align:center;margin-bottom:1rem;border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;">
                <h3>${t('appName')}</h3>
                <p>${t('payroll')} - ${res.month}/${res.year}</p>
            </div>
            <div class="grid-2">
                <div><strong>${state.lang==='ar'?'اسم الموظف':'Staff Name'}:</strong> ${res.staffName}</div>
                <div style="text-align:right;"><strong>${state.lang==='ar'?'التاريخ':'Date'}:</strong> ${new Date(res.generatedAt).toLocaleDateString()}</div>
            </div>
            <hr style="margin:1rem 0;opacity:0.2;">
            <div style="display:flex;justify-content:space-between;"><span>${state.lang==='ar'?'الراتب الأساسي':'Base Salary'}</span><span>${formatCurrency(res.baseSalary)}</span></div>
            <div style="display:flex;justify-content:space-between;color:var(--danger-color);"><span>${state.lang==='ar'?'الخصومات (إجازات غير مدفوعة)':'Deductions (Unpaid Leaves)'}</span><span>- ${formatCurrency(res.deductions)}</span></div>
            <hr style="margin:1rem 0;opacity:0.2;">
            <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:bold;"><span>${state.lang==='ar'?'صافي الراتب':'Net Salary'}</span><span>${formatCurrency(res.finalSalary)}</span></div>
            <div class="form-actions" style="margin-top:2rem;"><button class="btn btn-primary" onclick="window.print()">${state.lang==='ar'?'طباعة':'Print'}</button></div>
        </div>
    `);
}

