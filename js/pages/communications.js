import { state, t } from '../state.js';
import { db, collection, addDoc, deleteDoc, doc, setDoc, updateDoc, writeBatch, getDocs } from '../firebase-config.js';
import { showModal, closeModal, showConfirm, showToast, formatDate, escapeHTML } from '../ui.js';
import { buildFieldKey } from '../services/customFields.js?v=20260506-custom-fields';

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
function renderCustomFieldsSettingsCard() {
  const isAr = state.lang === 'ar';
  const fields = (state.customFieldsSchema || []).filter(field => field.is_active !== false);
  const typeLabels = {
    text: isAr ? 'نص' : 'Text',
    number: isAr ? 'رقم' : 'Number',
    boolean: isAr ? 'نعم / لا' : 'Yes / No',
    date: isAr ? 'تاريخ' : 'Date',
    dropdown: isAr ? 'قائمة خيارات' : 'Dropdown'
  };
  const targetLabels = {
    student: isAr ? 'الطلاب' : 'Students',
    teacher: isAr ? 'المعلمون' : 'Teachers',
    clinic: isAr ? 'العيادة' : 'Clinic'
  };

  return `
    <div class="card glass-card custom-fields-admin-card">
      <div class="custom-fields-admin-head">
        <div>
          <h3 class="card-title">${isAr ? 'الحقول المخصصة' : 'Custom Fields'}</h3>
          <p class="text-muted">${isAr ? 'أضف حقولاً مرنة تظهر داخل نماذج الطلاب أو المعلمين أو العيادة.' : 'Create flexible fields for students, teachers, or clinic records.'}</p>
        </div>
        <button class="btn btn-primary" id="add-custom-field-btn">+ ${isAr ? 'حقل جديد' : 'New Field'}</button>
      </div>
      <div class="custom-fields-admin-list">
        ${fields.map(field => `
          <div class="custom-field-admin-row">
            <div>
              <strong>${escapeHTML(field.field_label || field.field_key)}</strong>
              <span>${escapeHTML(field.field_key)} · ${targetLabels[field.target_entity] || field.target_entity} · ${typeLabels[field.field_type] || field.field_type}</span>
            </div>
            <div class="custom-field-admin-actions">
              ${field.is_required ? `<span class="badge badge-warning">${isAr ? 'إلزامي' : 'Required'}</span>` : ''}
              <button class="btn btn-sm btn-danger remove-custom-field" data-id="${field.id}">${isAr ? 'إخفاء' : 'Hide'}</button>
            </div>
          </div>
        `).join('') || `<div class="empty-state compact"><span class="empty-icon">🧩</span><h3>${isAr ? 'لا توجد حقول مخصصة بعد' : 'No custom fields yet'}</h3></div>`}
      </div>
    </div>`;
}

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
        <h3 class="card-title">${state.lang==='ar'?'الأنظمة (Modules)':'Modules'}</h3>
        <p class="text-muted" style="margin-bottom:1rem">${state.lang==='ar'?'تفعيل وتعطيل الأنظمة الفرعية':'Enable/Disable sub-systems'}</p>
        <div class="modules-grid">
          ${Object.keys(state.modules || {}).map(modKey => `
            <div class="setting-row">
              <span>${modKey}</span>
              <label class="switch">
                <input type="checkbox" class="module-toggle" data-module="${modKey}" ${state.modules[modKey].enabled ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
      ${renderCustomFieldsSettingsCard()}
      <div class="card glass-card">
        <h3 class="card-title">${state.lang==='ar'?'حسابي':'My Account'}</h3>
        <div class="setting-row"><span>${t('email')}</span><span class="text-muted">${state.profile?.email}</span></div>
        <div class="setting-row"><span>${state.lang==='ar'?'الدور':'Role'}</span><span class="badge badge-success">${t(state.profile?.role)}</span></div>
      </div>
      <div class="card glass-card border-danger">
        <h3 class="card-title text-danger">${state.lang==='ar'?'صيانة النظام':'System Maintenance'}</h3>
        <p class="text-muted" style="margin-bottom:1rem">${state.lang==='ar'?'مسح كافة البيانات المسجلة (الطلاب، المعلمين، الحصص، إلخ) للبدء من جديد.':'Clear all registered data (students, teachers, classes, etc.) to start fresh.'}</p>
        <button class="btn btn-danger full-width" id="clear-data-btn">⚠️ ${state.lang==='ar'?'مسح كافة البيانات':'Clear All Data'}</button>
      </div>
    </div>
  </div>`;
}

export function attachSettingsEvents(renderApp) {
  document.getElementById('add-custom-field-btn')?.addEventListener('click', () => showCustomFieldModal());

  document.querySelectorAll('.remove-custom-field').forEach(btn => {
    btn.addEventListener('click', () => {
      const isAr = state.lang === 'ar';
      showConfirm(
        isAr ? 'إخفاء الحقل المخصص' : 'Hide custom field',
        isAr ? 'سيتم إخفاء الحقل من النماذج الجديدة مع الحفاظ على البيانات القديمة داخل سجلات الطلاب.' : 'The field will be hidden from new forms while old saved values remain archived.',
        async () => {
          try {
            await updateDoc(doc(db, 'custom_fields_schema', btn.dataset.id), {
              is_active: false,
              updated_at: new Date().toISOString()
            });
            showToast(t('savedSuccess'), 'success');
            renderApp();
          } catch (error) {
            console.error(error);
            showToast(t('errorOccurred'), 'error');
          }
        }
      );
    });
  });

  document.getElementById('clear-data-btn')?.addEventListener('click', async () => {
    const isAr = state.lang === 'ar';
    showConfirm(
      isAr ? 'مسح كافة البيانات' : 'Clear All Data',
      isAr ? 'سيتم حذف كافة الطلاب والمعلمين والصفوف والبيانات الأخرى نهائياً. هل أنت متأكد؟ (سيتم استثناء حسابك الحالي)' : 'All students, teachers, classes, and other data will be permanently deleted. Are you sure? (Your account will be preserved)',
      async () => {
        try {
          showToast(isAr ? 'جاري مسح البيانات...' : 'Clearing data...', 'info');
          const collectionsToClear = [
            'students', 'teachers', 'parents', 'classes', 'subjects', 
            'attendance', 'grades', 'schedules', 'fees', 'announcements', 
            'messages', 'homework', 'rewards', 'transfers', 'academic_alerts', 
            'salary_slips', 'leaves'
          ];
          
          for (const collName of collectionsToClear) {
            const snapshot = await getDocs(collection(db, collName));
            if (snapshot.empty) continue;
            
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
              if (collName === 'teachers' || collName === 'parents') {
                if (d.data().email === state.profile?.email) return;
              }
              batch.delete(d.ref);
            });
            await batch.commit();
          }
          
          showToast(isAr ? 'تم مسح البيانات بنجاح' : 'Data cleared successfully', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          console.error(err);
          showToast(isAr ? 'حدث خطأ أثناء المسح' : 'Error clearing data', 'error');
        }
      }
    );
  });

  document.querySelectorAll('.module-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const modKey = e.target.dataset.module;
      const isEnabled = e.target.checked;
      state.modules[modKey].enabled = isEnabled;
      try {
        await setDoc(doc(db, 'settings', 'modules'), state.modules, { merge: true });
        showToast(t('savedSuccess'), 'success');
        renderApp();
      } catch(err) {
        e.target.checked = !isEnabled;
        state.modules[modKey].enabled = !isEnabled;
        showToast(t('errorOccurred'), 'error');
      }
    });
  });
  document.querySelectorAll('input[name="school-type"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      state.schoolType = e.target.value;
      try { await setDoc(doc(db, 'settings', 'general'), { schoolType: state.schoolType }, { merge: true }); showToast(t('savedSuccess'), 'success'); renderApp(); } catch(e) { showToast(t('errorOccurred'), 'error'); }
    });
  });
  document.getElementById('setting-theme')?.addEventListener('click', () => { import('../state.js').then(m => { m.toggleTheme(); renderApp(); }); });
  document.getElementById('setting-lang')?.addEventListener('click', () => { import('../state.js').then(m => { m.toggleLang(); renderApp(); }); });
}

