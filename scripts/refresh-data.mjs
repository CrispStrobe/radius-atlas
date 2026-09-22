// SPDX-License-Identifier: MIT
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { unzipEntry } from './zip.mjs';
import { parseGeoNames, makeDataset } from './import-geonames.mjs';
const root = resolve(import.meta.dirname, '..');
const countries = (process.env.COUNTRIES || 'DE,FR').split(',').map(c => c.trim().toUpperCase());
if (!countries.length || countries.some(c => !['DE','FR'].includes(c))) throw new Error('COUNTRIES supports DE,FR only.');
const uniqueCountries = [...new Set(countries)];
const rawDir = process.env.GEONAMES_RAW_DIR;
const out = resolve(root, 'public/data');
await mkdir(out, { recursive: true });
async function fetchLimited(url, limit = 16 * 1024 * 1024) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'RadiusAtlas/1.0 GeoNames build-time importer' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length; if (size > limit) throw new Error('Download exceeds the allowed size.'); chunks.push(chunk);
      }
      return { bytes: Buffer.concat(chunks), lastModified: response.headers.get('last-modified') };
    } catch (e) { error = e; if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); }
  }
  throw error;
}
try {
  const imports = [], archives = [];
  for (const country of uniqueCountries) {
    const url = `https://download.geonames.org/export/zip/${country}.zip`;
    console.log(`Importing ${country} from ${rawDir ? 'local GeoNames ZIP' : url}`);
    const source = rawDir ? { bytes: await readFile(resolve(rawDir, `${country}.zip`)), lastModified: null } : await fetchLimited(url);
    const imported = parseGeoNames(unzipEntry(source.bytes, `${country}.txt`), country);
    if (imported.records.length < 1000) throw new Error(`${country}: unexpectedly small file (${imported.records.length} records); refusing a production dataset.`);
    if (imported.rejected > imported.records.length * 0.05) throw new Error(`${country}: more than 5% rejected records; inspect upstream format.`);
    imports.push(imported); archives.push({ country, url, upstreamLastModified: source.lastModified, sha256: createHash('sha256').update(source.bytes).digest('hex') });
  }
  const readme = rawDir ? await readFile(resolve(rawDir, 'readme.txt')) : (await fetchLimited('https://download.geonames.org/export/zip/readme.txt', 100000)).bytes;
  const dataset = makeDataset(imports, { retrievedAt: new Date().toISOString(), archives });
  await writeFile(resolve(out, 'dataset.json.tmp'), JSON.stringify(dataset));
  await writeFile(resolve(out, 'geonames-readme.txt'), readme);
  await rename(resolve(out, 'dataset.json.tmp'), resolve(out, 'dataset.json'));
  console.log(`Wrote ${dataset.records.length.toLocaleString('en')} records. No database/API needed at runtime.`);
} catch (e) {
  console.error(`Data import failed: ${e.message}\nNo dataset was substituted. Retry the import or supply GEONAMES_RAW_DIR.`);
  process.exitCode = 1;
}
