import { state } from '../state.js';
import { db, collection, addDoc, doc, setDoc, updateDoc } from '../firebase-config.js?v=20260611-tenants2';
import { tCol, tDoc } from '../db.js?v=20260611-tenants2';
import { adminCreateUser } from '../auth.js?v=20260611-tenants2';
import { showToast, escapeHTML } from '../ui.js';
import { validateActivationCode, consumeActivationCode } from '../services/tenantService.js?v=20260611-tenants2';
import { syncService } from '../services/syncService.js?v=20260506-setup-wizard-fix';

const setupRef = () => tDoc('school_settings','general_info');

const steps = [
  {
    id: 1,
    title: 'إعداد الصفوف',
    subtitle: 'ابدأ ببناء الهيكل الأكاديمي حتى تصبح بقية البيانات مرتبطة بشكل صحيح.',
    short: 'الصفوف'
  },
  {
    id: 2,
    title: 'إضافة المواد',
    subtitle: 'أضف المواد الأساسية التي ستستخدم لاحقاً في الجداول وكشوف الدرجات.',
    short: 'المواد'
  },
  {
    id: 3,
    title: 'تعيين المعلمين',
    subtitle: 'أنشئ حسابات المعلمين واربطهم بالمواد والصفوف التي أعددتها.',
    short: 'المعلمون'
  }
];

function currentStep() {
  return Math.min(Math.max(Number(state.setup?.currentStep || 1), 1), 3);
}

function stepReady(step) {
  if (step === 1) return state.classes.length > 0;
  if (step === 2) return state.subjects.length > 0;
  return state.teachers.length > 0;
}

function displayClassName(cls) {
  return cls.name || [cls.grade, cls.section].filter(Boolean).join(' - ') || 'صف بدون اسم';
}

