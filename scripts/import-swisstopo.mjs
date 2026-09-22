// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';

function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ';' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseSwisstopo(text) {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const header = rows.shift();
  const expected = ['Ortschaftsname','PLZ4','Zusatzziffer','ZIP_ID','Gemeindename','BFS-Nr','Kantonskürzel','Adressenanteil','E','N','Sprache','Validity'];
  if (!header || expected.some((name, i) => header[i] !== name)) throw new Error('Unexpected swisstopo CSV schema.');
  const records = []; let rejected = 0, duplicates = 0; const seen = new Set();
  for (const f of rows) {
    const latitude = Number(f[9]), longitude = Number(f[8]);
    const share = Number(String(f[7]).replace('%', '').trim().replace(',', '.'));
    if (f.length < 12 || !/^\d{4}$/.test(f[1]) || !f[0]?.trim() || !f[4]?.trim() || !/^\d+$/.test(f[5]) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 45 || latitude > 48 || longitude < 5 || longitude > 12) { rejected++; continue; }
    const identity = JSON.stringify(['CH', f[3], f[1], f[2], f[0], f[5], latitude, longitude]);
    const id = `ch-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
    if (seen.has(id)) { duplicates++; continue; } seen.add(id);
    records.push({ id, country: 'CH', postalCode: f[1], place: f[0].trim(), adminArea1: f[6].trim(), adminArea2: f[4].trim(), adminArea3: '', adminCodes: [f[6].trim(), f[5].trim(), f[3].trim()], latitude, longitude, accuracy: null, municipality: f[4].trim(), municipalityId: f[5].trim(), postalAdditionalDigit: f[2].trim(), zipId: f[3].trim(), language: f[10].trim(), validFrom: f[11].trim(), addressShare: Number.isFinite(share) && share > 0 ? share : null, source: 'swisstopo' });
  }
  return { records, rejected, duplicates, excludedUnsupported: 0 };
}
