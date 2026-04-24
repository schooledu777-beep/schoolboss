import { state, t } from '../state.js';
import { db, collection, addDoc, deleteDoc, doc, setDoc } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatDate } from '../ui.js';

// ========================= ANNOUNCEMENTS =========================
export function renderAnnouncements() {
  const role = state.profile?.role;
  const canPost = role === 'admin' || role === 'teacher';
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('announcements')}</h2>${canPost ? `<button class="btn btn-primary" id="add-announce-btn">+ ${state.lang==='ar'?'إعلان جديد':'New Announcement'}</button>` : ''}</div>
    <div class="announcements-list">
      ${state.announcements.map(a => `
        <div class="announcement-card glass-card ${a.priority==='high'?'priority-high':''}">
          <div class="announce-header"><h3>${a.title}</h3><span class="text-muted text-sm">${formatDate(a.date)}</span></div>
          <p>${a.body||''}</p>
          <div class="announce-footer"><span class="badge">${a.targetRole ? t(a.targetRole) : (state.lang==='ar'?'الجميع':'Everyone')}</span>
          ${role==='admin'?`<button class="btn btn-sm btn-danger delete-announce" data-id="${a.id}">🗑️</button>`:''}</div>
        </div>`).join('') || `<div class="empty-state glass-card"><span class="empty-icon">📢</span><h3>${t('noData')}</h3></div>`}
    </div>
  </div>`;
}

export function attachAnnouncementEvents() {
  document.getElementById('add-announce-btn')?.addEventListener('click', () => {
    showModal(state.lang==='ar'?'إعلان جديد':'New Announcement', `
      <form id="announce-form" class="form-grid">
        <div class="form-group full-width"><label>${state.lang==='ar'?'العنوان':'Title'}</label><input type="text" id="af-title" class="form-input" required></div>
        <div class="form-group full-width"><label>${state.lang==='ar'?'المحتوى':'Content'}</label><textarea id="af-body" class="form-input" rows="4" required></textarea></div>
        <div class="form-group"><label>${state.lang==='ar'?'الفئة المستهدفة':'Target'}</label>
          <select id="af-target" class="form-select"><option value="">${state.lang==='ar'?'الجميع':'Everyone'}</option><option value="teacher">${t('teachers')}</option><option value="parent">${t('parents')}</option><option value="student">${t('students')}</option></select>
        </div>
        <div class="form-group"><label>${state.lang==='ar'?'الأولوية':'Priority'}</label>
          <select id="af-priority" class="form-select"><option value="normal">${state.lang==='ar'?'عادية':'Normal'}</option><option value="high">${state.lang==='ar'?'مهمة':'High'}</option></select>
        </div>
        <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${t('save')}</button></div>
      </form>`);
    document.getElementById('announce-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await addDoc(collection(db,'announcements'), { title: document.getElementById('af-title').value.trim(), body: document.getElementById('af-body').value.trim(), targetRole: document.getElementById('af-target').value, priority: document.getElementById('af-priority').value, sender: state.profile?.name, date: new Date().toISOString() });
        closeModal(); showToast(t('savedSuccess'),'success');
      } catch(e) { showToast(t('errorOccurred'),'error'); }
    });
  });
  document.querySelectorAll('.delete-announce').forEach(b => b.addEventListener('click', () => {
    showConfirm(t('delete'),t('confirmDelete'), async()=>{ try{ await deleteDoc(doc(db,'announcements',b.dataset.id)); showToast(t('deletedSuccess'),'success'); }catch(e){ showToast(t('errorOccurred'),'error'); }});
  }));
}

// ========================= MESSAGES =========================
export function renderMessages() {
  const myMessages = state.messages.filter(m => m.to === state.profile?.uid || m.from === state.profile?.uid);
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('messages')}</h2><button class="btn btn-primary" id="new-msg-btn">+ ${state.lang==='ar'?'رسالة جديدة':'New Message'}</button></div>
    <div class="messages-list">
      ${myMessages.map(m => {
        const isIncoming = m.to === state.profile?.uid;
        const otherName = isIncoming ? m.fromName : m.toName;
        return `<div class="message-card glass-card ${!m.read && isIncoming ? 'unread' : ''}">
          <div class="msg-header"><strong>${isIncoming ? '📥' : '📤'} ${otherName || '—'}</strong><span class="text-muted text-sm">${formatDate(m.date)}</span></div>
          <p class="msg-subject"><strong>${m.subject || ''}</strong></p>
          <p class="text-muted">${(m.body||'').substring(0,100)}...</p>
        </div>`;
      }).join('') || `<div class="empty-state glass-card"><span class="empty-icon">✉️</span><h3>${t('noData')}</h3></div>`}
    </div>
  </div>`;
}