function renderProgress(step) {
  const percent = Math.round((step / 3) * 100);
  return `
    <div class="setup-progress-panel">
      <div class="setup-progress-meta">
        <span>الخطوة ${step} من 3</span>
        <strong>${steps[step - 1].title}</strong>
      </div>
      <div class="setup-progress-track"><span style="width:${percent}%"></span></div>
      <div class="setup-steps">
        ${steps.map(item => `
          <div class="setup-step-dot ${item.id < step ? 'done' : ''} ${item.id === step ? 'active' : ''}">
            <span>${item.id < step ? '✓' : item.id}</span>
            <small>${item.short}</small>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderStepOne() {
  return `
    <section class="setup-card setup-form-card">
      <h3>إنشاء أول صف</h3>
      <p>يمكنك إضافة صف واحد كبداية، ثم إكمال بقية الصفوف من قسم الصفوف لاحقاً.</p>
      <form id="setup-class-form" class="setup-form-grid">
        <div class="form-group">
          <label>المرحلة / الصف</label>
          <input id="setup-class-grade" class="form-input" placeholder="مثال: Grade 1" required>
        </div>
        <div class="form-group">
          <label>الشعبة</label>
          <input id="setup-class-section" class="form-input" placeholder="مثال: A" required>
        </div>
        <div class="form-group setup-wide">
          <label>اسم العرض</label>
          <input id="setup-class-name" class="form-input" placeholder="مثال: Grade 1 - A">
        </div>
        <button class="btn btn-primary setup-submit" type="submit">+ حفظ الصف</button>
      </form>
    </section>
    ${renderExistingList('الصفوف المضافة', state.classes.map(cls => displayClassName(cls)), 'لم تتم إضافة صفوف بعد')}`;
}

function renderStepTwo() {
  return `
    <section class="setup-card setup-form-card">
      <h3>إضافة مادة دراسية</h3>
      <p>المواد ستظهر لاحقاً في ملف المادة، الجداول، وكشوف الدرجات.</p>
      <form id="setup-subject-form" class="setup-form-grid">
        <div class="form-group">
          <label>اسم المادة</label>
          <input id="setup-subject-name" class="form-input" placeholder="مثال: Mathematics" required>
        </div>
        <div class="form-group">
          <label>رمز المادة</label>
          <input id="setup-subject-code" class="form-input" placeholder="مثال: MATH-01">
        </div>
        <div class="form-group setup-wide">
          <label>وصف مختصر</label>
          <textarea id="setup-subject-description" class="form-textarea" rows="3" placeholder="ملاحظات اختيارية عن المادة"></textarea>
        </div>
        <button class="btn btn-primary setup-submit" type="submit">+ حفظ المادة</button>
      </form>
    </section>
    ${renderExistingList('المواد المضافة', state.subjects.map(subject => subject.name || subject.code), 'لم تتم إضافة مواد بعد')}`;
}

function renderStepThree() {
  const password = `Teach${new Date().getFullYear()}!`;
  return `
    <section class="setup-card setup-form-card">
      <h3>إضافة معلم وربطه</h3>
      <p>أنشئ حساباً مبدئياً للمعلم واربطه بالمادة والصف المناسبين.</p>
      <form id="setup-teacher-form" class="setup-form-grid">
        <div class="form-group">
          <label>اسم المعلم</label>
          <input id="setup-teacher-name" class="form-input" required>
        </div>
        <div class="form-group">
          <label>البريد الإلكتروني</label>
          <input id="setup-teacher-email" class="form-input" type="email" required>
        </div>
        <div class="form-group">
          <label>كلمة مرور مؤقتة</label>
          <input id="setup-teacher-password" class="form-input" value="${password}" minlength="6" required>
        </div>
        <div class="form-group">
          <label>الهاتف</label>
          <input id="setup-teacher-phone" class="form-input">
        </div>
        <div class="form-group">
          <label>المادة</label>
          <select id="setup-teacher-subject" class="form-select" required>
            <option value="">اختر مادة</option>
            ${state.subjects.map(subject => `<option value="${escapeHTML(subject.name || subject.code || '')}">${escapeHTML(subject.name || subject.code || '')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>الصف</label>
          <select id="setup-teacher-class" class="form-select" required>
            <option value="">اختر صفاً</option>
            ${state.classes.map(cls => `<option value="${cls.id}">${escapeHTML(displayClassName(cls))}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary setup-submit" type="submit">+ حفظ المعلم</button>
      </form>
    </section>
    ${renderExistingList('المعلمون المضافون', state.teachers.map(teacher => teacher.name || teacher.email), 'لم تتم إضافة معلمين بعد')}`;
}

function renderExistingList(title, items, emptyText) {
  return `
    <aside class="setup-card setup-existing-card">
      <div class="setup-existing-head">
        <h3>${title}</h3>
        <span>${items.length}</span>
      </div>
      <div class="setup-existing-list">
        ${items.length ? items.slice(0, 8).map(item => `<div class="setup-existing-item">${escapeHTML(item)}</div>`).join('') : `<div class="setup-empty">${emptyText}</div>`}
      </div>
    </aside>`;
}

function renderStepContent(step) {
  if (step === 1) return renderStepOne();
  if (step === 2) return renderStepTwo();
  return renderStepThree();
}

// ── Activation-code gate — shown before the wizard if tenantId not yet set ───
function renderActivationGate() {
  const isAr = state.lang === 'ar';
  return `
  <div class="setup-wizard-page" dir="${isAr ? 'rtl' : 'ltr'}">
    <div class="setup-hero">
      <div class="setup-brand">
        <img src="assets/edumanage-mark.svg" alt="EduManage Pro">
        <span>EduManage Pro</span>
      </div>
    </div>
    <div class="setup-body" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div class="glass-card" style="width:100%;max-width:460px;padding:2.5rem;text-align:center">
        <div style="font-size:3.5rem;margin-bottom:1rem">🔑</div>
        <h2 style="margin-bottom:.5rem">${isAr ? 'أدخل كود التفعيل' : 'Enter Activation Code'}</h2>
        <p class="text-muted" style="margin-bottom:2rem;font-size:.9rem">
          ${isAr
            ? 'للبدء في استخدام النظام تحتاج إلى كود تفعيل. تواصل مع فريق المبيعات للحصول عليه.'
            : 'You need an activation code to start. Contact the sales team to get yours.'}
        </p>
        <form id="activation-form">
          <div class="form-group" style="margin-bottom:1.25rem">
            <input
              type="text" id="activation-code-input" class="form-input"
              placeholder="XXXX-XXXX-XXXX"
              style="text-align:center;font-size:1.3rem;letter-spacing:.15em;text-transform:uppercase"
              maxlength="14" autocomplete="off" required>
          </div>
          <div class="form-group" style="margin-bottom:1.5rem">
            <input type="text" id="activation-school-name" class="form-input"
              placeholder="${isAr ? 'اسم مدرستك' : 'Your school name'}" required>
          </div>
          <div id="activation-error" class="alert alert-danger hidden" style="margin-bottom:1rem"></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="activation-submit-btn">
            ${isAr ? '✅ تفعيل النظام' : '✅ Activate System'}
          </button>
        </form>
      </div>
    </div>
  </div>`;
}

export function renderSetupWizard() {
  // Super admin: no activation gate needed
  // Regular admin without tenantId: show activation gate first
  if (!state.isSuperAdmin && !state.tenantId) {
    return renderActivationGate();
  }

  const step = currentStep();
  const ready = stepReady(step);
  return `
    <div class="setup-wizard-page" dir="rtl">
      <div class="setup-hero">
        <div class="setup-brand">
          <img src="assets/edumanage-mark.svg" alt="EduManage Pro">
          <span>EduManage Pro</span>
        </div>
        <h1>لنجهز مدرستك في 3 خطوات بسيطة</h1>
        <p>هذا المعالج يمنع أخطاء الربط لاحقاً عبر ترتيب البيانات الأساسية: الصفوف ثم المواد ثم المعلمون.</p>
      </div>
      <div class="setup-shell">
        ${renderProgress(step)}
        <div class="setup-step-header">
          <div>
            <span>إعداد أولي</span>
            <h2>${steps[step - 1].title}</h2>
            <p>${steps[step - 1].subtitle}</p>
          </div>
        </div>
        <div class="setup-grid">
          ${renderStepContent(step)}
        </div>
        <div class="setup-actions">
          <button class="btn btn-outline" id="setup-back-btn" ${step === 1 ? 'disabled' : ''}>السابق</button>
          <button class="btn btn-primary" id="setup-next-btn" ${ready ? '' : 'disabled'}>
            ${step === 3 ? 'إنهاء الإعداد وفتح لوحة التحكم' : 'التالي'}
          </button>
        </div>
      </div>
    </div>`;
}

async function updateSetup(nextStep, completed = false) {
  const payload = {
    current_step: nextStep,
    total_steps: 3,
    setup_completed: completed,
    completed_by_wizard: completed,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  await setDoc(setupRef(), payload, { merge: true });
  state.setup = {
    completed,
    currentStep: nextStep,
    totalSteps: 3,
    loading: false
  };
}

function refreshWizard() {
  state.notify();
}

async function handleClassSubmit(event) {
  event.preventDefault();
  const grade = document.getElementById('setup-class-grade')?.value.trim();
  const section = document.getElementById('setup-class-section')?.value.trim();
  const explicitName = document.getElementById('setup-class-name')?.value.trim();
  if (!grade || !section) return;

  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await addDoc(tCol('classes'), {
      name: explicitName || `${grade} - ${section}`,
      grade,
      section,
      teacherId: '',
      studentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    event.target.reset();
    showToast('تم حفظ الصف بنجاح', 'success');
  } catch (error) {
    console.error(error);
    showToast('تعذر حفظ الصف', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleSubjectSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('setup-subject-name')?.value.trim();
  const code = document.getElementById('setup-subject-code')?.value.trim();
  const description = document.getElementById('setup-subject-description')?.value.trim();
  if (!name) return;

  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await addDoc(tCol('subjects'), {
      name,
      code,
      description,
      isOnline: false,
      materials: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    event.target.reset();
    showToast('تم حفظ المادة بنجاح', 'success');
  } catch (error) {
    console.error(error);
    showToast('تعذر حفظ المادة', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleTeacherSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('setup-teacher-name')?.value.trim();
  const email = document.getElementById('setup-teacher-email')?.value.trim();
  const password = document.getElementById('setup-teacher-password')?.value;
  const phone = document.getElementById('setup-teacher-phone')?.value.trim();
  const subject = document.getElementById('setup-teacher-subject')?.value;
  const classId = document.getElementById('setup-teacher-class')?.value;
  if (!name || !email || !password || !subject || !classId) return;

  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const uid = await adminCreateUser(email, password, 'teacher', name);
    await setDoc(tDoc('teachers',uid), {
      id: uid,
      uid,
      name,
      email,
      phone,
      subjects: [subject],
      role: 'teacher',
      accountStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authManaged: {
        temporaryPassword: password,
        passwordUpdatedAt: new Date().toISOString(),
        passwordSource: 'setup-wizard',
        mustChange: true
      }
    }, { merge: true });
    await updateDoc(tDoc('classes',classId), { teacherId: uid, updatedAt: new Date().toISOString() });
    event.target.reset();
    showToast('تم حفظ المعلم وربطه بالصف', 'success');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'تعذر حفظ المعلم', 'error');
  } finally {
    btn.disabled = false;
  }
}

export function attachSetupWizardEvents() {
  // ── Activation code gate ─────────────────────────────────────────
  const activationForm = document.getElementById('activation-form');
  if (activationForm) {
    activationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn      = document.getElementById('activation-submit-btn');
      const errBox   = document.getElementById('activation-error');
      const rawCode  = document.getElementById('activation-code-input').value.trim().toUpperCase();
      const school   = document.getElementById('activation-school-name').value.trim();
      const isAr     = state.lang === 'ar';

      errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-sm"></span>';

      try {
        const result = await validateActivationCode(rawCode);
        if (!result.valid) {
          errBox.textContent = result.error;
          errBox.classList.remove('hidden');
          return;
        }

        // Consume code → creates tenant + assigns tenantId
        const tenantId = await consumeActivationCode(
          result.code, state.user.uid, state.user.email, school
        );

        // Patch user profile in Firestore
        const { db } = await import('../db.js?v=20260611-tenants2');
        const { doc, setDoc } = await import('../firebase-config.js?v=20260611-tenants2');
        await setDoc(doc(db, 'users', state.user.uid), {
          tenantId,
          role: 'admin',
          accountStatus: 'active'
        }, { merge: true });

        // Update local state so tCol/tDoc starts working immediately
        state.tenantId = tenantId;
        state.tenant = {
          id: tenantId,
          name: school,
          plan: result.data.plan || 'pro',
          maxStudents: Number(result.data.maxStudents || 500),
          status: 'active'
        };
        if (state.profile) {
          state.profile.tenantId = tenantId;
          state.profile.role = 'admin';
        }

        // Restart all Firestore listeners with the new tenantId
        syncService.restart('setup-wizard');

        showToast(isAr ? '🎉 تم التفعيل بنجاح! ابدأ الإعداد' : '🎉 Activated! Start setup', 'success');

        // Re-render wizard (now tenantId is set → shows step 1)
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          const { renderSetupWizard, attachSetupWizardEvents } = await import('./setupWizard.js?v=20260611-tenants2');
          mainContent.innerHTML = renderSetupWizard();
          attachSetupWizardEvents();
        }
      } catch(err) {
        console.error('[Activation]', err);
        errBox.textContent = err.message || (isAr ? 'حدث خطأ' : 'Error occurred');
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = isAr ? '✅ تفعيل النظام' : '✅ Activate System';
      }
    });
    return; // Don't attach wizard step events when showing the gate
  }
  // ─────────────────────────────────────────────────────────────────

  document.getElementById('setup-class-form')?.addEventListener('submit', handleClassSubmit);
  document.getElementById('setup-subject-form')?.addEventListener('submit', handleSubjectSubmit);
  document.getElementById('setup-teacher-form')?.addEventListener('submit', handleTeacherSubmit);

  document.getElementById('setup-back-btn')?.addEventListener('click', async () => {
    const step = currentStep();
    if (step <= 1) return;
    await updateSetup(step - 1, false);
    refreshWizard();
  });

  document.getElementById('setup-next-btn')?.addEventListener('click', async () => {
    const step = currentStep();
    if (!stepReady(step)) return;
    if (step >= 3) {
      await updateSetup(4, true);
      showToast('تم إنهاء الإعداد بنجاح', 'success');
      window.location.hash = 'dashboard';
      window.location.reload();
      return;
    }
    await updateSetup(step + 1, false);
    refreshWizard();
  });
}
