// SPDX-License-Identifier: MIT
const rounded = n => Number(n.toFixed(6));
export function makeExport(dataset, query, answer, timestamp = new Date().toISOString()) {
  return {
    schemaVersion: 1, generatedAt: timestamp,
    attribution: dataset.meta.attribution, license: dataset.meta.license, licenseUrl: dataset.meta.licenseUrl,
    sourceUrl: dataset.meta.sourceUrl, dataset: dataset.meta,
    query: { center: { name: query.center.name ?? 'Map point', latitude: query.center.latitude, longitude: query.center.longitude },
      radiusKm: query.radiusKm, countries: query.countries, mode: query.mode, distanceModel: 'haversine; mean Earth radius 6371.0088 km',
      selectionRule: query.mode === 'places' ? 'Select Swiss municipalities by address-share-weighted reference point and other postal localities by spherical-mean reference point, then include all their known postal records.' : 'Select individual postal-record coordinates inside the radius.',
      warning: 'Swiss municipality assignments use official BFS identifiers, but reference points are derived and no boundary intersection is performed. DE/FR postal localities are not verified municipalities. GeoNames coordinates may be approximate.' },
    counts: { postalRecords: answer.results.length, places: answer.placeCount, uniquePostalCodes: answer.uniquePostalCodes.length },
    uniquePostalCodes: answer.uniquePostalCodes,
    results: answer.results.map(r => Object.fromEntries(Object.entries(r).map(([key, value]) => [key, typeof value === 'number' ? rounded(value) : value])))
  };
}
/** RFC 4180 escaping + spreadsheet formula-injection defence. No ="00123" tricks. */
export function csvCell(value, delimiter = ',') {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = `'${text}`;
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function toCsv(payload, delimiter = ',') {
  if (![',', ';'].includes(delimiter)) throw new Error('Unsupported delimiter.');
  const keys = ['country','postalCode','place','kind','latitude','longitude','distanceKm','referenceDistanceKm',
    'postalPointDistanceKm','pointInsideRadius','referenceLatitude','referenceLongitude','accuracy','adminArea1','adminArea2','adminArea3','municipalityId','postalLocality'];
  const metaKeys = ['queryCenter','queryLatitude','queryLongitude','radiusKm','mode','coverage','retrievedAt','sourceUrl','license','licenseUrl','attribution','changes'];
  const metaValues = [payload.query.center.name,payload.query.center.latitude,payload.query.center.longitude,payload.query.radiusKm,
    payload.query.mode,payload.dataset.coverage,payload.dataset.retrievedAt,payload.sourceUrl,payload.license,payload.licenseUrl,payload.attribution,payload.dataset.changes];
  const lines = [[...keys, ...metaKeys].join(delimiter)];
  for (const row of payload.results) lines.push([...keys.map(k => row[k]), ...metaValues].map(v => csvCell(v, delimiter)).join(delimiter));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
export function postalCodesCsv(payload, delimiter = ',') {
  const keys = ['country','postalCode','license','attribution','sourceUrl','coverage'];
  return '\uFEFF' + [keys.join(delimiter), ...payload.uniquePostalCodes.map(p => [p.country, p.postalCode, payload.license, payload.attribution, payload.sourceUrl, payload.dataset.coverage].map(v => csvCell(v, delimiter)).join(delimiter))].join('\r\n') + '\r\n';
}
export function toGeoJson(payload) {
  return { type: 'FeatureCollection', attribution: payload.attribution, license: payload.license, licenseUrl: payload.licenseUrl,
    sourceUrl: payload.sourceUrl, dataset: payload.dataset, query: payload.query,
    features: payload.results.map(r => ({ type: 'Feature', id: r.id,
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] }, properties: { ...r } })) };
}
export function downloadFile(name, contents, mime) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
