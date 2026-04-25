import { state, t } from '../state.js';
import { db, updateDoc, doc } from '../firebase-config.js';
import { showToast } from '../ui.js';

export function renderAcademicAlerts() {
    const role = state.profile?.role;
    if (role !== 'admin' && role !== 'teacher') {
        return `<div class="page-content"><div class="empty-state glass-card"><h3>${state.lang==='ar'?'غير مصرح':'Unauthorized'}</h3></div></div>`;
    }

    const alerts = state.academicAlerts;

    return `
    <div class="page-content animate-in">
        <div class="page-header">
            <h2>${t('academicAlerts')}</h2>
        </div>
        <div class="alert-stats-grid">
            <div class="stat-card glass-card">
                <span class="stat-value">${alerts.filter(a => a.status === 'Active').length}</span>
                <span class="stat-label">${state.lang==='ar'?'تنبيهات نشطة':'Active Alerts'}</span>
            </div>
            <div class="stat-card glass-card">
                <span class="stat-value">${alerts.filter(a => a.severity === 'critical' && a.status === 'Active').length}</span>
                <span class="stat-label text-danger">${state.lang==='ar'?'حالات حرجة':'Critical Cases'}</span>
            </div>
        </div>
        <div class="table-responsive glass-card" style="margin-top:1.5rem">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>${state.lang==='ar'?'الطالب':'Student'}</th>
                        <th>${state.lang==='ar'?'النوع':'Type'}</th>
                        <th>${state.lang==='ar'?'القيمة':'Value'}</th>
                        <th>${state.lang==='ar'?'الرسالة':'Message'}</th>
                        <th>${state.lang==='ar'?'الخطورة':'Severity'}</th>
                        <th>${state.lang==='ar'?'الحالة':'Status'}</th>
                        <th>${state.lang==='ar'?'إجراءات':'Actions'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${alerts.map(a => {
                        const student = state.students.find(s => s.id === a.studentId);
                        const severityClass = a.severity === 'critical' ? 'danger' : 'warning';
                        return `
                            <tr>
                                <td><strong>${student?.name || '—'}</strong></td>
                                <td><span class="badge badge-outline">${a.type}</span></td>
                                <td>${a.value.toFixed(1)}%</td>
                                <td><small>${a.message}</small></td>
                                <td><span class="badge badge-${severityClass}">${a.severity}</span></td>
                                <td><span class="badge badge-${a.status === 'Active' ? 'primary' : 'success'}">${a.status}</span></td>
                                <td>
                                    ${a.status === 'Active' ? `<button class="btn btn-sm btn-success resolve-alert" data-id="${a.id}">✔️ ${state.lang==='ar'?'حل':'Resolve'}</button>` : ''}
                                </td>
                            </tr>
                        `;
                    }).join('') || `<tr><td colspan="7" class="text-center text-muted">${t('noData')}</td></tr>`}
                </tbody>
            </table>
        </div>
    </div>`;
}

export function attachAcademicAlertsEvents() {
    document.querySelectorAll('.resolve-alert').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await updateDoc(doc(db, 'academic_alerts', btn.dataset.id), { status: 'Resolved', resolvedAt: new Date().toISOString() });
                showToast(state.lang==='ar'?'تم حل التنبيه':'Alert resolved', 'success');
            } catch(e) { showToast(t('errorOccurred'), 'error'); }
        });
    });
}
