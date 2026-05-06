import { state } from '../state.js';
import { db, collection, addDoc, doc, setDoc, updateDoc } from '../firebase-config.js';
import { adminCreateUser } from '../auth.js?v=20260506-setup-wizard';
import { showToast, escapeHTML } from '../ui.js';

const setupRef = () => doc(db, 'school_settings', 'general_info');

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

export function renderSetupWizard() {
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
    await addDoc(collection(db, 'classes'), {
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
    await addDoc(collection(db, 'subjects'), {
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
    await setDoc(doc(db, 'teachers', uid), {
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
    await updateDoc(doc(db, 'classes', classId), { teacherId: uid, updatedAt: new Date().toISOString() });
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
