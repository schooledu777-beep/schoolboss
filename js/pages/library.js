import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency } from '../ui.js';
import { libraryService } from '../services/libraryService.js';

export function renderLibrary() {
  const isAdmin = state.profile?.role === 'admin';
  const activeTab = state.libraryTab || 'books';

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('library')}</h2>
      <div class="header-actions">
        ${isAdmin ? `<button class="btn btn-primary" id="add-book-btn">+ ${state.lang==='ar'?'إضافة كتاب':'Add Book'}</button>` : ''}
      </div>
    </div>

    <div class="tabs-nav glass-card" style="margin-bottom:1.5rem;">
      <button class="tab-btn ${activeTab==='books'?'active':''}" data-tab="books">${state.lang==='ar'?'الكتب':'Books'}</button>
      <button class="tab-btn ${activeTab==='borrowing'?'active':''}" data-tab="borrowing">${state.lang==='ar'?'الاستعارات':'Borrowing'}</button>
    </div>

    <div id="library-tab-content">
      ${activeTab === 'books' ? renderBooksTab(isAdmin) : renderBorrowingTab(isAdmin)}
    </div>
  </div>`;
}

function renderBooksTab(isAdmin) {
  const books = state.books;
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الكتاب':'Title'}</th>
          <th>${state.lang==='ar'?'المؤلف':'Author'}</th>
          <th>${state.lang==='ar'?'التصنيف':'Category'}</th>
          <th>${state.lang==='ar'?'الحالة':'Status'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${books.map(b => `
          <tr>
            <td>${b.title}</td>
            <td>${b.author || '—'}</td>
            <td>${b.category || '—'}</td>
            <td><span class="badge badge-${b.status === 'available' ? 'success' : 'warning'}">${b.status}</span></td>
            <td>
              ${b.status === 'available' ? `<button class="btn btn-sm btn-success borrow-btn" data-id="${b.id}">${state.lang==='ar'?'إعارة':'Borrow'}</button>` : ''}
              ${isAdmin ? `<button class="btn btn-sm btn-outline edit-book" data-id="${b.id}">✏️</button>` : ''}
            </td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderBorrowingTab(isAdmin) {
  const records = state.borrowingRecords;
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الطالب':'Student'}</th>
          <th>${state.lang==='ar'?'الكتاب':'Book'}</th>
          <th>${state.lang==='ar'?'تاريخ الاستحقاق':'Due Date'}</th>
          <th>${state.lang==='ar'?'الحالة':'Status'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${records.map(r => {
          const student = state.students.find(s => s.id === r.studentId);
          const book = state.books.find(b => b.id === r.bookId);
          const isOverdue = r.status === 'active' && new Date(r.dueDate) < new Date();
          return `
          <tr>
            <td>${student?.name || '—'}</td>
            <td>${book?.title || '—'}</td>
            <td><span style="${isOverdue?'color:var(--danger-color);font-weight:bold;':''}">${r.dueDate}</span></td>
            <td><span class="badge badge-${r.status === 'active' ? 'warning' : 'success'}">${r.status}</span></td>
            <td>
              ${r.status === 'active' ? `<button class="btn btn-sm btn-primary return-btn" data-id="${r.id}">${state.lang==='ar'?'إرجاع':'Return'}</button>` : ''}
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

export function attachLibraryEvents() {
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    state.libraryTab = b.dataset.tab;
    document.getElementById('main-content').innerHTML = renderLibrary();
    attachLibraryEvents();
  }));

  document.querySelectorAll('.borrow-btn').forEach(b => b.addEventListener('click', () => {
    const bookId = b.dataset.id;
    showModal(state.lang==='ar'?'إعارة كتاب':'Borrow Book', `
      <form id="borrow-form">
        <div class="form-group"><label>${state.lang==='ar'?'الطالب':'Student'}</label>
          <select id="borrow-student" class="form-select" required>${state.students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>${state.lang==='ar'?'تاريخ الإرجاع':'Due Date'}</label><input type="date" id="borrow-due" class="form-input" required></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">${state.lang==='ar'?'تأكيد':'Confirm'}</button></div>
      </form>`);
    
    document.getElementById('borrow-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const studentId = document.getElementById('borrow-student').value;
      const dueDate = document.getElementById('borrow-due').value;
      try {
        await libraryService.borrowBook(studentId, bookId, dueDate);
        closeModal();
        showToast(t('savedSuccess'), 'success');
      } catch(err) {
        showToast(err.message, 'error');
      }
    });
  }));

  document.querySelectorAll('.return-btn').forEach(b => b.addEventListener('click', async () => {
    try {
      await libraryService.returnBook(b.dataset.id);
      showToast(t('savedSuccess'), 'success');
    } catch(err) {
      showToast(err.message, 'error');
    }
  }));

  document.getElementById('add-book-btn')?.addEventListener('click', () => {
    showModal(state.lang==='ar'?'إضافة كتاب':'Add Book', `
      <form id="add-book-form">
        <div class="form-group"><label>${state.lang==='ar'?'العنوان':'Title'}</label><input type="text" id="book-title" class="form-input" required></div>
        <div class="form-group"><label>${state.lang==='ar'?'المؤلف':'Author'}</label><input type="text" id="book-author" class="form-input"></div>
        <div class="form-group"><label>${state.lang==='ar'?'التصنيف':'Category'}</label><input type="text" id="book-cat" class="form-input"></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">${t('save')}</button></div>
      </form>`);
    
    document.getElementById('add-book-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { title: document.getElementById('book-title').value, author: document.getElementById('book-author').value, category: document.getElementById('book-cat').value, status: 'available' };
      await addDoc(collection(db, 'books'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    });
  });
}
