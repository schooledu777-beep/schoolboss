import { state, t } from '../state.js';
import { db, collection, addDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatCurrency } from '../ui.js';
import { hostelService } from '../services/hostelService.js';

export function renderHostel() {
  const isAdmin = state.profile?.role === 'admin';
  const activeTab = state.hostelTab || 'rooms';

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('hostel')}</h2>
      <div class="header-actions">
        ${isAdmin ? `<button class="btn btn-primary" id="add-room-btn">+ ${state.lang==='ar'?'إضافة غرفة':'Add Room'}</button>` : ''}
      </div>
    </div>

    <div class="tabs-nav glass-card" style="margin-bottom:1.5rem;">
      <button class="tab-btn ${activeTab==='rooms'?'active':''}" data-tab="rooms">${state.lang==='ar'?'الغرف':'Rooms'}</button>
      <button class="tab-btn ${activeTab==='allocations'?'active':''}" data-tab="allocations">${state.lang==='ar'?'التسكين':'Allocations'}</button>
    </div>

    <div id="hostel-tab-content">
      ${activeTab === 'rooms' ? renderRoomsTab(isAdmin) : renderAllocationsTab(isAdmin)}
    </div>
  </div>`;
}

function renderRoomsTab(isAdmin) {
  const rooms = state.rooms;
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الغرفة':'Room'}</th>
          <th>${state.lang==='ar'?'المبنى':'Building'}</th>
          <th>${state.lang==='ar'?'السعة':'Capacity'}</th>
          <th>${state.lang==='ar'?'المشغول':'Occupied'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${rooms.map(r => {
          const occupied = state.bedAllocations.filter(a => a.roomId === r.id && a.status === 'active').length;
          return `
          <tr>
            <td>${r.number}</td>
            <td>${r.building || '—'}</td>
            <td>${r.capacity}</td>
            <td>${occupied}</td>
            <td>
              ${occupied < Number(r.capacity) ? `<button class="btn btn-sm btn-success allocate-btn" data-id="${r.id}">${state.lang==='ar'?'تسكين':'Allocate'}</button>` : '<span class="badge badge-danger">Full</span>'}
              ${isAdmin ? `<button class="btn btn-sm btn-outline edit-room" data-id="${r.id}">✏️</button>` : ''}
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderAllocationsTab(isAdmin) {
  const allocations = state.bedAllocations;
  return `
  <div class="table-responsive glass-card">
    <table class="data-table">
      <thead>
        <tr>
          <th>${state.lang==='ar'?'الطالب':'Student'}</th>
          <th>${state.lang==='ar'?'الغرفة':'Room'}</th>
          <th>${state.lang==='ar'?'التاريخ':'Date'}</th>
          <th>${state.lang==='ar'?'الحالة':'Status'}</th>
          <th>${state.lang==='ar'?'الإجراءات':'Actions'}</th>
        </tr>
      </thead>
      <tbody>
        ${allocations.map(a => {
          const student = state.students.find(s => s.id === a.studentId);
          const room = state.rooms.find(r => r.id === a.roomId);
          return `
          <tr>
            <td>${student?.name || '—'}</td>
            <td>${room?.number || '—'}</td>
            <td>${new Date(a.allocationDate).toLocaleDateString()}</td>
            <td><span class="badge badge-${a.status === 'active' ? 'success' : 'secondary'}">${a.status}</span></td>
            <td>
              ${a.status === 'active' ? `<button class="btn btn-sm btn-danger release-btn" data-id="${a.id}">${state.lang==='ar'?'إخلاء':'Release'}</button>` : ''}
            </td>
          </tr>`;
        }).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('noData')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

export function attachHostelEvents() {
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    state.hostelTab = b.dataset.tab;
    document.getElementById('main-content').innerHTML = renderHostel();
    attachHostelEvents();
  }));

  document.querySelectorAll('.allocate-btn').forEach(b => b.addEventListener('click', () => {
    const roomId = b.dataset.id;
    const room = state.rooms.find(r => r.id === roomId);
    showModal(state.lang==='ar'?'تسكين طالب':'Allocate Student', `
      <form id="allocate-form">
        <div class="form-group"><label>${state.lang==='ar'?'الطالب':'Student'}</label>
          <select id="alloc-student" class="form-select" required>${state.students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
        </div>
        <p class="text-muted">${state.lang==='ar'?'الغرفة':'Room'}: ${room.number} (${room.building})</p>
        <div class="form-actions"><button type="submit" class="btn btn-primary">${state.lang==='ar'?'تأكيد':'Confirm'}</button></div>
      </form>`);
    
    document.getElementById('allocate-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const studentId = document.getElementById('alloc-student').value;
      try {
        await hostelService.allocateBed(studentId, roomId, room.buildingId || '');
        closeModal();
        showToast(t('savedSuccess'), 'success');
      } catch(err) {
        showToast(err.message, 'error');
      }
    });
  }));

  document.querySelectorAll('.release-btn').forEach(b => b.addEventListener('click', async () => {
    try {
      await hostelService.deallocateBed(b.dataset.id);
      showToast(t('savedSuccess'), 'success');
    } catch(err) {
      showToast(err.message, 'error');
    }
  }));

  document.getElementById('add-room-btn')?.addEventListener('click', () => {
    showModal(state.lang==='ar'?'إضافة غرفة':'Add Room', `
      <form id="add-room-form">
        <div class="form-group"><label>${state.lang==='ar'?'رقم الغرفة':'Room Number'}</label><input type="text" id="room-num" class="form-input" required></div>
        <div class="form-group"><label>${state.lang==='ar'?'المبنى':'Building'}</label><input type="text" id="room-build" class="form-input"></div>
        <div class="form-group"><label>${state.lang==='ar'?'السعة':'Capacity'}</label><input type="number" id="room-cap" class="form-input" value="4" required></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">${t('save')}</button></div>
      </form>`);
    
    document.getElementById('add-room-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const data = { number: document.getElementById('room-num').value, building: document.getElementById('room-build').value, capacity: Number(document.getElementById('room-cap').value) };
      await addDoc(collection(db, 'rooms'), data);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    });
  });
}
