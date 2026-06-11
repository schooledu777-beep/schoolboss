const GLOBAL_COLLECTIONS = new Set(['users', 'activation_codes', 'tenants']);

export function expandFirestorePath(segments) {
  return segments.flatMap(segment => String(segment).split('/').filter(Boolean));
}

export function resolveFirestorePath(segments, tenantId) {
  const path = expandFirestorePath(segments);
  if (!path.length || GLOBAL_COLLECTIONS.has(path[0])) return path;
  if (!tenantId) throw new Error(`TENANT_REQUIRED:${path[0]}`);
  return ['tenants', tenantId, ...path];
}
