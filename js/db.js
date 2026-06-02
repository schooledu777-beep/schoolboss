/**
 * db.js — Tenant-aware Firestore helpers
 *
 * All school data lives under:   /tenants/{tenantId}/{collectionName}/{docId}
 * Root-level (no tenant prefix): /users/, /activation_codes/, /tenants/
 *
 * Usage in any page file:
 *   import { tCol, tDoc } from '../db.js';
 *   addDoc(tCol('students'), data);
 *   updateDoc(tDoc('students', id), patch);
 */
import { state } from './state.js';
import { db, collection, doc } from './firebase-config.js';

/** Returns a tenant-prefixed CollectionReference. */
export function tCol(name) {
  const tid = state.tenantId;
  if (!tid) {
    console.warn(`[db] tCol('${name}') — no tenantId in state, falling back to root`);
    return collection(db, name);          // graceful fallback during bootstrap
  }
  return collection(db, 'tenants', tid, name);
}

/** Returns a tenant-prefixed DocumentReference. */
export function tDoc(name, id) {
  const tid = state.tenantId;
  if (!tid) {
    console.warn(`[db] tDoc('${name}','${id}') — no tenantId in state, falling back to root`);
    return doc(db, name, id);             // graceful fallback during bootstrap
  }
  return doc(db, 'tenants', tid, name, id);
}

/** Returns a reference to the tenant config document (root-level). */
export function tenantConfigDoc(tenantId) {
  return doc(db, 'tenants', tenantId || state.tenantId);
}

export { db };
