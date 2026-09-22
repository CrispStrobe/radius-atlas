// SPDX-License-Identifier: MIT
import { assertCoordinate, referencePoint } from './geo.js';
export const normalize = s => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function validateDataset(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.records) || !data.records.length || data.records.length > 250000) {
    throw new Error('Invalid dataset: expected schemaVersion 1 and 1–250,000 records.');
  }
  if (!data.meta?.attribution || !data.meta?.license || !data.meta?.sourceUrl || !Array.isArray(data.meta?.countries)) {
    throw new Error('Dataset attribution, license, sourceUrl and countries are required.');
  }
  const ids = new Set();
  for (const r of data.records) {
    if (!r.id || ids.has(r.id) || !/^[A-Z]{2}$/.test(r.country) || typeof r.postalCode !== 'string' ||
        !r.postalCode || r.postalCode.length > 20 || typeof r.place !== 'string' || !r.place.trim() || r.place.length > 200 ||
        !Array.isArray(r.adminCodes) || r.adminCodes.length !== 3) throw new Error('Invalid or duplicate postal record.');
    assertCoordinate(r); ids.add(r.id);
  }
  return data;
}
/** GeoNames DE admin3 is often a district, NOT an eight-digit municipal key. */
export function indexPlaces(records) {
  const groups = new Map();
  for (const r of records) {
    // Preserve accents and punctuation in identity: search normalization must not merge distinct places.
    const key = JSON.stringify([r.country, ...r.adminCodes, r.place.normalize('NFC').trim().toLocaleLowerCase('de')]);
    if (!groups.has(key)) groups.set(key, { id: key, name: r.place, country: r.country,
      adminArea1: r.adminArea1, adminArea2: r.adminArea2, adminArea3: r.adminArea3,
      adminCodes: r.adminCodes, kind: 'postal_locality', records: [] });
    groups.get(key).records.push(r);
  }
  return [...groups.values()].map(group => ({ ...group, ...referencePoint(group.records),
    postalCodes: [...new Set(group.records.map(r => r.postalCode))].sort(),
    searchName: normalize(group.name), searchText: normalize([group.name, group.country, group.adminArea1, group.adminArea3, ...group.records.map(r => r.postalCode)].join(' '))
  })).sort((a, b) => a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));
}
export function searchPlaces(places, input, countries = ['DE', 'FR'], limit = 10) {
  const query = normalize(input);
  if (!query) return [];
  const tokens = query.split(' ');
  return places.filter(p => countries.includes(p.country) && tokens.every(t => p.searchText.includes(t)))
    .map(p => ({ place: p, score: p.searchName === query ? 0 : p.postalCodes.includes(query) ? 1 : p.searchName.startsWith(query) ? 2 : 3 }))
    .sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name, 'de'))
    .slice(0, limit).map(item => item.place);
}
