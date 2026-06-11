import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirestorePath } from '../js/tenantPaths.js';

test('keeps global collections at the Firestore root', () => {
  assert.deepEqual(resolveFirestorePath(['users', 'u1'], null), ['users', 'u1']);
  assert.deepEqual(resolveFirestorePath(['activation_codes', 'CODE'], null), ['activation_codes', 'CODE']);
  assert.deepEqual(resolveFirestorePath(['tenants', 'school-a'], null), ['tenants', 'school-a']);
});

test('prefixes school data with the active tenant', () => {
  assert.deepEqual(
    resolveFirestorePath(['students', 'student-1'], 'school-a'),
    ['tenants', 'school-a', 'students', 'student-1']
  );
});

test('rejects school data access without an active tenant', () => {
  assert.throws(
    () => resolveFirestorePath(['students'], null),
    /TENANT_REQUIRED:students/
  );
});

test('normalizes slash-delimited path segments', () => {
  assert.deepEqual(
    resolveFirestorePath(['settings/general'], 'school-a'),
    ['tenants', 'school-a', 'settings', 'general']
  );
});
