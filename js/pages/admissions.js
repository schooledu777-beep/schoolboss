import { state, t } from '../state.js';
import { admissionsService } from '../services/admissionsService.js';
import { showToast } from '../ui.js';

let applicationsCache = [];
const STATUSES = ['Inquiry', 'Interview_Scheduled', 'Accepted', 'Waitlisted', 'Rejected', 'Fee_Paid', 'Enrolled'];
const STATUS_LABELS = {
    'Inquiry': { ar: 'استفسار', en: 'Inquiry', color: 'var(--info)' },
    'Interview_Scheduled': { ar: 'مقابلة مجدولة', en: 'Interview Scheduled', color: 'var(--warning)' },
    'Accepted': { ar: 'مقبول', en: 'Accepted', color: 'var(--success)' },
    'Waitlisted': { ar: 'قائمة الانتظار', en: 'Waitlisted', color: 'var(--text3)' },
    'Rejected': { ar: 'مرفوض', en: 'Rejected', color: 'var(--danger)' },
    'Fee_Paid': { ar: 'تم دفع الرسوم', en: 'Fee Paid', color: 'var(--primary)' },
    'Enrolled': { ar: 'مسجل', en: 'Enrolled', color: 'var(--secondary)' }
};

export function renderAdmissions() {
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <div>
        <h2>${state.lang === 'ar' ? 'القبول والتسجيل' : 'Admissions & CRM'}</h2>
        <p class="text-muted">${state.lang === 'ar' ? 'إدارة طلبات الالتحاق ومراحل القبول' : 'Manage enrollment applications and pipeline'}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="btn-new-application">
          <span class="icon">➕</span> ${state.lang === 'ar' ? 'طلب جديد' : 'New Application'}
        </button>
      </div>
    </div>

    <!-- Kanban Board -->
    <div class="kanban-board" id="kanban-board">
        ${STATUSES.map(status => `
            <div class="kanban-column" data-status="${status}" id="col-${status}">
                <div class="kanban-column-header">
                    <h3 style="color: ${STATUS_LABELS[status].color}">${STATUS_LABELS[status][state.lang]}</h3>
                    <span class="kanban-count" id="count-${status}">0</span>
                </div>
                <div class="kanban-dropzone" data-status="${status}">
                    <!-- Cards will be injected here -->
                </div>
            </div>
        `).join('')}
    </div>

    <!-- Add Application Modal -->
    <div class="modal-overlay hidden" id="application-modal">
        <div class="modal glass-card">
            <div class="modal-header">
                <h3>${state.lang === 'ar' ? 'طلب التحاق جديد' : 'New Application'}</h3>
                <button class="btn-icon" id="close-application-modal">✕</button>
            </div>
            <div class="modal-body">
                <form id="application-form" class="form-grid">
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'الاسم الأول (للطالب)' : 'First Name'}</label>
                        <input type="text" id="app-firstname" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'العائلة (للطالب)' : 'Last Name'}</label>
                        <input type="text" id="app-lastname" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                        <input type="date" id="app-dob" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'الصف المطلوب' : 'Applied Grade'}</label>
                        <select id="app-grade" class="form-control" required>
                            <option value="KG1">KG 1</option>
                            <option value="KG2">KG 2</option>
                            <option value="G1">Grade 1</option>
                            <option value="G2">Grade 2</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <h4 style="margin: 1rem 0 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">${state.lang === 'ar' ? 'بيانات ولي الأمر' : 'Parent Contact'}</h4>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'اسم ولي الأمر' : 'Parent Name'}</label>
                        <input type="text" id="app-parent-name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                        <input type="email" id="app-parent-email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                        <input type="tel" id="app-parent-phone" class="form-control" required>
                    </div>
                    <div class="form-group full-width">
                        <label>${state.lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                        <textarea id="app-notes" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="form-actions full-width">
                        <button type="button" class="btn btn-ghost" id="cancel-application-modal">${t('cancel')}</button>
                        <button type="submit" class="btn btn-primary" id="save-application-btn">${t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Documents Modal -->
    <div class="modal-overlay hidden" id="documents-modal">
        <div class="modal glass-card" style="max-width: 600px;">
            <div class="modal-header">
                <h3>${state.lang === 'ar' ? 'المستندات المرفقة' : 'Application Documents'}</h3>
                <button class="btn-icon" id="close-documents-modal">✕</button>
            </div>
            <div class="modal-body">
                <div id="documents-list" style="margin-bottom: 1rem;">
                    <!-- Documents will be loaded here -->
                </div>
                
                <form id="upload-document-form" class="form-grid" style="border-top: 1px solid var(--border); padding-top: 1rem;">
                    <input type="hidden" id="doc-app-id">
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'نوع المستند' : 'Document Type'}</label>
                        <select id="doc-type" class="form-control" required>
                            <option value="birth_certificate">${state.lang === 'ar' ? 'شهادة ميلاد' : 'Birth Certificate'}</option>
                            <option value="transcript">${state.lang === 'ar' ? 'بيان درجات' : 'Transcript'}</option>
                            <option value="medical_record">${state.lang === 'ar' ? 'سجل طبي' : 'Medical Record'}</option>
                            <option value="other">${state.lang === 'ar' ? 'أخرى' : 'Other'}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${state.lang === 'ar' ? 'الملف' : 'File'}</label>
                        <input type="file" id="doc-file" class="form-control" required accept=".pdf,.jpg,.jpeg,.png">
                    </div>
                    <div class="form-actions full-width">
                        <button type="submit" class="btn btn-primary" id="upload-document-btn">${state.lang === 'ar' ? 'رفع المستند' : 'Upload Document'}</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

  </div>
  `;
}

export function attachAdmissionsEvents() {
    loadApplications();

    const modal = document.getElementById('application-modal');
    const docsModal = document.getElementById('documents-modal');

    // Close on overlay click
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
    docsModal?.addEventListener('click', (e) => {
        if (e.target === docsModal) docsModal.classList.add('hidden');
    });

    document.getElementById('btn-new-application')?.addEventListener('click', () => {
        document.getElementById('application-form').reset();
        modal.classList.remove('hidden');
    });
    
    const closeBtns = ['close-application-modal', 'cancel-application-modal'];
    closeBtns.forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => modal.classList.add('hidden'));
    });
    
    document.getElementById('close-documents-modal')?.addEventListener('click', () => {
        docsModal.classList.add('hidden');
    });

    // Form Submission
    document.getElementById('application-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-application-btn');
        btn.disabled = true;
        btn.innerHTML = '<div class="loader-ring" style="width:20px;height:20px;margin:0;border-width:2px;"></div>';

        const data = {
            studentInfo: {
                firstName: document.getElementById('app-firstname').value,
                lastName: document.getElementById('app-lastname').value,
                dateOfBirth: new Date(document.getElementById('app-dob').value),
            },
            parentContact: {
                fullName: document.getElementById('app-parent-name').value,
                email: document.getElementById('app-parent-email').value,
                phoneNumber: document.getElementById('app-parent-phone').value,
            },
            appliedGradeLevel: document.getElementById('app-grade').value,
            notes: document.getElementById('app-notes').value
        };

        try {
            await admissionsService.createApplication(data);
            showToast(state.lang === 'ar' ? 'تم إنشاء الطلب بنجاح' : 'Application created', 'success');
            modal.classList.add('hidden');
            await loadApplications();
        } catch (error) {
            showToast(state.lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving application', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = t('save');
        }
    });

    // Upload Document Form
    document.getElementById('upload-document-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const appId = document.getElementById('doc-app-id').value;
        const fileInput = document.getElementById('doc-file');
        const docType = document.getElementById('doc-type').value;
        
        if (!fileInput.files.length) return;
        const file = fileInput.files[0];

        const btn = document.getElementById('upload-document-btn');
        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="loader-ring" style="width:20px;height:20px;margin:0;border-width:2px;"></div>';

        try {
            await admissionsService.uploadApplicationDocument(appId, file, docType);
            showToast(state.lang === 'ar' ? 'تم رفع المستند بنجاح' : 'Document uploaded successfully', 'success');
            fileInput.value = ''; // Reset file input
            await loadDocuments(appId); // Refresh documents list
        } catch (error) {
            showToast(state.lang === 'ar' ? 'فشل رفع المستند' : 'Failed to upload document', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    });

    // Drag and Drop Setup
    setupDragAndDrop();
}

async function loadDocuments(appId) {
    const listEl = document.getElementById('documents-list');
    listEl.innerHTML = '<div class="text-center"><div class="loader-ring"></div></div>';
    
    try {
        const docs = await admissionsService.getApplicationDocuments(appId);
        if (docs.length === 0) {
            listEl.innerHTML = `<p class="text-muted text-center">${state.lang === 'ar' ? 'لا توجد مستندات مرفقة' : 'No documents attached'}</p>`;
            return;
        }
        
        listEl.innerHTML = docs.map(doc => `
            <div class="glass-card" style="padding: 0.75rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${doc.documentType}</strong><br>
                    <span class="text-muted text-sm">${doc.fileName}</span>
                </div>
                <a href="${doc.fileUrl}" target="_blank" class="btn btn-sm btn-outline">${state.lang === 'ar' ? 'عرض' : 'View'}</a>
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p class="text-danger">${state.lang === 'ar' ? 'حدث خطأ أثناء جلب المستندات' : 'Error fetching documents'}</p>`;
    }
}

async function loadApplications() {
    try {
        applicationsCache = await admissionsService.getApplications();
        // Only render if kanban board is still in the DOM
        if (document.getElementById('kanban-board')) {
            renderKanbanCards();
        }
    } catch (err) {
        console.error(err);
        showToast('Error loading applications', 'error');
    }
}

function renderKanbanCards() {
    // Clear dropzones
    document.querySelectorAll('.kanban-dropzone').forEach(dz => {
        dz.innerHTML = '';
    });

    // Reset counts
    const counts = {};
    STATUSES.forEach(s => counts[s] = 0);

    applicationsCache.forEach(app => {
        const status = app.status;
        counts[status] = (counts[status] || 0) + 1;

        const dz = document.querySelector(`.kanban-dropzone[data-status="${status}"]`);
        if (dz) {
            const dateStr = app.applicationDate?.toDate ? app.applicationDate.toDate().toLocaleDateString() : '';
            const card = document.createElement('div');
            card.className = 'kanban-card glass-card';
            card.draggable = true;
            card.dataset.id = app.id;
            card.innerHTML = `
                <div class="card-title">${app.studentInfo?.firstName} ${app.studentInfo?.lastName}</div>
                <div class="card-meta" style="margin-bottom: 0.5rem;">
                    <span class="badge" style="background:var(--surface2)">${app.appliedGradeLevel}</span>
                    <span class="text-muted text-sm">${dateStr}</span>
                </div>
                <button class="btn btn-sm btn-outline full-width view-docs-btn" data-id="${app.id}" style="font-size: 0.8rem; padding: 0.25rem;">
                    📄 ${state.lang === 'ar' ? 'المستندات' : 'Docs'}
                </button>
            `;
            dz.appendChild(card);
        }
    });

    // Update counts
    STATUSES.forEach(s => {
        const countEl = document.getElementById(`count-${s}`);
        if(countEl) countEl.innerText = counts[s];
    });

    // Reattach drag events to new cards
    setupDragAndDrop();

    // Attach docs button events
    document.querySelectorAll('.view-docs-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const appId = btn.dataset.id;
            const docsModal = document.getElementById('documents-modal');
            document.getElementById('doc-app-id').value = appId;
            docsModal.classList.remove('hidden');
            loadDocuments(appId);
        });
    });
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const dropzones = document.querySelectorAll('.kanban-dropzone');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            document.querySelectorAll('.kanban-dropzone').forEach(dz => dz.classList.remove('drag-over'));
        });
    });

    dropzones.forEach(dz => {
        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('drag-over');
        });

        dz.addEventListener('dragleave', () => {
            dz.classList.remove('drag-over');
        });

        dz.addEventListener('drop', async (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            
            const appId = e.dataTransfer.getData('text/plain');
            const newStatus = dz.dataset.status;
            const card = document.querySelector(`.kanban-card[data-id="${appId}"]`);
            const oldStatus = card.parentElement.dataset.status;

            if (newStatus !== oldStatus && card) {
                // Optimistic UI update
                dz.appendChild(card);
                
                // Update specific counts locally
                const oldCountEl = document.getElementById(`count-${oldStatus}`);
                const newCountEl = document.getElementById(`count-${newStatus}`);
                if(oldCountEl) oldCountEl.innerText = parseInt(oldCountEl.innerText) - 1;
                if(newCountEl) newCountEl.innerText = parseInt(newCountEl.innerText) + 1;

                // Update cache
                const appIndex = applicationsCache.findIndex(a => a.id === appId);
                if (appIndex > -1) applicationsCache[appIndex].status = newStatus;

                try {
                    await admissionsService.transitionApplicationStatus(appId, newStatus);
                } catch (error) {
                    // Revert on failure
                    showToast(state.lang === 'ar' ? 'فشل نقل الطلب' : 'Failed to move application', 'error');
                    loadApplications(); // Reload full state
                }
            }
        });
    });
}
