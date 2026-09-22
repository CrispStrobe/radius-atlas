// SPDX-License-Identifier: MIT
import { assertCoordinate, distanceKm } from './geo.js';
import { normalize, searchPlaces } from './data.js';
export const MODES = ['places', 'postal-points'];
export function validateQuery(query) {
  assertCoordinate(query.center);
  if (!Number.isFinite(query.radiusKm) || query.radiusKm < 0 || query.radiusKm > 500) throw new RangeError('Radius must be 0–500 km.');
  if (!MODES.includes(query.mode)) throw new Error('Choose places or postal-points mode.');
  if (!Array.isArray(query.countries) || !query.countries.length || query.countries.some(c => !['DE', 'FR', 'CH'].includes(c))) throw new Error('Select Germany, France and/or Switzerland.');
}
export function runQuery(places, query) {
  validateQuery(query);
  const results = [], markers = [];
  for (const place of places) {
    if (!query.countries.includes(place.country)) continue;
    const referenceDistanceKm = distanceKm(query.center, place);
    if (query.mode === 'places' && referenceDistanceKm > query.radiusKm + 1e-9) continue;
    const matching = [];
    for (const record of place.records) {
      const postalPointDistanceKm = distanceKm(query.center, record);
      if (query.mode === 'postal-points' && postalPointDistanceKm > query.radiusKm + 1e-9) continue;
      const distance = query.mode === 'places' ? referenceDistanceKm : postalPointDistanceKm;
      const row = { id: record.id, placeId: place.id, place: place.name, kind: place.kind,
        country: record.country, postalCode: record.postalCode,
        adminArea1: record.adminArea1, adminArea2: record.adminArea2, adminArea3: record.adminArea3,
        latitude: record.latitude, longitude: record.longitude,
        referenceLatitude: place.latitude, referenceLongitude: place.longitude,
        distanceKm: distance, referenceDistanceKm, postalPointDistanceKm,
        pointInsideRadius: postalPointDistanceKm <= query.radiusKm + 1e-9,
        accuracy: record.accuracy ?? null, municipalityId: place.municipalityId ?? null, postalLocality: record.place };
      results.push(row); matching.push(row);
      if (query.mode === 'postal-points') markers.push({ ...record, name: place.name, postalCodes: [record.postalCode], distanceKm: distance });
    }
    if (matching.length && query.mode === 'places') markers.push({ id: place.id, name: place.name,
      latitude: place.latitude, longitude: place.longitude, country: place.country, postalCodes: place.postalCodes, distanceKm: referenceDistanceKm });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm || a.place.localeCompare(b.place, 'de') || a.postalCode.localeCompare(b.postalCode));
  markers.sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'de'));
  const uniquePostalCodes = [...new Map(results.map(r => [`${r.country}:${r.postalCode}`, { country: r.country, postalCode: r.postalCode }])).values()]
    .sort((a, b) => a.country.localeCompare(b.country) || a.postalCode.localeCompare(b.postalCode));
  return { results, markers, uniquePostalCodes, placeCount: new Set(results.map(r => r.placeId)).size };
}
/** Small, explicit EN/DE/FR convenience grammar. Not a general natural-language or AI interface. */
export function parseTextQuery(text, places, countries) {
  if (typeof text !== 'string' || text.length > 400) throw new Error('Use a query shorter than 400 characters.');
  if (/\b(driv\w*|fahr\w*|condu\w*|routi\w*|road|route|routes|straßen|strassen|minutes?|minuten?|miles?|meilen?|boundary|boundaries|limites?|fronti[eè]res?|grenzen|gebietsgrenz\w*)\b/i.test(text)) {
    throw new Error('Only point-based, straight-line distances in kilometres are supported.');
  }
  const amounts = [...text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:km|kilomet(?:er|re)(?:s|n)?)(?!\p{L})/giu)];
  if (amounts.length !== 1) throw new Error('Specify one radius, for example: “within 30 km of Kehl”.');
  const radiusKm = Number(amounts[0][1].replace(',', '.'));
  if (radiusKm < 0 || radiusKm > 500) throw new Error('Radius must be 0–500 km.');
  const norm = ` ${normalize(text)} `;
  const candidates = places.filter(p => countries.includes(p.country) && norm.includes(` ${p.searchName} `));
  if (!candidates.length) {
    const postcode = text.match(/\b\d{4,5}\b/);
    const found = postcode ? searchPlaces(places, postcode[0], countries, 20) : [];
    if (found.length === 1) return { center: found[0], radiusKm };
    throw new Error('No unique place found. Choose a location from the search field instead.');
  }
  // Prefer the longest matching name; namesakes remain ambiguous and are never silently selected.
  const length = Math.max(...candidates.map(p => p.searchName.length));
  const best = candidates.filter(p => p.searchName.length === length);
  if (best.length !== 1) throw new Error('That place name is ambiguous. Select the intended location from the search field.');
  if (candidates.some(p => !(` ${best[0].searchName} `).includes(` ${p.searchName} `))) {
    throw new Error('More than one location is mentioned. Choose a single query center.');
  }
  return { center: best[0], radiusKm };
}
