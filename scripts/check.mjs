// SPDX-License-Identifier: MIT
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
for (const dir of ['src', 'scripts', 'tests']) for (const file of await readdir(resolve(root, dir))) {
  if (!/\.m?js$/.test(file)) continue;
  const result = spawnSync(process.execPath, ['--check', resolve(root, dir, file)], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('All JavaScript modules passed syntax checks.');