function showCustomFieldModal() {
  const isAr = state.lang === 'ar';
  showModal(isAr ? 'إضافة حقل مخصص' : 'Add Custom Field', `
    <form id="custom-field-form" class="form-grid">
      <div class="form-group">
        <label>${isAr ? 'مكان ظهور الحقل' : 'Target Entity'}</label>
        <select id="cf-target" class="form-select" required>
          <option value="student">${isAr ? 'بطاقة الطالب' : 'Student'}</option>
          <option value="teacher">${isAr ? 'بطاقة المعلم' : 'Teacher'}</option>
          <option value="clinic">${isAr ? 'العيادة' : 'Clinic'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'نوع الحقل' : 'Field Type'}</label>
        <select id="cf-type" class="form-select" required>
          <option value="text">${isAr ? 'نص' : 'Text'}</option>
          <option value="number">${isAr ? 'رقم' : 'Number'}</option>
          <option value="boolean">${isAr ? 'نعم / لا' : 'Yes / No'}</option>
          <option value="date">${isAr ? 'تاريخ' : 'Date'}</option>
          <option value="dropdown">${isAr ? 'قائمة خيارات' : 'Dropdown'}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${isAr ? 'اسم الحقل' : 'Field Label'}</label>
        <input id="cf-label" class="form-input" placeholder="${isAr ? 'مثال: الحساسية الطبية' : 'Example: Medical allergy'}" required>
      </div>
      <div class="form-group">
        <label>${isAr ? 'المعرف البرمجي' : 'Field Key'}</label>
        <input id="cf-key" class="form-input" placeholder="medical_allergy" required>
      </div>
      <div class="form-group full-width hidden" id="cf-options-wrap">
        <label>${isAr ? 'خيارات القائمة' : 'Dropdown Options'}</label>
        <input id="cf-options" class="form-input" placeholder="${isAr ? 'افصل الخيارات بفاصلة: نعم, لا, متابعة' : 'Separate options with commas'}">
      </div>
      <label class="custom-checkbox-field full-width">
        <input id="cf-required" type="checkbox">
        <span>${isAr ? 'هذا الحقل إلزامي' : 'This field is required'}</span>
      </label>
      <div class="custom-field-preview full-width" id="cf-preview"></div>
      <div class="form-actions" style="grid-column: 1 / -1;">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-close-x').click()">${t('cancel')}</button>
        <button type="submit" class="btn btn-primary">${t('save')}</button>
      </div>
    </form>`);

  const labelInput = document.getElementById('cf-label');
  const keyInput = document.getElementById('cf-key');
  const typeInput = document.getElementById('cf-type');
  const optionsWrap = document.getElementById('cf-options-wrap');
  const optionsInput = document.getElementById('cf-options');
  const preview = document.getElementById('cf-preview');

  function updatePreview() {
    const type = typeInput.value;
    const label = labelInput.value.trim() || (isAr ? 'اسم الحقل' : 'Field label');
    optionsWrap.classList.toggle('hidden', type !== 'dropdown');
    if (!keyInput.dataset.touched) keyInput.value = buildFieldKey(labelInput.value);
    const options = optionsInput.value.split(',').map(item => item.trim()).filter(Boolean);
    preview.innerHTML = `
      <div class="custom-field-preview-title">${isAr ? 'معاينة' : 'Preview'}</div>
      ${type === 'dropdown'
        ? `<select class="form-select"><option>${escapeHTML(options[0] || (isAr ? 'اختر...' : 'Select...'))}</option></select>`
        : type === 'boolean'
          ? `<label class="custom-checkbox-field"><input type="checkbox"><span>${escapeHTML(label)}</span></label>`
          : `<input class="form-input" type="${type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}" placeholder="${escapeHTML(label)}">`
      }`;
  }

  labelInput?.addEventListener('input', updatePreview);
  keyInput?.addEventListener('input', () => { keyInput.dataset.touched = '1'; });
  typeInput?.addEventListener('change', updatePreview);
  optionsInput?.addEventListener('input', updatePreview);
  updatePreview();

  document.getElementById('custom-field-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = labelInput.value.trim();
    const fieldKey = buildFieldKey(keyInput.value || label);
    const fieldType = typeInput.value;
    const options = optionsInput.value.split(',').map(item => item.trim()).filter(Boolean);
    if (fieldType === 'dropdown' && !options.length) {
      showToast(isAr ? 'أضف خياراً واحداً على الأقل للقائمة' : 'Add at least one dropdown option', 'error');
      return;
    }

    const duplicate = (state.customFieldsSchema || []).some(field =>
      field.is_active !== false &&
      field.target_entity === document.getElementById('cf-target').value &&
      field.field_key === fieldKey
    );
    if (duplicate) {
      showToast(isAr ? 'يوجد حقل بنفس المعرف لهذا القسم' : 'A field with this key already exists for this target', 'error');
      return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await addDoc(collection(db, 'custom_fields_schema'), {
        target_entity: document.getElementById('cf-target').value,
        field_label: label,
        field_key: fieldKey,
        field_type: fieldType,
        options: fieldType === 'dropdown' ? options : [],
        is_required: document.getElementById('cf-required').checked,
        is_active: true,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (error) {
      console.error(error);
      showToast(t('errorOccurred'), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}
