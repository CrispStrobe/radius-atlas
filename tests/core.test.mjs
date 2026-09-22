// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { distanceKm, destination, referencePoint, project, unproject } from '../src/geo.js';
import { indexPlaces, searchPlaces, validateDataset } from '../src/data.js';
import { runQuery, parseTextQuery } from '../src/query.js';
import { makeExport, toCsv, toGeoJson, csvCell, postalCodesCsv } from '../src/exports.js';
const data = JSON.parse(await readFile(new URL('./fixtures/test-dataset.json', import.meta.url),'utf8'));
const places = indexPlaces(data.records);
const kehl = places.find(p => p.name === 'Kehl');
const base = { center: kehl, radiusKm: 30, countries: ['DE'], mode: 'places' };
function row(id, place, latitude, longitude, postalCode = '00001', country = 'DE', code = 'x') {
  return { id, place, latitude, longitude, postalCode, country, adminCodes:['x','x',code], adminArea1:'Region', adminArea2:'Area', adminArea3:'District', accuracy:1 };
}
test('isolated test dataset validates without claiming country completeness', () => { assert.equal(validateDataset(data), data); assert.equal(data.meta.coverage, 'illustrative-fixture'); });
test('invalid coordinates and duplicate IDs are rejected', () => {
  const bad = structuredClone(data); bad.records[0].latitude = 100; assert.throws(() => validateDataset(bad));
  const dup = structuredClone(data); dup.records.push(dup.records[0]); assert.throws(() => validateDataset(dup));
});
test('distance: identical points, antipodes, symmetry', () => {
  const a = {latitude:0,longitude:0}, b = {latitude:0,longitude:180};
  assert.equal(distanceKm(a,a),0); assert.ok(Math.abs(distanceKm(a,b)-20015.114442) < .001); assert.equal(distanceKm(a,b),distanceKm(b,a));
});
test('reference point is spherical and duplicate coordinates do not add weight', () => {
  const a = {latitude:0,longitude:179}, b = {latitude:0,longitude:-179};
  assert.ok(Math.abs(referencePoint([a,b]).longitude) > 179.9);
  assert.deepEqual(referencePoint([a,a,b]), referencePoint([a,b]));
});
test('Web Mercator forward/inverse roundtrip', () => {
  const point={latitude:48.5725,longitude:7.8131}; const round=unproject(project(point,10),10);
  assert.ok(Math.abs(point.latitude-round.latitude)<1e-10); assert.ok(Math.abs(point.longitude-round.longitude)<1e-10);
});
test('radius boundary is inclusive; just-outside records excluded', () => {
  const origin = {latitude:48,longitude:8};
  const pts = indexPlaces([row('a','Boundary',...Object.values(destination(origin,30,90))), row('b','Outside',...Object.values(destination(origin,30.001,90)))]);
  const answer = runQuery(pts,{...base,center:origin,mode:'postal-points'});
  assert.deepEqual(answer.results.map(r=>r.id),['a']);
});
test('place-first includes outlying PLZ; point mode does not', () => {
  const origin={latitude:0,longitude:0};
  const near=destination(origin,10,90), far=destination(origin,40,90);
  const grouped=indexPlaces([row('a','Example',near.latitude,near.longitude,'00001'),row('b','Example',far.latitude,far.longitude,'00002')]);
  const a=runQuery(grouped,{...base,center:origin}), b=runQuery(grouped,{...base,center:origin,mode:'postal-points'});
  assert.equal(a.results.length,2); assert.equal(a.results[1].pointInsideRadius,false); assert.equal(b.results.length,1);
});
test('namesakes in different administrative areas stay separate', () => {
  const p=indexPlaces([row('a','Neustadt',49,8,'12345','DE','a'),row('b','Neustadt',50,9,'12346','DE','b')]); assert.equal(p.length,2);
  assert.throws(()=>parseTextQuery('within 30 km of Neustadt',p,['DE']),/ambiguous/);
});
test('accent-insensitive search does not merge identity', () => {
  assert.equal(searchPlaces(places,'Willstatt')[0].name,'Willstätt');
  assert.equal(indexPlaces([row('a','A-B',49,8),row('b','A B',49,8)]).length,2);
});
test('country filtering and postal code namespace', () => {
  const p=indexPlaces([row('a','One',0,0,'12345','DE'),row('b','Two',0,0,'12345','FR')]);
  assert.equal(runQuery(p,{...base,center:{latitude:0,longitude:0}}).results.length,1);
  assert.equal(runQuery(p,{...base,center:{latitude:0,longitude:0},countries:['DE','FR']}).uniquePostalCodes.length,2);
});
test('zero radius works and negative/NaN radius fails', () => {
  assert.ok(runQuery(places,{...base,radiusKm:0}).results.some(r=>r.place==='Kehl'));
  for(const radiusKm of [-1,NaN,501]) assert.throws(()=>runQuery(places,{...base,radiusKm}));
  assert.throws(()=>runQuery(places,{...base,countries:[]}));
});
test('postal codes are unique per country in condensed output', () => {
  const ans=runQuery(places,{...base,countries:['DE','FR']}); const keys=ans.uniquePostalCodes.map(p=>`${p.country}:${p.postalCode}`); assert.equal(keys.length,new Set(keys).size);
});
test('all matching Offenburg postal records appear', () => { assert.equal(runQuery(places,base).results.filter(r=>r.place==='Offenburg').length,3); });
test('English and German shortcuts use explicit kilometres', () => {
  assert.equal(parseTextQuery('all PLZ within 30 km of Kehl',places,['DE']).radiusKm,30);
  assert.equal(parseTextQuery('alle PLZ im Umkreis von 30,5 km um Kehl',places,['DE']).radiusKm,30.5);
  assert.throws(()=>parseTextQuery('within 30 miles of Kehl',places,['DE']));
  assert.throws(()=>parseTextQuery('within 30 km driving distance of Kehl',places,['DE']));
  assert.throws(()=>parseTextQuery('within 30 km or 40 km of Kehl',places,['DE']));
  assert.throws(()=>parseTextQuery('within -1 km of Kehl',places,['DE']));
});
test('French radius shortcut resolves a unique place', () => {
  const parsed=parseTextQuery('Tous les codes postaux dans un rayon de 30 km autour de Kehl',places,['DE','FR']);
  assert.equal(parsed.center.name,'Kehl'); assert.equal(parsed.radiusKm,30);
});
test('CSV escaping, BOM, CRLF and formula injection prevention', () => {
  assert.equal(csvCell('a,"b"'),'"a,""b"""'); assert.equal(csvCell('line\nbreak'),'"line\nbreak"');
  for(const s of ['=SUM(1)',' +1','@evil','-cmd','\t=1']) assert.ok(csvCell(s).startsWith("'"));
  const payload=makeExport(data,base,runQuery(places,base),'2026-09-22T00:00:00Z');
  const csv=toCsv(payload); assert.ok(csv.startsWith('\uFEFFcountry,postalCode')); assert.ok(csv.includes('\r\n')); assert.ok(csv.includes('attribution'));
  assert.ok(toCsv(payload,';').startsWith('\uFEFFcountry;postalCode')); assert.ok(postalCodesCsv(payload).includes('coverage'));
});
test('leading zeros preserved as strings and metadata embedded', () => {
  const dresden=places.find(p=>p.name==='Dresden'), q={...base,center:dresden,radiusKm:1};
  const payload=makeExport(data,q,runQuery(places,q)); assert.equal(payload.results[0].postalCode,'01067');
  assert.ok(toCsv(payload).includes(',01067,')); assert.equal(payload.license,'CC-BY-4.0'); assert.equal(payload.query.mode,'places');
});
test('GeoJSON uses longitude, latitude order and all results', () => {
  const payload=makeExport(data,base,runQuery(places,base)); const g=toGeoJson(payload);
  assert.equal(g.features.length,payload.results.length); assert.deepEqual(g.features[0].geometry.coordinates,[payload.results[0].longitude,payload.results[0].latitude]);
  assert.ok(g.attribution); assert.ok(g.dataset.coverage);
});
test('empty queries still produce valid JSON and a CSV header', () => {
  const q={...base,center:{latitude:0,longitude:0},radiusKm:1}; const p=makeExport(data,q,runQuery(places,q));
  assert.equal(p.results.length,0); assert.equal(toCsv(p).split('\r\n').length,2); assert.equal(toGeoJson(p).features.length,0);
});
test('CSV retains real negative numbers but guards negative-looking formula strings', () => {
  assert.equal(csvCell(-3.1), '-3.1'); assert.equal(csvCell('-cmd'), "'-cmd");
});
test('text query rejects multiple unrelated place names', () => {
  assert.throws(() => parseTextQuery('within 30 km of Kehl and Berlin', places, ['DE']), /More than one location/);
});
