import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc, firebaseConfig, initializeApp, getAuth, updatePassword, sendPasswordResetEmail } from './firebase-config.js?v=20260503-admin-accounts';
import { state, t } from './state.js';
import { showToast, hideLoading } from './ui.js';

// ⚠️  بدلاً من مقارنة الإيميل مباشرة، نستخدم Firestore كمصدر الحقيقة.
// المدير الأول يُعرَّف هنا مؤقتاً للـ bootstrap فقط — لا تغيّره في الكود.
const BOOTSTRAP_ADMIN_EMAIL = 'mohammed.soft7@gmail.com';
// دالة مساعدة تُبقي التوافق مع الكود القديم الذي يستخدم ADMIN_EMAIL
const ADMIN_EMAIL = BOOTSTRAP_ADMIN_EMAIL;

const SETUP_DEFAULTS = {
  setup_completed: false,
  current_step: 1,
  total_steps: 3,
  completed_by_wizard: false
};

// ─── Secondary App Singleton (يمنع تسرب instances) ──────────────────────────
let _secondaryApp = null;
let _secondaryAuth = null;

function getSecondaryAuth() {
  if (!_secondaryApp) {
    _secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
    _secondaryAuth = getAuth(_secondaryApp);
  }
  return _secondaryAuth;
}

async function getFirstSetupStep() {
  try {
    const [classesSnap, subjectsSnap, teachersSnap] = await Promise.all([
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'teachers'))
    ]);
    if (classesSnap.empty) return 1;
    if (subjectsSnap.empty) return 2;
    if (teachersSnap.empty) return 3;
    return 3;
  } catch (error) {
    console.warn('[Setup] Failed to inspect setup step:', error);
    return 1;
  }
}

async function loadSetupStatus() {
  const ref = doc(db, 'school_settings', 'general_info');
  const snap = await getDoc(ref);
  let data = snap.exists() ? snap.data() : null;

  if (!data && state.profile?.role === 'admin') {
    const firstStep = await getFirstSetupStep();
    data = {
      ...SETUP_DEFAULTS,
      setup_completed: false,
      current_step: firstStep,
      initialized_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await setDoc(ref, data, { merge: true });
  }

  if (data && state.profile?.role === 'admin' && data.setup_completed === true && data.completed_by_wizard !== true) {
    data = {
      ...data,
      setup_completed: false,
      current_step: await getFirstSetupStep(),
      completed_by_wizard: false,
      updated_at: new Date().toISOString()
    };
    await setDoc(ref, data, { merge: true });
  }

  state.setup = {
    completed: data?.setup_completed !== false,
    currentStep: Number(data?.current_step || 1),
    totalSteps: Number(data?.total_steps || 3),
    loading: false
  };
}

export function renderAuthPage() {
  return `
  <div class="auth-page">
    <div class="auth-bg-shapes">
      <div class="shape shape-1"></div><div class="shape shape-2"></div><div class="shape shape-3"></div>
      <img class="auth-doodles" src="assets/education-doodles.svg" alt="">
    </div>
    <div class="auth-card glass-card">
      <div class="auth-logo">
        <div class="logo-icon"><img src="assets/edumanage-mark.svg" alt="EduManage Pro"></div>
        <h1 class="auth-title">EduManage Pro</h1>
        <p class="auth-subtitle">${t('appSubtitle')}</p>
      </div>
      <form id="auth-form" class="auth-form">
        <div id="name-field" class="form-group hidden">
          <label>${t('fullName')}</label>
          <input type="text" id="auth-name" class="form-input" placeholder="${state.lang === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'}">
        </div>
        <div class="form-group">
          <label>${t('email')}</label>
          <input type="email" id="auth-email" class="form-input" placeholder="${state.lang === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}" required>
        </div>
        <div class="form-group">
          <label>${t('password')}</label>
          <div class="password-wrapper">
            <input type="password" id="auth-password" class="form-input" placeholder="${state.lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}" required minlength="6">
            <button type="button" class="password-toggle" id="toggle-password">👁</button>
          </div>
        </div>
        <div id="auth-error" class="alert alert-danger hidden"></div>
        <button type="submit" class="btn btn-primary btn-block" id="auth-submit-btn">
          <span id="auth-btn-text">${t('login')}</span>
        </button>
      </form>


    </div>
  </div>`;
}

export function attachAuthEvents() {
  let isRegister = false;

  document.getElementById('auth-toggle-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    isRegister = !isRegister;
    document.getElementById('name-field').classList.toggle('hidden', !isRegister);
    document.getElementById('auth-btn-text').textContent = isRegister ? t('register') : t('login');
    document.getElementById('auth-toggle-text').textContent = isRegister ? t('hasAccount') : t('noAccount');
    document.getElementById('auth-toggle-link').textContent = isRegister ? t('loginNow') : t('registerNow');
  });

  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const pw = document.getElementById('auth-password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name')?.value.trim();
    const errBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');
    
    errBox.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        if (name && auth.currentUser) {
          // Name will be saved in onAuthStateChanged
          state._pendingName = name;
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      errBox.textContent = getAuthError(err.code);
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = `<span>${isRegister ? t('register') : t('login')}</span>`;
    }
  });


}

