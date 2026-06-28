import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('does not load html2pdf on the login screen', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.doesNotMatch(html, /html2pdf\.bundle\.min\.js/);
});

test('loads page modules on demand instead of at startup', async () => {
  const app = await readFile(new URL('js/app.js', root), 'utf8');
  assert.doesNotMatch(app, /^import .* from ['"]\.\/pages\//m);
  assert.match(app, /import\(['"]\.\/pages\/dashboard\.js\?v=/);
});

test('does not load Firebase Storage with authentication', async () => {
  const config = await readFile(new URL('js/firebase-config.js', root), 'utf8');
  assert.doesNotMatch(config, /firebase-storage\.js/);
});

test('dashboard subscribes only to data it renders', async () => {
  const sync = await readFile(new URL('js/services/syncService.js', root), 'utf8');
  const dashboardLine = sync.split('\n').find(line => line.includes('dashboard:')) || '';
  assert.doesNotMatch(dashboardLine, /attendance|fees|notification_|schedules|rewards|behavior_logs|calendar_events|exam_schedule/);
  assert.match(dashboardLine, /students/);
  assert.match(dashboardLine, /teachers/);
  assert.match(dashboardLine, /classes/);
});

test('loads independent school settings in parallel', async () => {
  const auth = await readFile(new URL('js/auth.js', root), 'utf8');
  assert.match(auth, /const \[settingsDoc, modulesDoc, customFieldsDoc, rolesSnap\] = await Promise\.all/);
});

test('defers non-critical admin maintenance until the browser is idle', async () => {
  const app = await readFile(new URL('js/app.js', root), 'utf8');
  assert.match(app, /requestIdleCallback/);
});
