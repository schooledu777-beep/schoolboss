/**
 * tenantService.js
 * ─────────────────────────────────────────────────────────────────
 * Manages multi-tenant activation codes and tenant configuration.
 *
 * Firestore schema (root-level, NOT tenant-prefixed):
 *
 * /activation_codes/{code}
 *   status       : 'pending' | 'active' | 'used' | 'suspended'
 *   tenantId     : string   (pre-generated UUID)
 *   schoolName   : string
 *   plan         : 'basic' | 'pro'
 *   maxStudents  : number
 *   createdAt    : ISO string
 *   expiresAt    : ISO string | null
 *   usedBy       : uid | null
 *   usedAt       : ISO string | null
 *   createdBy    : uid (super admin)
 *   note         : string (internal note)
 *
 * /tenants/{tenantId}
 *   name         : string
 *   adminUid     : string
 *   adminEmail   : string
 *   plan         : string
 *   maxStudents  : number
 *   status       : 'active' | 'suspended'
 *   activationCode : string
 *   createdAt    : ISO string
 */

import { db } from '../db.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy
} from '../firebase-config.js';
import { state } from '../state.js';

const CODES_COL = 'activation_codes';
const TENANTS_COL = 'tenants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. ABCD-EFGH-JKLM
}

function generateTenantId() {
  return 'tenant_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Super Admin: Create Activation Code ──────────────────────────────────────

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

  await setDoc(doc(db, CODES_COL, code), {
    status: 'pending',
    tenantId,
    schoolName,
    plan,
    maxStudents,
    note,
    createdAt: now.toISOString(),
    expiresAt,
    usedBy: null,
    usedAt: null,
    createdBy: state.user?.uid || '',
  });

  return { code, tenantId };
}

// ── Super Admin: List All Codes ───────────────────────────────────────────────

export async function listActivationCodes() {
  const snap = await getDocs(
    query(collection(db, CODES_COL), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Super Admin: List All Tenants ─────────────────────────────────────────────

export async function listTenants() {
  const snap = await getDocs(
    query(collection(db, TENANTS_COL), orderBy('createdAt', 'desc'))
  );
  // Exclude the 'main' tenant (super admin's own school)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.adminEmail);
}

// ── Super Admin: Suspend / Activate Tenant ───────────────────────────────────

export async function setTenantStatus(tenantId, status) {
  await updateDoc(doc(db, TENANTS_COL, tenantId), { status });
}

// ── New Admin: Validate Activation Code ──────────────────────────────────────

export async function validateActivationCode(code) {
  const trimmed = code.trim().toUpperCase().replace(/\s/g, '');
  const snap = await getDoc(doc(db, CODES_COL, trimmed));
  if (!snap.exists()) return { valid: false, error: 'الكود غير موجود' };

  const data = snap.data();
  if (data.status === 'used')
    return { valid: false, error: 'هذا الكود مستخدم بالفعل' };
  if (data.status === 'suspended')
    return { valid: false, error: 'تم إيقاف هذا الكود' };
  if (data.expiresAt && new Date(data.expiresAt) < new Date())
    return { valid: false, error: 'انتهت صلاحية هذا الكود' };

  return { valid: true, code: trimmed, data };
}

// ── New Admin: Consume Activation Code (called after successful registration) ─

export async function consumeActivationCode(code, adminUid, adminEmail, schoolName) {
  const codeRef = doc(db, CODES_COL, code);
  const snap = await getDoc(codeRef);
  if (!snap.exists()) throw new Error('Code not found');

  const codeData = snap.data();
  const { tenantId, plan, maxStudents } = codeData;

  // Mark code as used
  await updateDoc(codeRef, {
    status: 'used',
    usedBy: adminUid,
    usedAt: new Date().toISOString(),
    schoolName: schoolName || codeData.schoolName,
  });

  // Create tenant config document
  await setDoc(doc(db, TENANTS_COL, tenantId), {
    name: schoolName || codeData.schoolName || 'مدرسة جديدة',
    adminUid,
    adminEmail,
    plan,
    maxStudents,
    status: 'active',
    activationCode: code,
    createdAt: new Date().toISOString(),
  });

  return tenantId;
}

// ── Lookup tenant for a given admin UID ──────────────────────────────────────

export async function getTenantIdForUser(uid) {
  const snap = await getDocs(
    query(collection(db, TENANTS_COL), where('adminUid', '==', uid))
  );
  if (snap.empty) return null;
  return snap.docs[0].id;
}