function getAuthError(code) {
  const errors = {
    'auth/email-already-in-use': state.lang === 'ar' ? 'البريد مستخدم بالفعل' : 'Email already in use',
    'auth/invalid-email': state.lang === 'ar' ? 'بريد إلكتروني غير صالح' : 'Invalid email',
    'auth/wrong-password': state.lang === 'ar' ? 'كلمة المرور خاطئة' : 'Wrong password',
    'auth/user-not-found': state.lang === 'ar' ? 'المستخدم غير موجود' : 'User not found',
    'auth/weak-password': state.lang === 'ar' ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)' : 'Weak password (min 6 chars)',
    'auth/invalid-credential': state.lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials',
  };
  return errors[code] || (state.lang === 'ar' ? 'حدث خطأ في المصادقة' : 'Authentication error');
}

export function initAuth(onLogin, onLogout) {
  let resolved = false;
  const timeout = setTimeout(() => {
    if (!resolved) {
      console.warn("Auth initialization timed out after 8s. Forcing login screen.");
      hideLoading();
      onLogout();
    }
  }, 8000);

  onAuthStateChanged(auth, async (user) => {
    resolved = true;
    clearTimeout(timeout);
    
    if (user) {
      state.user = user;
      try {
        // Check if user has a profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          state.profile = userDoc.data();
          state.profile.uid = user.uid;
        } else {
          // Check if admin pre-created a profile with same email
          let existingProfile = null;
          let existingDocId = null;
          if (user.email) {
            const emailQ = query(collection(db, 'users'), where('email', '==', user.email));
            const snap = await getDocs(emailQ);
            if (!snap.empty) {
              existingProfile = snap.docs[0].data();
              existingDocId = snap.docs[0].id;
            }
          }
          const profile = existingProfile ? {
            ...existingProfile, uid: user.uid,
            name: existingProfile.name || user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL || existingProfile.avatar || ''
          } : {
            uid: user.uid,
            name: state._pendingName || user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: user.email === ADMIN_EMAIL ? 'admin' : 'student',
            avatar: user.photoURL || '',
            phone: '', createdAt: new Date().toISOString()
          };
          delete state._pendingName;
          await setDoc(doc(db, 'users', user.uid), profile);
          if (existingDocId && existingDocId !== user.uid) {
            try { await deleteDoc(doc(db, 'users', existingDocId)); } catch(e) {}
          }
          state.profile = profile;
        }
        if (state.profile?.accountStatus === 'suspended') {
          showToast(state.lang === 'ar' ? 'تم إيقاف هذا الحساب من قبل الإدارة' : 'This account has been suspended by admin', 'error', 5000);
          await signOut(auth);
          return;
        }
        // Load school settings
        try {
          const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
          if (settingsDoc.exists()) state.schoolType = settingsDoc.data().schoolType || 'private';

          const modulesDoc = await getDoc(doc(db, 'settings', 'modules'));
          if (modulesDoc.exists()) state.modules = { ...state.modules, ...modulesDoc.data() };

          const customFieldsDoc = await getDoc(doc(db, 'settings', 'custom_fields'));
          if (customFieldsDoc.exists()) state.customFields = { ...state.customFields, ...customFieldsDoc.data() };

          const rolesSnap = await getDocs(collection(db, 'roles'));
          const rolesData = [];
          rolesSnap.forEach(roleDoc => rolesData.push({ id: roleDoc.id, ...roleDoc.data() }));
          if (rolesData.length > 0) state.roles = rolesData;

          await loadSetupStatus();
          
        } catch(e) {
          console.warn("Failed to load settings:", e);
          state.setup = { ...state.setup, loading: false };
        }
      } catch (err) {
        console.error("Error during profile initialization (check Firebase rules/config):", err);
        showToast(state.lang === 'ar' ? 'فشل في الاتصال بقاعدة البيانات. تأكد من إعدادات Firebase.' : 'Failed to connect to database. Check Firebase config.', 'error');
        // Provide a minimal fallback profile so the app doesn't crash completely
        state.profile = {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          role: user.email === ADMIN_EMAIL ? 'admin' : 'student'
        };
        state.setup = { ...state.setup, completed: true, loading: false };
      }
      
      hideLoading();
      onLogin();
    } else {
      state.user = null;
      state.profile = null;
      state.unsubscribers.forEach(unsub => unsub());
      state.unsubscribers = [];
      hideLoading();
      onLogout();
    }
  });
}

