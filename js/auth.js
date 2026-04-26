import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc, firebaseConfig, initializeApp, getAuth } from './firebase-config.js';
import { state, t } from './state.js';
import { showToast, hideLoading } from './ui.js';

const ADMIN_EMAIL = 'mohammed.soft7@gmail.com';

export function renderAuthPage() {
  return `
  <div class="auth-page">
    <div class="auth-bg-shapes">
      <div class="shape shape-1"></div><div class="shape shape-2"></div><div class="shape shape-3"></div>
    </div>
    <div class="auth-card glass-card">
      <div class="auth-logo">
        <div class="logo-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#grad)"/>
            <path d="M14 34V20l10-8 10 8v14H28v-8h-8v8H14z" fill="white"/>
            <defs><linearGradient id="grad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
          </svg>
        </div>
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
  onAuthStateChanged(auth, async (user) => {
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
          const isAdmin = user.email === ADMIN_EMAIL || user.email?.toLowerCase().includes('admin');
          const profile = existingProfile ? {
            ...existingProfile, uid: user.uid,
            name: existingProfile.name || user.displayName || user.email?.split('@')[0],
            avatar: user.photoURL || existingProfile.avatar || ''
          } : {
            uid: user.uid,
            name: state._pendingName || user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            role: isAdmin ? 'admin' : 'student',
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
          
        } catch(e) {
          console.warn("Failed to load settings:", e);
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
 * Uses a secondary Firebase app instance.
 */
export async function adminCreateUser(email, password, role, name) {
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
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
          console.warn(`User exists but could not sign in (probably different password): ${email}`);
          // If we can't sign in, we can't get the UID to link.
          // For mock data, we could just generate a random email, but let's just throw a specific skip error.
          throw new Error('EXISTING_USER_WRONG_PASSWORD');
        }
      } else {
        throw authErr;
      }
    }
    
    await setDoc(doc(db, 'users', newUid), {
      email, role, name, uid: newUid,
      createdAt: new Date().toISOString()
    }, { merge: true });
    
    await signOut(secondaryAuth);
    return newUid;
  } catch (error) {
    await signOut(secondaryAuth).catch(() => {});
    throw error;
  }
}
