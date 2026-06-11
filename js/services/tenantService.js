import {
  db, rootCollection, rootDoc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, runTransaction
} from '../firebase-config.js';
import { state } from '../state.js';

const CODES_COL = 'activation_codes';
const TENANTS_COL = 'tenants';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 12; index += 1) {
    if (index === 4 || index === 8) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateTenantId() {
  return `tenant_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function createActivationCode({
  schoolName = '',
  plan = 'pro',
  maxStudents = 500,
  note = '',
  expiresInDays = 365,
} = {}) {
  const code = generateCode();
  const tenantId = generateTenantId();
  const now = new Date();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 86400_000).toISOString()
    : null;

  await setDoc(rootDoc(CODES_COL, code), {
    status: 'pending',
    tenantId,
    schoolName,
    plan,
    maxStudents: Number(maxStudents || 500),
    note,
    createdAt: now.toISOString(),
    expiresAt,
    usedBy: null,
    usedAt: null,
    createdBy: state.user?.uid || '',
  });

  return { code, tenantId };
}

export async function listActivationCodes() {
  const snapshot = await getDocs(
    query(rootCollection(CODES_COL), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function listTenants() {
  const snapshot = await getDocs(
    query(rootCollection(TENANTS_COL), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(tenant => tenant.id !== 'main');
}

export async function setTenantStatus(tenantId, status) {
  await updateDoc(rootDoc(TENANTS_COL, tenantId), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function validateActivationCode(code) {
  const normalizedCode = code.trim().toUpperCase().replace(/\s/g, '');
  const snapshot = await getDoc(rootDoc(CODES_COL, normalizedCode));
  if (!snapshot.exists()) return { valid: false, error: 'الكود غير موجود' };

  const data = snapshot.data();
  if (data.status === 'used') {
    return { valid: false, error: 'هذا الكود مستخدم بالفعل' };
  }
  if (data.status === 'suspended') {
    return { valid: false, error: 'تم إيقاف هذا الكود' };
  }
  if (data.status !== 'pending') {
    return { valid: false, error: 'هذا الكود غير متاح للتفعيل' };
  }
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    return { valid: false, error: 'انتهت صلاحية هذا الكود' };
  }

  return { valid: true, code: normalizedCode, data };
}

export async function consumeActivationCode(code, adminUid, adminEmail, schoolName) {
  const normalizedCode = code.trim().toUpperCase().replace(/\s/g, '');
  const codeRef = rootDoc(CODES_COL, normalizedCode);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(codeRef);
    if (!snapshot.exists()) throw new Error('ACTIVATION_CODE_NOT_FOUND');

    const codeData = snapshot.data();
    if (codeData.status !== 'pending') throw new Error('ACTIVATION_CODE_ALREADY_USED');
    if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) {
      throw new Error('ACTIVATION_CODE_EXPIRED');
    }

    const tenantId = codeData.tenantId;
    const tenantRef = rootDoc(TENANTS_COL, tenantId);
    const resolvedSchoolName = schoolName || codeData.schoolName || 'مدرسة جديدة';

    transaction.update(codeRef, {
      status: 'used',
      usedBy: adminUid,
      usedAt: now,
      schoolName: resolvedSchoolName,
    });
    transaction.set(tenantRef, {
      name: resolvedSchoolName,
      adminUid,
      adminEmail,
      plan: codeData.plan || 'pro',
      maxStudents: Number(codeData.maxStudents || 500),
      status: 'active',
      activationCode: normalizedCode,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    return tenantId;
  });
}

export async function getTenantIdForUser(uid) {
  const snapshot = await getDocs(
    query(rootCollection(TENANTS_COL), where('adminUid', '==', uid))
  );
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

export async function getTenantConfig(tenantId) {
  if (!tenantId) return null;
  const snapshot = await getDoc(rootDoc(TENANTS_COL, tenantId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