export async function logout() {
  state.unsubscribers.forEach(unsub => unsub());
  state.unsubscribers = [];
  await signOut(auth);
}

/**
 * Creates a new Firebase Auth user without logging out the current admin.
 * يستخدم Secondary App Singleton — لا يُنشئ instance جديدة في كل استدعاء.
 */
export async function adminCreateUser(email, password, role, name) {
  const secondaryAuth = getSecondaryAuth(); // ← singleton بدلاً من initializeApp جديد
  try {
    let newUid;
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      newUid = userCredential.user.uid;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, password);
          newUid = userCredential.user.uid;
        } catch (signInErr) {
          console.warn(`[adminCreateUser] User exists, wrong password: ${email}`);
          throw new Error('EXISTING_USER_WRONG_PASSWORD');
        }
      } else {
        throw authErr;
      }
    }

    await setDoc(doc(db, 'users', newUid), {
      email, role, name, uid: newUid,
      accountStatus: 'active',
      authManaged: {
        temporaryPassword: password,
        passwordUpdatedAt: new Date().toISOString(),
        passwordSource: 'admin-created',
        mustChange: true
      },
      createdAt: new Date().toISOString()
    }, { merge: true });

    // نُخرج المستخدم المؤقت من الـ secondary session ثم نُعيد تهيئة الـ auth
    await signOut(secondaryAuth).catch(() => {});
    return newUid;
  } catch (error) {
    await signOut(secondaryAuth).catch(() => {});
    // أعد تهيئة الـ secondary auth حتى لا يبقى في حالة خاطئة
    _secondaryApp = null;
    _secondaryAuth = null;
    throw error;
  }
}

export async function adminUpdateManagedPassword(email, currentPassword, newPassword) {
  const secondaryAuth = getSecondaryAuth();
  try {
    const credential = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
    await updatePassword(credential.user, newPassword);
    await signOut(secondaryAuth).catch(() => {});
    return true;
  } catch (error) {
    await signOut(secondaryAuth).catch(() => {});
    throw error;
  }
}

export async function adminSendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}
