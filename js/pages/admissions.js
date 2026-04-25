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

  </div>
  `;
}

export async function attachAdmissionsEvents() {
    await loadApplications();

    // Modal Triggers
    const modal = document.getElementById('application-modal');
    document.getElementById('btn-new-application')?.addEventListener('click', () => {
        document.getElementById('application-form').reset();
        modal.classList.remove('hidden');
    });
    
    const closeBtns = ['close-application-modal', 'cancel-application-modal'];
    closeBtns.forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => modal.classList.add('hidden'));
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

    // Drag and Drop Setup
    setupDragAndDrop();
}

async function loadApplications() {
    try {
        applicationsCache = await admissionsService.getApplications();
        renderKanbanCards();
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
                <div class="card-meta">
                    <span class="badge" style="background:var(--surface2)">${app.appliedGradeLevel}</span>
                    <span class="text-muted text-sm">${dateStr}</span>
                </div>
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
