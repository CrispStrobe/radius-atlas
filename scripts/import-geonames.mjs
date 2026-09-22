// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { validateDataset } from '../src/data.js';
export function parseGeoNames(text, country) {
  const records = [], seen = new Set(); let rejected = 0, excludedUnsupported = 0, duplicates = 0;
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = line.split('\t');
    if (f.length < 12 || f[0] !== country || !f[1] || !f[2] || !f[9].trim() || !f[10].trim()) { rejected++; continue; }
    // Radius Atlas currently supports ordinary five-digit DE/FR postcodes.
    // GeoNames' FR file also contains thousands of labelled CEDEX routing
    // codes. Their exclusion is an intentional scope decision, not evidence
    // that the upstream file is malformed.
    if (!/^\d{5}$/.test(f[1])) { excludedUnsupported++; continue; }
    const latitude = Number(f[9]), longitude = Number(f[10]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { rejected++; continue; }
    const identity = JSON.stringify([country, f[1], f[2], f[4], f[6], f[8], latitude, longitude]);
    const id = `gn-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
    if (seen.has(id)) { duplicates++; continue; } seen.add(id);
    records.push({ id, country, postalCode: f[1], place: f[2], adminArea1: f[3], adminArea2: f[5], adminArea3: f[7],
      adminCodes: [f[4], f[6], f[8]], latitude, longitude, accuracy: /^\d+$/.test(f[11]) ? Number(f[11]) : null });
  }
  return { records, rejected, excludedUnsupported, duplicates };
}
export function makeDataset(imports, provenance) {
  const records = imports.flatMap(i => i.records).sort((a, b) => a.country.localeCompare(b.country) || a.postalCode.localeCompare(b.postalCode) || a.id.localeCompare(b.id));
  return validateDataset({ schemaVersion: 1,
    meta: { title: `GeoNames postal localities — ${[...new Set(records.map(r => r.country))].sort().join(' + ')}`, coverage: 'country-files',
      countries: [...new Set(records.map(r => r.country))].sort(), recordCount: records.length,
      source: 'GeoNames', sourceUrl: 'https://download.geonames.org/export/zip/',
      license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Postal data © GeoNames, CC BY 4.0. Converted, validated and deduplicated by Radius Atlas; place reference points and distances are derived.',
      changes: 'TSV converted to JSON; malformed rows and unsupported non-five-digit routing codes (including CEDEX labels) excluded; exact duplicate rows removed; distances and locality reference points derived at query time.',
      rejectedRecords: imports.reduce((n, i) => n + i.rejected, 0), duplicateRecords: imports.reduce((n, i) => n + i.duplicates, 0),
      excludedUnsupportedRecords: imports.reduce((n, i) => n + i.excludedUnsupported, 0),
      coordinateNotice: 'Coordinates may be estimated. Locality names are not verified municipalities. Upstream completeness is not guaranteed.',
      licenseNotice: 'GeoNames postal README names CC BY 4.0 but retains a legacy link to 3.0. The fetched README is archived alongside this dataset.',
      ...provenance }, records });
}
