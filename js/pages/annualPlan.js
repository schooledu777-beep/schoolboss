import { state, t } from '../state.js';
import { db, collection, addDoc, setDoc, updateDoc, deleteDoc, doc } from '../firebase-config.js';
import { tCol, tDoc } from '../db.js';
import { showModal, closeModal, showConfirm, showToast, escapeHTML } from '../ui.js';
import { recordAudit } from './auditLog.js';

const TERM_DEFS = [
  { id: 'term1', ar: 'الفصل الأول', en: 'Term 1' },
  { id: 'term2', ar: 'الفصل الثاني', en: 'Term 2' }
];

const ASSESSMENT_TYPES = [
  { id: 'quiz1', ar: 'المذاكرة الأولى', en: 'First Quiz', weekRatio: 0.33, badge: 'info' },
  { id: 'midterm', ar: 'الفحص النصفي', en: 'Midterm Exam', weekRatio: 0.5, badge: 'warning' },
  { id: 'quiz2', ar: 'المذاكرة الثانية', en: 'Second Quiz', weekRatio: 0.75, badge: 'info' },
  { id: 'final', ar: 'الفحص النهائي', en: 'Final Exam', weekRatio: 1, badge: 'danger' }
];

function isAr() {
  return state.lang === 'ar';
}

function label(item) {
  return isAr() ? item.ar : item.en;
}

function canManagePlan() {
  return ['admin', 'teacher'].includes(state.profile?.role);
}

function getClassSubjects(cls) {
  const fromSchedules = (state.schedules || [])
    .filter(s => s.classId === cls?.id)
    .map(s => s.subject)
    .filter(Boolean);
  const all = (state.subjects || []).map(s => s.name).filter(Boolean);
  return [...new Set([...fromSchedules, ...all])];
}

function getSelectedClassId() {
  return document.getElementById('ap-class-select')?.value || sessionStorage.getItem('annual-plan-class') || (state.classes || [])[0]?.id || '';
}

