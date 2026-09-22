// SPDX-License-Identifier: MIT
import { validateDataset, indexPlaces, searchPlaces, normalize } from './data.js';
import { runQuery, parseTextQuery } from './query.js';
import { makeExport, toCsv, postalCodesCsv, toGeoJson, downloadFile } from './exports.js';
import { RadiusMap } from './map.js';
import { initialLocale, locale, setLocale, t, translateDocument } from './i18n.js';
const $ = id => document.getElementById(id);
setLocale(initialLocale());
translateDocument();
$('language').value = locale;
const state = { dataset: null, places: [], center: null, answer: null, payload: null, page: 0, suggestions: [], map: null };
const PAGE_SIZE = 30;
const number = n => n.toLocaleString(locale);
function notice(message, success = false) { $('notice').textContent = t(message); $('notice').hidden = !message; $('notice').classList.toggle('success', success); }
function countries() { return [...document.querySelectorAll('input[name=country]:checked')].map(e => e.value); }
function selectedCenter(place) {
  state.center = { name: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude, id: place.id ?? null };
  $('place-search').value = place.name;
  $('center-meta').textContent = `${place.country || 'MAP'} · ${Math.abs(place.latitude).toFixed(5)}° ${place.latitude < 0 ? 'S' : 'N'}, ${Math.abs(place.longitude).toFixed(5)}° ${place.longitude < 0 ? 'W' : 'E'}`;
  $('suggestions').hidden = true; $('place-search').setAttribute('aria-expanded', 'false');
}
function currentQuery() {
  if (!state.center) throw new Error('Choose a starting location first.');
  if ($('place-search').value.trim() !== state.center.name) {
    const candidates = searchPlaces(state.places, $('place-search').value, state.dataset.meta.countries, 30)
      .filter(p => p.searchName === normalize($('place-search').value) || p.postalCodes.includes($('place-search').value.trim()));
    if (candidates.length !== 1) throw new Error('Select the intended place from the search suggestions.');
    selectedCenter(candidates[0]);
  }
  const raw = $('radius').value;
  if (!raw.trim()) throw new Error('Enter a radius in kilometres.');
  return { center: { ...state.center }, radiusKm: Number(raw), mode: $('mode').value, countries: countries() };
}
function applyQuery(fit = true) {
  try {
    const query = currentQuery();
    state.answer = runQuery(state.places, query); state.payload = makeExport(state.dataset, query, state.answer); state.page = 0;
    $('metric-places').textContent = number(state.answer.placeCount);
    $('metric-codes').textContent = number(state.answer.uniquePostalCodes.length);
    $('metric-records').textContent = number(state.answer.results.length);
    $('metric-radius').textContent = number(query.radiusKm);
    $('map-title').textContent = t('Around {place}', { place: query.center.name });
    $('map-info').textContent = `${query.radiusKm} km · ${query.countries.join(' + ')} · ${t(query.mode === 'places' ? 'place reference points' : 'postal points')}`;
    $('map-popup').hidden = true;
    $('rule-help').textContent = query.mode === 'places'
      ? t('Select Swiss municipalities and other postal localities by their derived reference point, then include every assigned postal record.')
      : t('Select only individual postal-record coordinates inside the radius. This is not a postal-area boundary intersection.');
    state.map.setData(query, state.answer, state.places, fit);
    $('result-filter').value = ''; renderTable();
    document.querySelectorAll('[data-export]').forEach(b => b.disabled = false); $('share').disabled = false;
    updateUrl(query); notice('');
    if (state.answer.markers.length > 3000) notice('The map draws at most 3,000 visible result markers. The table and exports include every match.', true);
  } catch (e) { notice(e.message); }
}
function updateUrl(query) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries({ lat: query.center.latitude.toFixed(7), lon: query.center.longitude.toFixed(7),
    name: query.center.name, r: query.radiusKm, mode: query.mode, countries: query.countries.join(',') })) url.searchParams.set(k, v);
  history.replaceState(null, '', url);
}
function renderTable() {
  if (!state.answer) return;
  const term = normalize($('result-filter').value);
  const all = state.answer.results.filter(r => !term || normalize(`${r.place} ${r.postalCode} ${r.country}`).includes(term));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE)); state.page = Math.min(state.page, pages - 1);
  const rows = all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  const tbody = $('result-rows'); tbody.replaceChildren();
  if (!rows.length) { const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 5; td.textContent = t('No matches. Try a larger radius, different countries or another table filter.'); }
  for (const row of rows) {
    const tr = tbody.insertRow();
    tr.insertCell().textContent = row.place;
    tr.insertCell().textContent = row.postalCode;
    const country = document.createElement('span'); country.className = 'table-country'; country.textContent = row.country; tr.insertCell().append(country);
    const dist = tr.insertCell(); dist.className = 'align-right distance-cell'; dist.textContent = `${row.distanceKm.toFixed(2)} km`;
    if (!row.pointInsideRadius) { const note = document.createElement('span'); note.className = 'outside'; note.textContent = t('PLZ point outside'); note.title = t('Included through the selected locality reference point; its individual postal point lies outside the radius.'); dist.append(note); }
    const coordinates = tr.insertCell(); coordinates.className = 'coordinate-column'; coordinates.textContent = `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`;
  }
  $('table-count').textContent = all.length ? t('{from}–{to} of {count} records', { from: state.page * PAGE_SIZE + 1, to: Math.min((state.page + 1) * PAGE_SIZE, all.length), count: number(all.length) }) : t('0 records');
  $('page-count').textContent = `${state.page + 1} / ${pages}`;
  $('previous-page').disabled = state.page === 0; $('next-page').disabled = state.page === pages - 1;
}
function updateSuggestions() {
  const matches = searchPlaces(state.places, $('place-search').value, state.dataset.meta.countries, 10); state.suggestions = matches;
  const list = $('suggestions'); list.replaceChildren();
  for (const place of matches) {
    const button = document.createElement('button'); button.type = 'button'; button.role = 'option';
    button.textContent = `${place.name} · ${place.country}`;
    const sub = document.createElement('small'); sub.textContent = `${place.postalCodes.slice(0, 5).join(', ')} · ${place.adminArea3 || place.adminArea1 || ''}`; button.append(sub);
    button.addEventListener('click', () => { selectedCenter(place); $('place-search').focus(); });
    button.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); button.nextElementSibling?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (button.previousElementSibling || $('place-search')).focus(); }
      if (e.key === 'Escape') { list.hidden = true; $('place-search').setAttribute('aria-expanded', 'false'); $('place-search').focus(); }
    });
    list.append(button);
  }
  list.hidden = !matches.length; $('place-search').setAttribute('aria-expanded', String(!!matches.length));
}
async function loadJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return response.json();
}
function safeHttpUrl(value, fallback) {
  try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback; } catch { return fallback; }
}
async function init() {
  try {
    const [dataset, rawConfig, build] = await Promise.all([
      loadJson('./data/dataset.json'),
      loadJson('./config.json'),
      loadJson('./build-info.json').catch(() => ({ version: '1.0.0', commit: 'development', ref: '', builtAt: '' }))
    ]);
    state.dataset = validateDataset(dataset); state.places = indexPlaces(dataset.records);
    const config = { ...rawConfig };
    if (!/^https:\/\//.test(config.tileUrl) || !['{z}', '{x}', '{y}'].every(s => config.tileUrl.includes(s))) config.tilesEnabled = false;
    if (new URLSearchParams(location.search).get('tiles') === 'off') config.tilesEnabled = false;
    $('tiles-toggle').checked = config.tilesEnabled;
    if (!config.tilesEnabled) $('basemap-status').textContent = t('Points-only map · street tiles disabled');
    $('tile-attribution').textContent = config.tileAttribution;
    $('tile-attribution').href = safeHttpUrl(config.tileAttributionUrl, 'https://www.openstreetmap.org/copyright');
    state.map = new RadiusMap($('map'), { config,
      onStatus: message => { if (state.map?.config.tilesEnabled) $('basemap-status').textContent = t(message); },
      onSelect: marker => {
        $('popup-name').textContent = `${marker.name} · ${marker.country}`;
        $('popup-codes').textContent = marker.postalCodes.join(', ');
        $('popup-distance').textContent = t('{distance} km from query center', { distance: marker.distanceKm.toFixed(2) });
        $('map-popup').hidden = false;
      },
      onPick: point => {
        selectedCenter({ ...point, name: 'Map point' }); state.map.pick = false;
        $('map').classList.remove('picking'); $('pick-center').setAttribute('aria-pressed', 'false'); $('pick-center').textContent = t('⊕ Set center on map'); applyQuery(false);
      }
    });
    $('dataset-title').textContent = `${dataset.meta.source} · ${dataset.meta.countries.join(' + ')}`;
    $('dataset-meta').textContent = t('{count} records · {detail}', { count: number(dataset.records.length), detail: t('retrieved {date}', { date: dataset.meta.retrievedAt?.slice(0, 10) || t('date not specified') }) });
    $('metadata').textContent = JSON.stringify(dataset.meta, null, 2);
    $('build-version').textContent = build.version || 'unknown';
    $('build-ref').textContent = build.ref || '—';
    $('build-time').textContent = build.builtAt ? new Date(build.builtAt).toLocaleString(locale) : t('development build');
    const commit = String(build.commit || 'unknown');
    if (/^[0-9a-f]{40}$/i.test(commit)) {
      $('build-commit').textContent = commit.slice(0, 12);
      $('build-commit').href = `https://github.com/CrispStrobe/radius-atlas/commit/${commit}`;
    } else {
      $('build-commit').textContent = commit;
      $('build-commit').removeAttribute('href');
    }
    $('source-credit').textContent = dataset.meta.attribution;
    for (const input of document.querySelectorAll('input[name=country]')) {
      input.disabled = !dataset.meta.countries.includes(input.value);
      if (input.disabled) input.checked = false;
    }
    const center = state.places.find(p => p.name === 'Kehl' && p.country === 'DE') || state.places[0]; selectedCenter(center);
    let shareError = '';
    const params = new URLSearchParams(location.search);
    if (params.has('lat') || params.has('lon')) {
      try {
        if (!params.get('lat') || !params.get('lon')) throw new Error('Missing coordinate.');
        const candidate = { center: { name: (params.get('name') || 'Map point').slice(0, 120), latitude: Number(params.get('lat')), longitude: Number(params.get('lon')) },
          radiusKm: params.has('r') && params.get('r') !== '' ? Number(params.get('r')) : 30,
          mode: params.get('mode') || 'places', countries: (params.get('countries') || 'DE').split(',') };
        runQuery([], candidate);
        if (candidate.countries.some(c => !dataset.meta.countries.includes(c))) throw new Error('Country is not included in this data snapshot.');
        selectedCenter(candidate.center); $('radius').value = candidate.radiusKm; $('radius-slider').value = Math.min(candidate.radiusKm, 150); $('mode').value = candidate.mode;
        document.querySelectorAll('input[name=country]').forEach(input => input.checked = candidate.countries.includes(input.value));
      } catch (e) { shareError = `Invalid shared query; showing the default. ${e.message}`; }
    }
    $('run-query').disabled = false; applyQuery(); if (shareError) notice(shareError);
    $('place-search').addEventListener('input', updateSuggestions);
    $('place-search').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && !$('suggestions').hidden) { e.preventDefault(); $('suggestions').firstElementChild?.focus(); }
      if (e.key === 'Escape') { $('suggestions').hidden = true; $('place-search').setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('click', e => { if (!$('suggestions').contains(e.target) && e.target !== $('place-search')) { $('suggestions').hidden = true; $('place-search').setAttribute('aria-expanded', 'false'); } });
  } catch (e) {
    notice(`Startup failed: ${e.message} Run npm run data:refresh, then serve the app over HTTP.`);
    $('result-rows').replaceChildren(); const td = $('result-rows').insertRow().insertCell(); td.colSpan = 5; td.textContent = 'Dataset unavailable. See the error in the query panel.';
    $('dataset-title').textContent = 'Data unavailable';
  }
}
$('query-form').addEventListener('submit', e => { e.preventDefault(); applyQuery(); });
$('radius-slider').addEventListener('input', e => { $('radius').value = e.target.value; });
$('radius').addEventListener('input', e => { $('radius-slider').value = Math.min(150, Number(e.target.value)); });
$('mode').addEventListener('change', () => { $('rule-help').textContent = t($('mode').value === 'places' ? 'All known postcodes of a selected Swiss municipality or postal locality are returned; some individual postal points can be outside the radius.' : 'Only individual postal coordinates within the radius are returned. No area-boundary intersection is performed.'); });
$('language').addEventListener('change', e => {
  setLocale(e.target.value); location.reload();
});
$('parse-query').addEventListener('click', () => {
  try { if (!state.dataset) throw new Error('Wait for the dataset to load.'); const parsed = parseTextQuery($('text-query').value, state.places, countries());
    selectedCenter(parsed.center); $('radius').value = parsed.radiusKm; $('radius-slider').value = Math.min(150, parsed.radiusKm); applyQuery();
  } catch (e) { notice(e.message); }
});
$('result-filter').addEventListener('input', () => { state.page = 0; renderTable(); });
$('previous-page').addEventListener('click', () => { state.page--; renderTable(); });
$('next-page').addEventListener('click', () => { state.page++; renderTable(); });
$('zoom-in').addEventListener('click', () => state.map?.changeZoom(1));
$('zoom-out').addEventListener('click', () => state.map?.changeZoom(-1));
$('fit-map').addEventListener('click', () => state.map?.fit());
$('close-popup').addEventListener('click', () => $('map-popup').hidden = true);
$('pick-center').addEventListener('click', () => {
  if (!state.map) return; state.map.pick = !state.map.pick; $('map').classList.toggle('picking', state.map.pick);
  $('pick-center').setAttribute('aria-pressed', String(state.map.pick)); $('pick-center').textContent = state.map.pick ? 'Click a new center · Esc to cancel' : '⊕ Set center on map';
  if (state.map.pick) $('map').focus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.map?.pick) { state.map.pick = false; $('map').classList.remove('picking'); $('pick-center').setAttribute('aria-pressed', 'false'); $('pick-center').textContent = '⊕ Set center on map'; }
});
$('tiles-toggle').addEventListener('change', e => {
  if (!state.map) return; state.map.config.tilesEnabled = e.target.checked; state.map.drawSoon();
  $('basemap-status').textContent = e.target.checked ? 'Loading street basemap…' : 'Points-only map · no new tile requests';
});
$('share').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); notice('Query link copied. The link uses the data snapshot available on the deployed app.', true); }
  catch { notice('Clipboard access is unavailable. Copy the current address from your browser; it already contains the query.'); }
});
for (const id of ['about-button', 'data-button']) $(id).addEventListener('click', () => $('about').showModal());
$('close-about').addEventListener('click', () => $('about').close());
$('about').addEventListener('click', e => { if (e.target === $('about')) { const rect = $('about').getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) $('about').close(); } });
document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => {
  if (!state.payload) return;
  const payload = state.payload, prefix = `${normalize(payload.query.center.name).replaceAll(' ', '-')}-${payload.query.radiusKm}km-${payload.query.mode}`;
  const delimiter = $('csv-delimiter').value;
  switch (button.dataset.export) {
    case 'csv': downloadFile(`${prefix}.csv`, toCsv(payload, delimiter), 'text/csv;charset=utf-8'); break;
    case 'codes': downloadFile(`${prefix}-postal-codes.csv`, postalCodesCsv(payload, delimiter), 'text/csv;charset=utf-8'); break;
    case 'json': downloadFile(`${prefix}.json`, JSON.stringify(payload, null, 2), 'application/json'); break;
    case 'geojson': downloadFile(`${prefix}.geojson`, JSON.stringify(toGeoJson(payload), null, 2), 'application/geo+json'); break;
  }
}));
init();
