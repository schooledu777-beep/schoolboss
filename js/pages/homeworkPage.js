import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, checkValid } from '../ui.js';

// ========================= HOMEWORK MODULE =========================

export function renderHomework() {
  const isAr = state.lang === 'ar';
  const role = state.profile?.role;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';
  const isStudent = role === 'student';
  const canManage = isAdmin || isTeacher;

  // Filter homework by role
  let homework = state.homework || [];
  if (isTeacher) {
    homework = homework.filter(h => h.teacherId === state.profile?.uid);
  }
  if (isStudent) {
    const myClass = state.classes.find(c => (c.studentIds||[]).includes(state.profile?.uid) || c.id === state.profile?.classId);
    homework = homework.filter(h => h.classId === myClass?.id || h.targetAll);
  }
  if (isParent) {
    const kidIds = state.profile?.studentIds || state.students.filter(s => s.parentId === state.profile?.uid).map(s => s.id);
    const kidClasses = state.students.filter(s => kidIds.includes(s.id)).map(s => s.classId);
    homework = homework.filter(h => kidClasses.includes(h.classId) || h.targetAll);
  }

  // Stats
  const now = new Date().toISOString().split('T')[0];
  const pending = homework.filter(h => h.dueDate >= now && h.status !== 'closed').length;
  const overdue = homework.filter(h => h.dueDate < now && h.status !== 'closed').length;
  const closed  = homework.filter(h => h.status === 'closed').length;

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>📚 ${isAr ? 'الواجبات المنزلية' : 'Homework'}</h2>
      <div class="header-actions">
        ${canManage ? `<button class="btn btn-primary" id="add-hw-btn">+ ${isAr ? 'إضافة واجب' : 'Add Homework'}</button>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid grid-3" style="margin-bottom:1.5rem;">
      <div class="stat-card gradient-blue">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${pending}</h3><p>${isAr ? 'قيد التنفيذ' : 'Active'}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">⏰</div>
        <div class="stat-info"><h3>${overdue}</h3><p>${isAr ? 'متأخر' : 'Overdue'}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">✅</div>
        <div class="stat-info"><h3>${closed}</h3><p>${isAr ? 'منتهي' : 'Closed'}</p></div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar glass-card">
      <input type="text" id="hw-search" class="form-input" placeholder="🔍 ${t('search')}...">
      <select id="hw-subject-filter" class="form-select">
        <option value="">${isAr ? 'كل المواد' : 'All Subjects'}</option>
        ${[...new Set(homework.map(h => h.subject).filter(Boolean))].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select id="hw-status-filter" class="form-select">
        <option value="">${isAr ? 'كل الحالات' : 'All Statuses'}</option>
        <option value="active">${isAr ? 'نشط' : 'Active'}</option>
        <option value="overdue">${isAr ? 'متأخر' : 'Overdue'}</option>
        <option value="closed">${isAr ? 'منتهي' : 'Closed'}</option>
      </select>
    </div>

    <!-- Homework Cards -->
    <div id="hw-list">
      ${homework.length === 0
        ? `<div class="empty-state glass-card"><span class="empty-icon">📚</span><h3>${isAr ? 'لا توجد واجبات' : 'No homework found'}</h3></div>`
        : homework.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map(h => renderHomeworkCard(h, canManage)).join('')}
    </div>
  </div>`;
}

function renderHomeworkCard(hw, canManage) {
  const isAr = state.lang === 'ar';
  const now = new Date().toISOString().split('T')[0];
  const cls = state.classes.find(c => c.id === hw.classId);
  const teacher = state.teachers.find(t => t.id === hw.teacherId);
  const isOverdue = hw.dueDate < now && hw.status !== 'closed';
  const isClosed = hw.status === 'closed';

  const statusBadge = isClosed
    ? `<span class="badge badge-success">${isAr ? 'منتهي' : 'Closed'}</span>`
    : isOverdue
      ? `<span class="badge badge-danger">${isAr ? 'متأخر' : 'Overdue'}</span>`
      : `<span class="badge badge-info">${isAr ? 'نشط' : 'Active'}</span>`;

  const daysLeft = () => {
    if (isClosed) return '';
    const diff = Math.ceil((new Date(hw.dueDate) - new Date(now)) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `<span style="color:#ef4444;font-size:.8rem;">${Math.abs(diff)} ${isAr ? 'يوم تأخير' : 'days overdue'}</span>`;
    if (diff === 0) return `<span style="color:#f59e0b;font-size:.8rem;">${isAr ? 'ينتهي اليوم' : 'Due today'}</span>`;
    return `<span style="color:#10b981;font-size:.8rem;">${diff} ${isAr ? 'يوم متبقي' : 'days left'}</span>`;
  };

  const priorityColor = hw.priority === 'high' ? '#ef4444' : hw.priority === 'medium' ? '#f59e0b' : '#6b7280';

  return `
  <div class="glass-card hw-card" data-id="${hw.id}" data-subject="${hw.subject||''}" data-status="${isClosed?'closed':isOverdue?'overdue':'active'}"
       style="margin-bottom:1rem;padding:1.25rem;border-${isAr?'right':'left'}:4px solid ${priorityColor};transition:all .2s;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.5rem;">
          <h3 style="margin:0;font-size:1rem;font-weight:700;">${hw.title}</h3>
          ${statusBadge}
          ${hw.priority === 'high' ? `<span class="badge badge-danger">${isAr ? 'عاجل' : 'Urgent'}</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:1rem;font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem;">
          ${hw.subject ? `<span>📘 ${hw.subject}</span>` : ''}
          ${cls ? `<span>🏫 ${cls.name}</span>` : ''}
          ${teacher ? `<span>👨‍🏫 ${teacher.name}</span>` : ''}
          <span>📅 ${isAr ? 'تسليم:' : 'Due:'} ${formatDate(hw.dueDate, isAr)}</span>
        </div>
        ${hw.description ? `<p style="font-size:.85rem;color:var(--text-secondary);margin:.5rem 0 0;">${hw.description}</p>` : ''}
        <div style="margin-top:.5rem;">${daysLeft()}</div>
      </div>
      ${canManage ? `
      <div style="display:flex;gap:.5rem;flex-shrink:0;">
        <button class="btn btn-sm btn-outline edit-hw" data-id="${hw.id}">✏️</button>
        <button class="btn btn-sm ${isClosed ? 'btn-warning' : 'btn-success'} toggle-hw" data-id="${hw.id}" data-closed="${isClosed}">
          ${isClosed ? (isAr ? 'إعادة فتح' : 'Reopen') : (isAr ? 'إغلاق' : 'Close')}
        </button>
        <button class="btn btn-sm btn-danger delete-hw" data-id="${hw.id}">🗑️</button>
      </div>` : ''}
    </div>
  </div>`;
}

function formatDate(dateStr, isAr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function attachHomeworkEvents() {
  const canManage = ['admin', 'teacher'].includes(state.profile?.role);

  document.getElementById('add-hw-btn')?.addEventListener('click', () => showHomeworkForm());

  document.getElementById('hw-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.hw-card').forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('hw-subject-filter')?.addEventListener('change', applyFilters);
  document.getElementById('hw-status-filter')?.addEventListener('change', applyFilters);

  if (canManage) {
    document.querySelectorAll('.edit-hw').forEach(btn => {
      btn.addEventListener('click', () => {
        const hw = (state.homework || []).find(h => h.id === btn.dataset.id);
        if (hw) showHomeworkForm(hw);
      });
    });

    document.querySelectorAll('.delete-hw').forEach(btn => {
      btn.addEventListener('click', () => {
        showConfirm(
          state.lang === 'ar' ? 'حذف الواجب' : 'Delete Homework',
          state.lang === 'ar' ? 'هل تريد حذف هذا الواجب؟' : 'Delete this homework?',
          async () => {
            try {
              await deleteDoc(doc(db, 'homework', btn.dataset.id));
              showToast(t('deletedSuccess'), 'success');
            } catch { showToast(t('errorOccurred'), 'error'); }
          }
        );
      });
    });

    document.querySelectorAll('.toggle-hw').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isClosed = btn.dataset.closed === 'true';
        try {
          await updateDoc(doc(db, 'homework', btn.dataset.id), { status: isClosed ? 'active' : 'closed' });
          showToast(t('savedSuccess'), 'success');
        } catch { showToast(t('errorOccurred'), 'error'); }
      });
    });
  }
}

function applyFilters() {
  const subjectFilter = document.getElementById('hw-subject-filter')?.value;
  const statusFilter  = document.getElementById('hw-status-filter')?.value;
  document.querySelectorAll('.hw-card').forEach(card => {
    const subjectOk = !subjectFilter || card.dataset.subject === subjectFilter;
    const statusOk  = !statusFilter  || card.dataset.status  === statusFilter;
    card.style.display = subjectOk && statusOk ? '' : 'none';
  });
}

function showHomeworkForm(hw = null) {
  const isAr = state.lang === 'ar';
  const isEdit = !!hw;
  const role = state.profile?.role;

  let classes = state.classes;
  if (role === 'teacher') {
    classes = classes.filter(c => c.teacherId === state.profile?.uid);
  }

  showModal(isEdit ? (isAr ? 'تعديل الواجب' : 'Edit Homework') : (isAr ? 'إضافة واجب' : 'Add Homework'), `
    <form id="hw-form" class="form-grid">
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'عنوان الواجب' : 'Homework Title'}</label>
        <input type="text" id="hwf-title" class="form-input" value="${hw?.title || ''}" required placeholder="${isAr ? 'مثال: حل تمارين الفصل الثالث' : 'e.g. Solve Chapter 3 exercises'}">
      </div>
      <div class="form-group">
        <label>${isAr ? 'المادة' : 'Subject'}</label>
        <input type="text" id="hwf-subject" class="form-input" value="${hw?.subject || ''}" list="subjects-list" required>
        <datalist id="subjects-list">
          ${state.subjects.map(s => `<option value="${s.name}">`).join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الصف' : 'Class'}</label>
        <select id="hwf-class" class="form-select" required>
          <option value="">${isAr ? 'اختر الصف' : 'Select class'}</option>
          ${classes.map(c => `<option value="${c.id}" ${hw?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'تاريخ التسليم' : 'Due Date'}</label>
        <input type="date" id="hwf-due" class="form-input" value="${hw?.dueDate || ''}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'الأولوية' : 'Priority'}</label>
        <select id="hwf-priority" class="form-select">
          <option value="low"    ${(hw?.priority||'low') === 'low'    ? 'selected' : ''}>${isAr ? 'منخفضة' : 'Low'}</option>
          <option value="medium" ${hw?.priority === 'medium' ? 'selected' : ''}>${isAr ? 'متوسطة' : 'Medium'}</option>
          <option value="high"   ${hw?.priority === 'high'   ? 'selected' : ''}>${isAr ? 'عالية (عاجل)' : 'High (Urgent)'}</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label>${isAr ? 'وصف الواجب' : 'Description'}</label>
        <textarea id="hwf-desc" class="form-input" rows="4" style="resize:vertical;" placeholder="${isAr ? 'تفاصيل الواجب والتعليمات...' : 'Homework details and instructions...'}">${hw?.description || ''}</textarea>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
          <input type="checkbox" id="hwf-targetall" ${hw?.targetAll ? 'checked' : ''}>
          ${isAr ? 'ينطبق على كل الصفوف' : 'Apply to all classes'}
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  document.getElementById('hw-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title   = document.getElementById('hwf-title').value.trim();
    const subject = document.getElementById('hwf-subject').value.trim();
    const classId = document.getElementById('hwf-class').value;
    const dueDate = document.getElementById('hwf-due').value;

    if (!checkValid({
      title:   { value: title,   required: true, label: isAr ? 'العنوان' : 'Title' },
      subject: { value: subject, required: true, label: isAr ? 'المادة'  : 'Subject' },
      dueDate: { value: dueDate, required: true, label: isAr ? 'تاريخ التسليم' : 'Due Date' },
    }, state.lang)) return;

    const data = {
      title, subject,
      classId:     classId || null,
      dueDate,
      priority:    document.getElementById('hwf-priority').value,
      description: document.getElementById('hwf-desc').value.trim(),
      targetAll:   document.getElementById('hwf-targetall').checked,
      teacherId:   state.profile?.uid,
      status:      hw?.status || 'active',
      createdAt:   hw?.createdAt || new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      if (isEdit) await updateDoc(doc(db, 'homework', hw.id), data);
      else        await addDoc(collection(db, 'homework'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[Homework] Save error:', err);
      showToast(t('errorOccurred'), 'error');
      btn.disabled = false; btn.innerHTML = old;
    }
  });
}
