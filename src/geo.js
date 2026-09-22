// SPDX-License-Identifier: MIT
/** Spherical great-circle calculations. Coordinates use WGS84 decimal degrees. */
export const EARTH_KM = 6371.0088;
const rad = value => value * Math.PI / 180;
const deg = value => value * 180 / Math.PI;
export function assertCoordinate(point) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
    throw new RangeError('Coordinates must be finite: latitude −90…90; longitude −180…180.');
  }
}
export function distanceKm(a, b) {
  assertCoordinate(a); assertCoordinate(b);
  const dlat = rad(b.latitude - a.latitude), dlon = rad(b.longitude - a.longitude);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function destination(origin, km, bearing) {
  assertCoordinate(origin);
  const d = km / EARTH_KM, b = rad(bearing), p = rad(origin.latitude), l = rad(origin.longitude);
  const lat = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b));
  const lon = l + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(lat));
  return { latitude: deg(lat), longitude: ((deg(lon) + 540) % 360) - 180 };
}
/** Unique-coordinate spherical mean: never advertised as a municipal centroid. */
export function referencePoint(points) {
  if (!points.length) throw new Error('A place needs at least one coordinate.');
  const unique = [...new Map(points.map(p => [`${p.latitude},${p.longitude}`, p])).values()];
  let x = 0, y = 0, z = 0;
  for (const p of unique) {
    assertCoordinate(p);
    x += Math.cos(rad(p.latitude)) * Math.cos(rad(p.longitude));
    y += Math.cos(rad(p.latitude)) * Math.sin(rad(p.longitude));
    z += Math.sin(rad(p.latitude));
  }
  if (Math.hypot(x, y, z) < 1e-12) return { latitude: unique[0].latitude, longitude: unique[0].longitude };
  return { latitude: deg(Math.atan2(z, Math.hypot(x, y))), longitude: deg(Math.atan2(y, x)) };
}
export function project(point, zoom) {
  const size = 256 * 2 ** zoom;
  const lat = rad(Math.max(-85.05112878, Math.min(85.05112878, point.latitude)));
  return { x: (point.longitude + 180) / 360 * size, y: (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * size };
}
export function unproject(point, zoom) {
  const size = 256 * 2 ** zoom;
  return { latitude: deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y / size)))), longitude: ((point.x / size * 360) % 360 + 360) % 360 - 180 };
}