export function attachMessageEvents() {
  document.getElementById('new-msg-btn')?.addEventListener('click', () => {
    const allUsers = [...state.teachers, ...state.parents];
    if (state.profile?.role === 'admin') allUsers.push(...state.students);
    showModal(state.lang==='ar'?'رسالة جديدة':'New Message', `
      <form id="msg-form" class="form-grid">
        <div class="form-group full-width"><label>${state.lang==='ar'?'إلى':'To'}</label>
          <select id="mf-to" class="form-select" required>${allUsers.map(u=>`<option value="${u.id}">${u.name} (${u.role||''})</option>`).join('')}</select>
        </div>
        <div class="form-group full-width"><label>${state.lang==='ar'?'الموضوع':'Subject'}</label><input type="text" id="mf-subject" class="form-input" required></div>
        <div class="form-group full-width"><label>${state.lang==='ar'?'الرسالة':'Message'}</label><textarea id="mf-body" class="form-input" rows="4" required></textarea></div>
        <div class="form-actions"><button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button><button type="submit" class="btn btn-primary">${state.lang==='ar'?'إرسال':'Send'}</button></div>
      </form>`);
    document.getElementById('msg-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const toId = document.getElementById('mf-to').value;
      const toUser = allUsers.find(u => (u.uid || u.id) === toId);
      try {
        const payload = { 
          from: state.profile?.uid || 'unknown', 
          fromName: state.profile?.name || 'Unknown', 
          to: toId, 
          toName: toUser?.name || 'Unknown', 
          subject: document.getElementById('mf-subject').value.trim(), 
          body: document.getElementById('mf-body').value.trim(), 
          date: new Date().toISOString(), 
          read: false 
        };
        await addDoc(collection(db,'messages'), payload);
        closeModal(); showToast(state.lang==='ar'?'تم الإرسال':'Sent!','success');
      } catch(e) { 
        console.error(e); 
        showToast(t('errorOccurred'),'error'); 
      }
    });
  });
}

// ========================= SETTINGS =========================
export function renderSettings() {
  if (state.profile?.role !== 'admin') {
    return `<div class="page-content animate-in"><div class="empty-state glass-card"><span class="empty-icon">🔒</span><h3>${state.lang==='ar'?'لا يوجد صلاحية':'Access Denied'}</h3></div></div>`;
  }
  return `
  <div class="page-content animate-in">
    <div class="page-header"><h2>${t('settings')}</h2></div>
    <div class="settings-grid">
      <div class="card glass-card">
        <h3 class="card-title">${t('schoolType')}</h3>
        <p class="text-muted" style="margin-bottom:1rem">${state.lang==='ar'?'تحديد نوع المدرسة يتحكم بظهور النظام المالي':'School type controls visibility of the finance module'}</p>
        <div class="toggle-group">
          <label class="toggle-label ${state.schoolType==='public'?'active':''}" id="toggle-public">
            <input type="radio" name="school-type" value="public" ${state.schoolType==='public'?'checked':''}>
            <span>🏛️ ${t('publicSchool')}</span>
          </label>
          <label class="toggle-label ${state.schoolType==='private'?'active':''}" id="toggle-private">
            <input type="radio" name="school-type" value="private" ${state.schoolType==='private'?'checked':''}>
            <span>🏫 ${t('privateSchool')}</span>
          </label>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang==='ar'?'المظهر':'Appearance'}</h3>
        <div class="setting-row"><span>${state.lang==='ar'?'الوضع الليلي':'Dark Mode'}</span><button class="btn btn-outline" id="setting-theme">${state.theme==='dark'?'☀️':'🌙'} ${state.theme==='dark'?(state.lang==='ar'?'وضع نهاري':'Light'):(state.lang==='ar'?'وضع ليلي':'Dark')}</button></div>
        <div class="setting-row"><span>${state.lang==='ar'?'اللغة':'Language'}</span><button class="btn btn-outline" id="setting-lang">${state.lang==='ar'?'English':'عربي'}</button></div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang==='ar'?'حسابي':'My Account'}</h3>
        <div class="setting-row"><span>${t('email')}</span><span class="text-muted">${state.profile?.email}</span></div>
        <div class="setting-row"><span>${state.lang==='ar'?'الدور':'Role'}</span><span class="badge badge-success">${t(state.profile?.role)}</span></div>
      </div>
    </div>
  </div>`;
}

export function attachSettingsEvents(renderApp) {
  document.querySelectorAll('input[name="school-type"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      state.schoolType = e.target.value;
      try { await setDoc(doc(db, 'settings', 'general'), { schoolType: state.schoolType }, { merge: true }); showToast(t('savedSuccess'), 'success'); renderApp(); } catch(e) { showToast(t('errorOccurred'), 'error'); }
    });
  });
  document.getElementById('setting-theme')?.addEventListener('click', () => { import('../state.js').then(m => { m.toggleTheme(); renderApp(); }); });
  document.getElementById('setting-lang')?.addEventListener('click', () => { import('../state.js').then(m => { m.toggleLang(); renderApp(); }); });
}