function getPlanForClass(classId) {
  return (state.annualPlans || []).find(p => p.classId === classId);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(isAr() ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' });
}

function assessmentWeek(type, weeksCount) {
  return Math.max(1, Math.min(weeksCount, Math.round(weeksCount * type.weekRatio)));
}

function buildTerm(termDef, startDate, weeksCount) {
  const weeks = Array.from({ length: weeksCount }, (_, index) => {
    const week = index + 1;
    return {
      week,
      title: `${isAr() ? 'الأسبوع' : 'Week'} ${week}`,
      startDate: startDate ? addDays(startDate, index * 7) : '',
      endDate: startDate ? addDays(startDate, index * 7 + 4) : '',
      items: [],
      assessments: []
    };
  });

  ASSESSMENT_TYPES.forEach(type => {
    const weekNo = assessmentWeek(type, weeksCount);
    const week = weeks.find(w => w.week === weekNo);
    if (week) {
      week.assessments.push({
        id: `${type.id}-${Date.now()}-${weekNo}`,
        type: type.id,
        title: label(type),
        subject: '',
        notes: ''
      });
    }
  });

  return { id: termDef.id, nameAr: termDef.ar, nameEn: termDef.en, weeks };
}

function buildDefaultPlan(cls, options) {
  const subjects = getClassSubjects(cls);
  const weeksPerTerm = Number(options.weeksPerTerm || 18);
  return {
    classId: cls.id,
    className: cls.name || '',
    academicYear: options.academicYear || '2025-2026',
    subjectQuotas: subjects.map(subject => ({
      subject,
      periodsPerWeek: 4,
      totalLessons: weeksPerTerm * 2 * 4,
      notes: ''
    })),
    terms: [
      buildTerm(TERM_DEFS[0], options.term1Start, weeksPerTerm),
      buildTerm(TERM_DEFS[1], options.term2Start, weeksPerTerm)
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function planStats(plan) {
  const weeks = (plan?.terms || []).reduce((sum, term) => sum + (term.weeks || []).length, 0);
  const items = (plan?.terms || []).reduce((sum, term) => sum + (term.weeks || []).reduce((s, w) => s + (w.items || []).length, 0), 0);
  const assessments = (plan?.terms || []).reduce((sum, term) => sum + (term.weeks || []).reduce((s, w) => s + (w.assessments || []).length, 0), 0);
  const lessons = (plan?.subjectQuotas || []).reduce((sum, q) => sum + Number(q.totalLessons || 0), 0);
  return { weeks, items, assessments, lessons };
}

export function renderAnnualPlan() {
  const classes = state.classes || [];
  const selectedClassId = getSelectedClassId();
  const cls = classes.find(c => c.id === selectedClassId) || classes[0];
  const plan = cls ? getPlanForClass(cls.id) : null;
  const stats = planStats(plan);

  return `
  <div class="page-content animate-in annual-plan-page">
    <div class="page-header">
      <h2>🗺️ ${isAr() ? 'الخطة السنوية' : 'Annual Plan'}</h2>
      <div class="header-actions">
        ${state.profile?.role === 'admin' ? `<button class="btn btn-outline" id="ap-sync-calendar">📅 ${isAr() ? 'ربط التقييمات بالتقويم' : 'Sync Assessments'}</button>` : ''}
        ${canManagePlan() ? `<button class="btn btn-primary" id="ap-generate-plan">✨ ${plan ? (isAr() ? 'إعادة إنشاء' : 'Regenerate') : (isAr() ? 'إنشاء خطة' : 'Create Plan')}</button>` : ''}
      </div>
    </div>

    <div class="filter-bar glass-card">
      <select id="ap-class-select" class="form-select">
        ${classes.map(c => `<option value="${c.id}" ${c.id === cls?.id ? 'selected' : ''}>${escapeHTML(c.name || '')}</option>`).join('')}
      </select>
      <input class="form-input" id="ap-search" placeholder="🔎 ${t('search')}...">
    </div>

    ${!cls ? renderEmpty(isAr() ? 'لا توجد صفوف بعد' : 'No classes found') : !plan ? renderNoPlan(cls) : renderPlanWorkspace(plan, stats)}
  </div>`;
}

function renderEmpty(message) {
  return `<div class="empty-state glass-card"><span class="empty-icon">🗺️</span><h3>${message}</h3></div>`;
}

function renderNoPlan(cls) {
  return `
    <div class="empty-state glass-card">
      <span class="empty-icon">🗺️</span>
      <h3>${isAr() ? `لا توجد خطة سنوية للصف ${escapeHTML(cls.name || '')}` : `No annual plan for ${escapeHTML(cls.name || '')}`}</h3>
      <p class="text-muted">${isAr() ? 'ابدأ بإنشاء خطة مقسمة إلى فصلين وأسابيع ومحطات تقييم.' : 'Create a two-term weekly plan with assessment checkpoints.'}</p>
      ${canManagePlan() ? `<button class="btn btn-primary" id="ap-empty-generate">✨ ${isAr() ? 'إنشاء الخطة الآن' : 'Create now'}</button>` : ''}
    </div>`;
}

function renderPlanWorkspace(plan, stats) {
  const activeTerm = sessionStorage.getItem('annual-plan-term') || 'term1';
  const term = (plan.terms || []).find(t => t.id === activeTerm) || (plan.terms || [])[0];
  return `
    <div class="ap-hero glass-card">
      <div>
        <span class="text-muted text-sm">${isAr() ? 'الصف' : 'Class'}</span>
        <h3>${escapeHTML(plan.className || '')}</h3>
        <p>${isAr() ? 'خطة سنوية مرتبطة بالمواد والصفوف والتقويم المدرسي' : 'Annual plan linked to subjects, classes, and calendar'}</p>
      </div>
      <div class="ap-year">${escapeHTML(plan.academicYear || '')}</div>
    </div>

    <div class="sp-widgets-grid">
      <div class="sp-widget widget-blue"><span class="sp-widget-title">${isAr() ? 'الأسابيع' : 'Weeks'}</span><span class="sp-widget-value">${stats.weeks}</span></div>
      <div class="sp-widget widget-dark"><span class="sp-widget-title">${isAr() ? 'محاور الخطة' : 'Plan Items'}</span><span class="sp-widget-value">${stats.items}</span></div>
      <div class="sp-widget widget-dark"><span class="sp-widget-title">${isAr() ? 'التقييمات' : 'Assessments'}</span><span class="sp-widget-value">${stats.assessments}</span></div>
      <div class="sp-widget widget-dark"><span class="sp-widget-title">${isAr() ? 'نصاب الحصص' : 'Lesson Load'}</span><span class="sp-widget-value">${stats.lessons}</span></div>
    </div>

    <div class="ap-layout">
      <section class="glass-card ap-panel">
        <div class="ap-section-head">
          <h3>${isAr() ? 'نصاب المواد' : 'Subject Quotas'}</h3>
          ${canManagePlan() ? `<button class="btn btn-sm btn-outline" id="ap-add-quota">+ ${isAr() ? 'مادة' : 'Subject'}</button>` : ''}
        </div>
        <div class="ap-quota-list">
          ${(plan.subjectQuotas || []).map(q => renderQuota(q, plan.id)).join('') || `<p class="text-muted">${t('noData')}</p>`}
        </div>
      </section>

      <section class="glass-card ap-panel ap-weeks-panel">
        <div class="ap-term-tabs">
          ${(plan.terms || []).map(t => `<button class="ap-term-tab ${t.id === term?.id ? 'active' : ''}" data-term="${t.id}">${escapeHTML(isAr() ? t.nameAr : t.nameEn)}</button>`).join('')}
        </div>
        <div class="ap-week-grid">
          ${(term?.weeks || []).map(week => renderWeek(plan, term, week)).join('')}
        </div>
      </section>
    </div>`;
}

function renderQuota(q) {
  return `
    <div class="ap-quota-card">
      <div>
        <strong>${escapeHTML(q.subject || '')}</strong>
        <span>${Number(q.periodsPerWeek || 0)} ${isAr() ? 'حصص أسبوعيًا' : 'periods/week'} · ${Number(q.totalLessons || 0)} ${isAr() ? 'حصة سنوية' : 'lessons/year'}</span>
      </div>
      ${canManagePlan() ? `<button class="btn btn-sm btn-outline ap-edit-quota" data-subject="${escapeHTML(q.subject || '')}">✎</button>` : ''}
    </div>`;
}

function renderWeek(plan, term, week) {
  const hasContent = (week.items || []).length || (week.assessments || []).length;
  return `
    <article class="ap-week-card" data-week-search="${escapeHTML([week.title, ...(week.items || []).map(i => `${i.subject} ${i.topic}`), ...(week.assessments || []).map(a => a.title)].join(' ').toLowerCase())}">
      <div class="ap-week-head">
        <div>
          <span>${formatDate(week.startDate)} - ${formatDate(week.endDate)}</span>
          <h4>${escapeHTML(week.title || `${isAr() ? 'الأسبوع' : 'Week'} ${week.week}`)}</h4>
        </div>
        ${canManagePlan() ? `
          <div class="ap-week-actions">
            <button class="btn btn-sm btn-outline ap-add-item" data-term="${term.id}" data-week="${week.week}">+ ${isAr() ? 'محور' : 'Item'}</button>
            <button class="btn btn-sm btn-outline ap-add-assessment" data-term="${term.id}" data-week="${week.week}">📝</button>
          </div>` : ''}
      </div>

      ${(week.assessments || []).map(a => renderAssessment(term.id, week.week, a)).join('')}
      ${(week.items || []).map(item => renderPlanItem(term.id, week.week, item)).join('')}
      ${!hasContent ? `<div class="ap-week-empty">${isAr() ? 'لا توجد محاور لهذا الأسبوع' : 'No plan items this week'}</div>` : ''}
    </article>`;
}

function renderAssessment(termId, weekNo, assessment) {
  const type = ASSESSMENT_TYPES.find(t => t.id === assessment.type);
  return `
    <div class="ap-assessment-row">
      <span class="badge badge-${type?.badge || 'info'}">${escapeHTML(assessment.title || label(type || ASSESSMENT_TYPES[0]))}</span>
      <span>${escapeHTML(assessment.subject || (isAr() ? 'كل المواد' : 'All subjects'))}</span>
      ${canManagePlan() ? `<button class="btn-icon ap-edit-assessment" data-term="${termId}" data-week="${weekNo}" data-id="${assessment.id}">✎</button>` : ''}
    </div>`;
}

function renderPlanItem(termId, weekNo, item) {
  return `
    <div class="ap-item-row">
      <div>
        <span class="badge badge-info">${escapeHTML(item.subject || '')}</span>
        <strong>${escapeHTML(item.topic || '')}</strong>
        ${item.objectives ? `<p>${escapeHTML(item.objectives)}</p>` : ''}
      </div>
      ${canManagePlan() ? `
        <div class="ap-item-actions">
          <button class="btn-icon ap-edit-item" data-term="${termId}" data-week="${weekNo}" data-id="${item.id}">✎</button>
          <button class="btn-icon ap-delete-item" data-term="${termId}" data-week="${weekNo}" data-id="${item.id}">×</button>
        </div>` : ''}
    </div>`;
}

export function attachAnnualPlanEvents() {
  const select = document.getElementById('ap-class-select');
  select?.addEventListener('change', () => {
    sessionStorage.setItem('annual-plan-class', select.value);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  document.getElementById('ap-generate-plan')?.addEventListener('click', showGenerateForm);
  document.getElementById('ap-empty-generate')?.addEventListener('click', showGenerateForm);
  document.getElementById('ap-add-quota')?.addEventListener('click', () => showQuotaForm());
  document.getElementById('ap-sync-calendar')?.addEventListener('click', syncAssessmentsToCalendar);

  document.querySelectorAll('.ap-term-tab').forEach(btn => btn.addEventListener('click', () => {
    sessionStorage.setItem('annual-plan-term', btn.dataset.term);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));

  document.getElementById('ap-search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.ap-week-card').forEach(card => {
      card.style.display = !q || card.dataset.weekSearch.includes(q) || card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.querySelectorAll('.ap-edit-quota').forEach(btn => btn.addEventListener('click', () => {
    const plan = getPlanForClass(getSelectedClassId());
    const quota = (plan?.subjectQuotas || []).find(q => q.subject === btn.dataset.subject);
    showQuotaForm(quota);
  }));
  document.querySelectorAll('.ap-add-item').forEach(btn => btn.addEventListener('click', () => showItemForm(btn.dataset.term, Number(btn.dataset.week))));
  document.querySelectorAll('.ap-edit-item').forEach(btn => btn.addEventListener('click', () => showItemForm(btn.dataset.term, Number(btn.dataset.week), btn.dataset.id)));
  document.querySelectorAll('.ap-delete-item').forEach(btn => btn.addEventListener('click', () => deletePlanItem(btn.dataset.term, Number(btn.dataset.week), btn.dataset.id)));
  document.querySelectorAll('.ap-add-assessment').forEach(btn => btn.addEventListener('click', () => showAssessmentForm(btn.dataset.term, Number(btn.dataset.week))));
  document.querySelectorAll('.ap-edit-assessment').forEach(btn => btn.addEventListener('click', () => showAssessmentForm(btn.dataset.term, Number(btn.dataset.week), btn.dataset.id)));
}

function showGenerateForm() {
  const cls = state.classes.find(c => c.id === getSelectedClassId()) || state.classes[0];
  if (!cls) return;
  const currentYear = new Date().getFullYear();
  showModal(isAr() ? 'إنشاء الخطة السنوية' : 'Create Annual Plan', `
    <form id="ap-generate-form" class="form-grid">
      <div class="form-group"><label>${isAr() ? 'الصف' : 'Class'}</label><input class="form-input" value="${escapeHTML(cls.name || '')}" disabled></div>
      <div class="form-group"><label>${isAr() ? 'العام الدراسي' : 'Academic Year'}</label><input id="apg-year" class="form-input" value="${currentYear}-${currentYear + 1}"></div>
      <div class="form-group"><label>${isAr() ? 'عدد أسابيع كل فصل' : 'Weeks per term'}</label><input id="apg-weeks" class="form-input" type="number" min="8" max="24" value="18"></div>
      <div class="form-group"><label>${isAr() ? 'بداية الفصل الأول' : 'Term 1 start'}</label><input id="apg-term1" class="form-input" type="date"></div>
      <div class="form-group"><label>${isAr() ? 'بداية الفصل الثاني' : 'Term 2 start'}</label><input id="apg-term2" class="form-input" type="date"></div>
      <div class="form-actions full-width"><button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('ap-generate-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const plan = buildDefaultPlan(cls, {
      academicYear: document.getElementById('apg-year').value.trim(),
      weeksPerTerm: Number(document.getElementById('apg-weeks').value || 18),
      term1Start: document.getElementById('apg-term1').value,
      term2Start: document.getElementById('apg-term2').value
    });
    try {
      await setDoc(tDoc('annual_plans',cls.id), plan);
      await recordAudit('create', 'annual_plans', `إنشاء خطة سنوية: ${cls.name}`);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch (err) {
      console.error('[AnnualPlan] generate error:', err);
      showToast(t('errorOccurred'), 'error');
    }
  });
}

async function savePlan(plan) {
  const { id, ...data } = plan;
  await updateDoc(tDoc('annual_plans',id), { ...data, updatedAt: new Date().toISOString() });
}

function showQuotaForm(quota = null) {
  const plan = getPlanForClass(getSelectedClassId());
  if (!plan) return;
  const subjects = getClassSubjects(state.classes.find(c => c.id === plan.classId));
  showModal(quota ? (isAr() ? 'تعديل نصاب المادة' : 'Edit Subject Quota') : (isAr() ? 'إضافة نصاب مادة' : 'Add Subject Quota'), `
    <form id="ap-quota-form" class="form-grid">
      <div class="form-group"><label>${isAr() ? 'المادة' : 'Subject'}</label><input id="apq-subject" class="form-input" list="ap-subjects-list" value="${escapeHTML(quota?.subject || '')}" required ${quota ? 'readonly' : ''}><datalist id="ap-subjects-list">${subjects.map(s => `<option value="${escapeHTML(s)}">`).join('')}</datalist></div>
      <div class="form-group"><label>${isAr() ? 'الحصص أسبوعيًا' : 'Periods per week'}</label><input id="apq-periods" class="form-input" type="number" min="1" value="${quota?.periodsPerWeek || 4}" required></div>
      <div class="form-group full-width"><label>${isAr() ? 'ملاحظات' : 'Notes'}</label><textarea id="apq-notes" class="form-input" rows="3">${escapeHTML(quota?.notes || '')}</textarea></div>
      <div class="form-actions full-width"><button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('ap-quota-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const subject = document.getElementById('apq-subject').value.trim();
    const periodsPerWeek = Number(document.getElementById('apq-periods').value || 0);
    const weeks = (plan.terms || []).reduce((sum, term) => sum + (term.weeks || []).length, 0);
    const nextQuota = { subject, periodsPerWeek, totalLessons: periodsPerWeek * weeks, notes: document.getElementById('apq-notes').value.trim() };
    const next = { ...plan, subjectQuotas: [...(plan.subjectQuotas || []).filter(q => q.subject !== subject), nextQuota] };
    try {
      await savePlan(next);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch { showToast(t('errorOccurred'), 'error'); }
  });
}

function findWeek(plan, termId, weekNo) {
  const term = (plan.terms || []).find(t => t.id === termId);
  return { term, week: (term?.weeks || []).find(w => Number(w.week) === Number(weekNo)) };
}

function showItemForm(termId, weekNo, itemId = null) {
  const plan = getPlanForClass(getSelectedClassId());
  const { week } = findWeek(plan, termId, weekNo);
  const item = (week?.items || []).find(i => i.id === itemId);
  const subjects = (plan.subjectQuotas || []).map(q => q.subject);
  showModal(item ? (isAr() ? 'تعديل محور الأسبوع' : 'Edit Week Item') : (isAr() ? 'إضافة محور أسبوعي' : 'Add Week Item'), `
    <form id="ap-item-form" class="form-grid">
      <div class="form-group"><label>${isAr() ? 'المادة' : 'Subject'}</label><select id="api-subject" class="form-select">${subjects.map(s => `<option value="${escapeHTML(s)}" ${item?.subject === s ? 'selected' : ''}>${escapeHTML(s)}</option>`).join('')}</select></div>
      <div class="form-group"><label>${isAr() ? 'المحور/الدرس' : 'Topic'}</label><input id="api-topic" class="form-input" value="${escapeHTML(item?.topic || '')}" required></div>
      <div class="form-group full-width"><label>${isAr() ? 'الأهداف' : 'Objectives'}</label><textarea id="api-objectives" class="form-input" rows="3">${escapeHTML(item?.objectives || '')}</textarea></div>
      <div class="form-group"><label>${isAr() ? 'المصادر' : 'Resources'}</label><input id="api-resources" class="form-input" value="${escapeHTML(item?.resources || '')}"></div>
      <div class="form-group"><label>${isAr() ? 'ملاحظات' : 'Notes'}</label><input id="api-notes" class="form-input" value="${escapeHTML(item?.notes || '')}"></div>
      <div class="form-actions full-width"><button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('ap-item-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const nextItem = {
      id: item?.id || `item-${Date.now()}`,
      subject: document.getElementById('api-subject').value,
      topic: document.getElementById('api-topic').value.trim(),
      objectives: document.getElementById('api-objectives').value.trim(),
      resources: document.getElementById('api-resources').value.trim(),
      notes: document.getElementById('api-notes').value.trim()
    };
    week.items = [...(week.items || []).filter(i => i.id !== nextItem.id), nextItem];
    try {
      await savePlan(plan);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch { showToast(t('errorOccurred'), 'error'); }
  });
}

function showAssessmentForm(termId, weekNo, assessmentId = null) {
  const plan = getPlanForClass(getSelectedClassId());
  const { week } = findWeek(plan, termId, weekNo);
  const assessment = (week?.assessments || []).find(a => a.id === assessmentId);
  const subjects = ['', ...(plan.subjectQuotas || []).map(q => q.subject)];
  showModal(assessment ? (isAr() ? 'تعديل تقييم' : 'Edit Assessment') : (isAr() ? 'إضافة تقييم' : 'Add Assessment'), `
    <form id="ap-assessment-form" class="form-grid">
      <div class="form-group"><label>${isAr() ? 'نوع التقييم' : 'Assessment Type'}</label><select id="apa-type" class="form-select">${ASSESSMENT_TYPES.map(t => `<option value="${t.id}" ${assessment?.type === t.id ? 'selected' : ''}>${label(t)}</option>`).join('')}</select></div>
      <div class="form-group"><label>${isAr() ? 'المادة' : 'Subject'}</label><select id="apa-subject" class="form-select">${subjects.map(s => `<option value="${escapeHTML(s)}" ${assessment?.subject === s ? 'selected' : ''}>${s ? escapeHTML(s) : (isAr() ? 'كل المواد' : 'All subjects')}</option>`).join('')}</select></div>
      <div class="form-group full-width"><label>${isAr() ? 'ملاحظات' : 'Notes'}</label><textarea id="apa-notes" class="form-input" rows="3">${escapeHTML(assessment?.notes || '')}</textarea></div>
      <div class="form-actions full-width"><button type="button" class="btn btn-outline" onclick="closeModal()">${t('cancel')}</button><button class="btn btn-primary">${t('save')}</button></div>
    </form>`);
  document.getElementById('ap-assessment-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const typeId = document.getElementById('apa-type').value;
    const type = ASSESSMENT_TYPES.find(t => t.id === typeId);
    const nextAssessment = {
      id: assessment?.id || `assessment-${Date.now()}`,
      type: typeId,
      title: label(type),
      subject: document.getElementById('apa-subject').value,
      notes: document.getElementById('apa-notes').value.trim()
    };
    week.assessments = [...(week.assessments || []).filter(a => a.id !== nextAssessment.id), nextAssessment];
    try {
      await savePlan(plan);
      closeModal();
      showToast(t('savedSuccess'), 'success');
    } catch { showToast(t('errorOccurred'), 'error'); }
  });
}

function deletePlanItem(termId, weekNo, itemId) {
  const plan = getPlanForClass(getSelectedClassId());
  const { week } = findWeek(plan, termId, weekNo);
  showConfirm(t('delete'), t('confirmDelete'), async () => {
    week.items = (week.items || []).filter(i => i.id !== itemId);
    try {
      await savePlan(plan);
      closeModal();
      showToast(t('deletedSuccess'), 'success');
    } catch { showToast(t('errorOccurred'), 'error'); }
  }, 'danger');
}

async function syncAssessmentsToCalendar() {
  const plan = getPlanForClass(getSelectedClassId());
  if (!plan) return;
  const assessments = [];
  (plan.terms || []).forEach(term => {
    (term.weeks || []).forEach(week => {
      (week.assessments || []).forEach(a => {
        if (week.startDate) assessments.push({ term, week, assessment: a });
      });
    });
  });
  if (!assessments.length) {
    showToast(isAr() ? 'لا توجد تقييمات بتاريخ محدد للربط' : 'No dated assessments to sync', 'warning');
    return;
  }
  try {
    for (const row of assessments) {
      await addDoc(tCol('calendar_events'), {
        title: `${row.assessment.title} - ${plan.className}${row.assessment.subject ? ` - ${row.assessment.subject}` : ''}`,
        type: 'exam',
        date: row.week.startDate,
        description: `${isAr() ? 'الخطة السنوية' : 'Annual plan'} · ${isAr() ? row.term.nameAr : row.term.nameEn} · ${row.week.title}`,
        classId: plan.classId,
        source: 'annual_plan',
        createdAt: new Date().toISOString()
      });
    }
    await recordAudit('create', 'calendar_events', `ربط تقييمات الخطة السنوية بالتقويم: ${plan.className}`);
    showToast(t('savedSuccess'), 'success');
  } catch (err) {
    console.error('[AnnualPlan] calendar sync error:', err);
    showToast(t('errorOccurred'), 'error');
  }
}
