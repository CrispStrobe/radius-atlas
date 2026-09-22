// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('browser assets and data remain GitHub Pages subpath-safe', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/app.js', root), 'utf8')
  ]);
  assert.doesNotMatch(html, /(?:href|src)="\/(?!\/)/);
  assert.doesNotMatch(app, /loadJson\(['"]\//);
  assert.match(app, /loadJson\(['"]\.\/data\/dataset\.json['"]\)/);
});

test('Pages workflow builds and deploys the production artifact', async () => {
  const workflow = await readFile(new URL('.github/workflows/pages.yml', root), 'utf8');
  assert.match(workflow, /npm run build:full/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});

test('About dialog carries operator, privacy, warranty, source and licence notices', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  for (const required of ['Service provider', 'Contact', 'Privacy', 'Disclaimer', 'Licences',
    'Third-party services and data', 'Not affiliated', 'build-commit', 'CrispStrobe/radius-atlas',
    'THIRD_PARTY_NOTICES.md']) assert.match(html, new RegExp(required));
});

test('interface offers English, German and French localization', async () => {
  const [html, i18n] = await Promise.all([readFile(new URL('index.html', root), 'utf8'), readFile(new URL('src/i18n.js', root), 'utf8')]);
  for (const code of ['en','de','fr']) assert.match(html, new RegExp(`<option value="${code}">`));
  assert.match(i18n, /const supported = \['en', 'de', 'fr'\]/);
  assert.match(i18n, /Datenschutz/); assert.match(i18n, /Confidentialité/);
});
