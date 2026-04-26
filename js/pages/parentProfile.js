import { state, t } from '../state.js';
import { db, doc, updateDoc, deleteDoc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML, getInitials, formatCurrency } from '../ui.js';

export function renderParentProfile() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const parentId = params.get('id');
  
  const parent = state.parents.find(p => p.id === parentId);

  if (!parent) {
    return `
    <div class="page-content animate-in">
      <div class="empty-state glass-card">
        <span class="empty-icon">🔍</span>
        <h3>${state.lang === 'ar' ? 'لم يتم العثور على ولي الأمر' : 'Parent Not Found'}</h3>
        <p class="text-muted">${state.lang === 'ar' ? 'تأكد من المعرف أو أعد المحاولة لاحقاً' : 'Check ID or try again later'}</p>
        <button class="btn btn-outline" onclick="window.history.back()" style="margin-top:1rem">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
      </div>
    </div>`;
  }

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${state.lang === 'ar' ? 'ملف ولي الأمر' : 'Parent Profile'}</h2>
      <button class="btn btn-outline" onclick="window.history.back()">${state.lang === 'ar' ? 'عودة' : 'Back'}</button>
    </div>
    <div class="glass-card" style="padding: 1.5rem;">
      ${getParentDashboardHTML(parentId)}
    </div>
  </div>`;
}

function getParentDashboardHTML(parentId, activeTab = 'overview') {
  const parent = state.parents.find(p => p.id === parentId);
  if (!parent) return '';

  const children = state.students.filter(s => s.parentId === parentId);
  const childIds = children.map(s => s.id);
  const fees = state.fees.filter(f => childIds.includes(f.studentId));
  
  const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const pendingFees = totalFees - paidFees;

  const tabs = [
    { id: 'overview', label: state.lang === 'ar' ? 'نظرة عامة' : 'Overview', icon: '📊' },
    { id: 'children', label: state.lang === 'ar' ? 'الأبناء' : 'Children', icon: '👶' },
    { id: 'finance', label: state.lang === 'ar' ? 'المالية' : 'Financials', icon: '💰' }
  ];

  const content = {
    overview: `
      <div class="sp-widgets-grid">
        <div class="sp-widget widget-blue">
          <span class="sp-widget-icon">👶</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'الأبناء المسجلون' : 'Registered Children'}</span>
          <span class="sp-widget-value">${children.length}</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'طالب في المدرسة' : 'Students in school'}</span>
        </div>
        <div class="sp-widget widget-green">
          <span class="sp-widget-icon">✅</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid'}</span>
          <span class="sp-widget-value">${formatCurrency(paidFees)}</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'تم تحصيلها' : 'Collected'}</span>
        </div>
        <div class="sp-widget widget-red">
          <span class="sp-widget-icon">⏰</span>
          <span class="sp-widget-title">${state.lang === 'ar' ? 'المستحقات غير المدفوعة' : 'Unpaid Dues'}</span>
          <span class="sp-widget-value">${formatCurrency(pendingFees)}</span>
          <span class="sp-widget-footer">${state.lang === 'ar' ? 'بانتظار الدفع' : 'Waiting for payment'}</span>
        </div>
      </div>
      
      <div class="sp-section-card">
        <h4 class="sp-section-title">👤 ${state.lang === 'ar' ? 'معلومات التواصل' : 'Contact Information'}</h4>
        <div class="sp-info-grid">
          <div class="sp-info-item">
            <span class="sp-info-icon">📧</span>
            <div>
              <span class="sp-info-label">${t('email')}</span>
              <span class="sp-info-value">${parent.email || '—'}</span>
            </div>
          </div>
          <div class="sp-info-item">
            <span class="sp-info-icon">📞</span>
            <div>
              <span class="sp-info-label">${state.lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
              <span class="sp-info-value">${parent.phone || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    `,
    children: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">👶 ${state.lang === 'ar' ? 'قائمة الأبناء' : 'Children List'}</h4>
        <div class="children-grid-simple">
          ${children.map(s => {
            const cls = state.classes.find(c => c.id === s.classId);
            const studentFees = state.fees.filter(f => f.studentId === s.id);
            const unpaid = studentFees.reduce((sum, f) => sum + ((f.amount||0) - (f.paidAmount||0)), 0);
            
            return `
            <div class="child-profile-card glass-card">
              <div class="avatar avatar-md gradient-purple">${getInitials(s.name)}</div>
              <div class="child-profile-info">
                <h4>${escapeHTML(s.name)}</h4>
                <p>${cls?.name || '—'}</p>
                <div class="child-fee-status ${unpaid > 0 ? 'text-danger' : 'text-success'}">
                  ${unpaid > 0 ? (state.lang === 'ar' ? `مستحقات: ${formatCurrency(unpaid)}` : `Dues: ${formatCurrency(unpaid)}`) : (state.lang === 'ar' ? 'خالص الرسوم' : 'All Paid')}
                </div>
              </div>
              <button class="btn btn-sm btn-outline" onclick="window.location.hash='#student-profile?id=${s.id}'">${state.lang === 'ar' ? 'الملف' : 'Profile'}</button>
            </div>`;
          }).join('') || `<p class="text-center text-muted p-4">${t('noData')}</p>`}
        </div>
      </div>
    `,
    finance: `
      <div class="sp-section-card">
        <h4 class="sp-section-title">💰 ${state.lang === 'ar' ? 'سجل الرسوم والمستحقات' : 'Fees & Dues History'}</h4>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>${state.lang === 'ar' ? 'الطالب' : 'Student'}</th>
                <th>${state.lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th>${state.lang === 'ar' ? 'المدفوع' : 'Paid'}</th>
                <th>${state.lang === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                <th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${fees.map(f => {
                const student = state.students.find(s => s.id === f.studentId);
                const remaining = (f.amount || 0) - (f.paidAmount || 0);
                const status = remaining <= 0 ? 'paid' : (f.paidAmount > 0 ? 'partial' : 'unpaid');
                const statusLabel = { 
                  paid: {ar:'مدفوع',en:'Paid',cls:'success'}, 
                  partial: {ar:'جزئي',en:'Partial',cls:'warning'}, 
                  unpaid: {ar:'غير مدفوع',en:'Unpaid',cls:'danger'} 
                }[status];
                
                return `
                  <tr>
                    <td>${student?.name || '—'}</td>
                    <td>${formatCurrency(f.amount)}</td>
                    <td>${formatCurrency(f.paidAmount)}</td>
                    <td class="${remaining > 0 ? 'text-danger font-bold' : ''}">${formatCurrency(remaining)}</td>
                    <td><span class="badge badge-${statusLabel.cls}">${statusLabel[state.lang]}</span></td>
                  </tr>
                `;
              }).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `
  };

  return `
    <div class="student-profile-modal">
      <div class="sp-header">
        <div class="sp-user-info">
          <div class="avatar avatar-lg gradient-orange">${getInitials(parent.name)}</div>
          <div class="sp-user-details">
            <h3>${escapeHTML(parent.name)}</h3>
            <p>${parent.email} | ${state.lang === 'ar' ? 'ولي أمر' : 'Parent'}</p>
          </div>
        </div>
        <div class="sp-status-badge gradient-emerald" style="color: white; padding: 0.5rem 1.25rem;">
          ${state.lang === 'ar' ? 'الحساب: نشط' : 'Account: Active'}
        </div>
      </div>
      
      <div class="sp-layout">
        <div class="sp-sidebar">
          ${tabs.map(tab => `
            <button class="sp-tab-btn ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}" data-parent-id="${parentId}">
              <span class="icon">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="sp-main-content" id="parent-tab-content">
          ${content[activeTab]}
        </div>
      </div>
    </div>
  `;
}

export function attachParentProfileEvents() {
  if (window._parentProfileEventsAttached) return;
  window._parentProfileEventsAttached = true;

  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('.sp-tab-btn');
    if (tabBtn && tabBtn.dataset.parentId) {
      const tabId = tabBtn.dataset.tab;
      const parentId = tabBtn.dataset.parentId;
      
      const sidebar = tabBtn.closest('.sp-sidebar');
      if (!sidebar) return;

      // Update active state
      sidebar.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      
      // Update content
      const contentArea = document.getElementById('parent-tab-content');
      if (contentArea) {
        contentArea.innerHTML = '<div class="text-center p-4"><span class="spinner-sm"></span></div>';
        setTimeout(() => {
            const html = getParentDashboardHTML(parentId, tabId);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const newContentArea = tempDiv.querySelector('#parent-tab-content');
            if (newContentArea) {
                contentArea.innerHTML = newContentArea.innerHTML;
            }
        }, 50);
      }
    }
  });
}
