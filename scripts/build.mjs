// SPDX-License-Identifier: MIT
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDataset } from '../src/data.js';
const root = resolve(import.meta.dirname, '..'), dist = resolve(root, 'dist');
let dataset;
try {
  dataset = validateDataset(JSON.parse(await readFile(resolve(root, 'public/data/dataset.json'), 'utf8')));
} catch (error) {
  throw new Error(`Production dataset unavailable. Run "npm run data:refresh" before "npm run build". ${error.message}`);
}
if (dataset.meta.coverage !== 'country-files') throw new Error('Refusing to build: public/data/dataset.json is not a production country-file dataset.');
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
await cp(resolve(root, 'public'), dist, { recursive: true });
for (const name of ['src', 'docs']) await cp(resolve(root, name), resolve(dist, name), { recursive: true });
await cp(resolve(root, 'index.html'), resolve(dist, 'index.html'));
await writeFile(resolve(dist, '.nojekyll'), '');
for (const name of ['LICENSE', 'LICENSE-DATA.md', 'THIRD_PARTY_NOTICES.md']) await cp(resolve(root, name), resolve(dist, name));
await writeFile(resolve(dist, 'build-info.json'), JSON.stringify({
  version: project.version,
  commit: process.env.GITHUB_SHA || 'unknown',
  ref: process.env.GITHUB_REF_NAME || '',
  builtAt: new Date().toISOString(),
  coverage: dataset.meta.coverage,
  records: dataset.records.length
}, null, 2));
console.log(`Built dist/ (${dataset.records.length} records; coverage: ${dataset.meta.coverage}).`);
