#!/usr/bin/env python3
"""Optional Chromium smoke test. Run npm run dev first. Never requests OSM tiles."""
import csv
import io
import json
import os
import re
from pathlib import Path
import shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('BASE_URL', 'http://localhost:3000').rstrip('/')
ISOLATED = os.environ.get('ISOLATED_DOM') == '1'
results = []
def check(label, condition):
    if not condition:
        raise AssertionError(label)
    results.append(label)

def download(page, kind):
    with page.expect_download() as info:
        page.locator(f'[data-export="{kind}"]').click()
    item = info.value
    path = OUT / item.suggested_filename
    item.save_as(path)
    return path.read_text(encoding='utf-8-sig')

def load(page, query='?tiles=off'):
    if not ISOLATED:
        page.goto(BASE + '/' + query)
        return
    # Isolated renderer mode: original module bodies, mocked HTTP and location.
    # Useful in managed browsers that do not permit navigation. Does NOT test
    # HTTP serving, ES-module loading, hosting headers, clipboard or live tiles.
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
    html = re.sub(r'<link[^>]*>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'src/styles.css').read_text())
    config = json.loads((ROOT / 'public/config.json').read_text())
    config['tilesEnabled'] = False
    dataset = json.loads((ROOT / 'public/data/dataset.json').read_text())
    prefix = "(() => { const __modules = {}; const location = new URL(" + json.dumps(BASE + '/' + query) + "); window.__testLocation = location; const history = { replaceState(_a,_b,url) { location.href = url; } }; const __data = " + json.dumps(dataset) + "; const __config = " + json.dumps(config) + "; const fetch = async (url) => new Response(JSON.stringify(String(url).endsWith('/data/dataset.json') || url === './data/dataset.json' ? __data : __config), {status:200}); "
    parts = [prefix]
    for name in ['geo','data','query','exports','map','app']:
        code = (ROOT / f'src/{name}.js').read_text()
        exports = re.findall(r'^export (?:function|class|const) (\w+)', code, flags=re.M)
        code = re.sub(r"import \{([^}]+)\} from '\./([^']+)\.js';", lambda m: 'const {' + m[1] + '} = __modules[' + json.dumps(m[2]) + '];', code)
        code = re.sub(r'^export ', '', code, flags=re.M)
        parts.append('__modules[' + json.dumps(name) + '] = (() => {\n' + code + '\nreturn {' + ','.join(exports) + '}; })();')
    parts.append('})();')
    page.add_script_tag(content='\n'.join(parts))

def current_url(page):
    return page.evaluate('window.__testLocation.href') if ISOLATED else page.url

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, accept_downloads=True)
    errors = []
    external = []
    def route_request(route):
        url = route.request.url
        if urlparse(url).netloc == urlparse(BASE).netloc:
            route.continue_()
        else:
            external.append(url)
            route.abort()
    context.route('**/*', route_request)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page)
    page.wait_for_function("document.getElementById('metric-records').textContent !== '—'")
    check('Default query renders results', int(page.locator('#metric-records').inner_text()) > 0)
    check('Fixture warning is visible', page.locator('#coverage-warning').is_visible())
    check('Tiles disabled for browser test', not page.locator('#tiles-toggle').is_checked())
    check('No desktop document overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
    baseline = json.loads(download(page, 'json'))
    check('JSON contains query and honest fixture provenance', baseline['query']['radiusKm'] == 30 and baseline['dataset']['coverage'] == 'illustrative-fixture')
    check('JSON counts match actual records', baseline['counts']['postalRecords'] == len(baseline['results']))
    text = download(page, 'csv')
    rows = list(csv.DictReader(io.StringIO(text)))
    check('CSV contains every result and credits', len(rows) == len(baseline['results']) and all(row['attribution'] for row in rows))
    page.locator('#result-filter').fill('Kehl')
    filtered = list(csv.DictReader(io.StringIO(download(page, 'csv'))))
    check('Table filter does not silently truncate exports', len(filtered) == len(rows))
    page.locator('#result-filter').fill('')
    geojson = json.loads(download(page, 'geojson'))
    check('GeoJSON coordinates use longitude then latitude', all(f['geometry']['coordinates'] == [f['properties']['longitude'], f['properties']['latitude']] for f in geojson['features']))
    page.locator('#csv-delimiter').select_option(';')
    unique = list(csv.DictReader(io.StringIO(download(page, 'codes')), delimiter=';'))
    check('Unique PLZ CSV supports semicolon and deduplication', len(unique) == baseline['counts']['uniquePostalCodes'] and len({(r['country'], r['postalCode']) for r in unique}) == len(unique))
    page.locator('[name=country][value=FR]').check()
    page.locator('#run-query').click()
    both = json.loads(download(page, 'json'))
    check('France can be explicitly included', any(r['country'] == 'FR' for r in both['results']) and both['counts']['postalRecords'] > baseline['counts']['postalRecords'])
    page.locator('#mode').select_option('postal-points')
    page.locator('#radius').fill('10')
    page.locator('#run-query').click()
    nearby = json.loads(download(page, 'json'))
    check('Postal-point rule respects radius', nearby['query']['mode'] == 'postal-points' and all(r['postalPointDistanceKm'] <= 10.000001 for r in nearby['results']))
    page.locator('.query-shortcut summary').click()
    page.locator('#text-query').fill('Alle PLZ im Umkreis von 30 km um Kehl')
    page.locator('#parse-query').click()
    check('German text shortcut sets radius', page.locator('#radius').input_value() == '30')
    check('Shared URL carries query state', 'countries=DE%2CFR' in current_url(page) and 'mode=postal-points' in current_url(page))
    page.locator('#place-search').fill('Dresden')
    page.locator('#suggestions button').first.click()
    page.locator('#radius').fill('1')
    page.locator('#run-query').click()
    dresden = json.loads(download(page, 'json'))
    check('Leading-zero PLZ preserved as JSON string', dresden['results'][0]['postalCode'] == '01067')
    codes = list(csv.DictReader(io.StringIO(download(page, 'codes')), delimiter=';'))
    check('Leading-zero PLZ preserved in CSV text', codes[0]['postalCode'] == '01067')
    page.locator('#about-button').click()
    check('Source/method dialog is usable', page.locator('#about').is_visible() and 'illustrative-fixture' in page.locator('#metadata').inner_text())
    page.keyboard.press('Escape')
    check('Method dialog closes with Escape', not page.locator('#about').is_visible())
    page.locator('#pick-center').click()
    box = page.locator('#map').bounding_box()
    page.mouse.click(box['x'] + box['width'] * .53, box['y'] + box['height'] * .49)
    check('Map pick applies a new geographic center', page.locator('#place-search').input_value() == 'Map point')
    chosen = json.loads(download(page, 'json'))
    check('Map inverse projection stays near selected city', abs(chosen['query']['center']['longitude'] - 13.73) < .2)
    load(page, '?tiles=off&lat=999&lon=8')
    page.wait_for_function("document.getElementById('metric-records').textContent !== '—'")
    check('Malformed shared coordinate is rejected', 'Invalid shared query' in page.locator('#notice').inner_text())
    load(page)
    page.wait_for_function("document.getElementById('metric-records').textContent !== '—'")
    page.set_viewport_size({'width': 390, 'height': 844})
    load(page)
    page.wait_for_function("document.getElementById('metric-records').textContent !== '—'")
    page.wait_for_timeout(300)
    check('No mobile document overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
    page.locator('#radius').fill('5')
    page.locator('#run-query').click()
    check('Mobile query controls work', page.locator('#metric-radius').inner_text() == '5')
    check('No uncaught browser JavaScript errors', not errors)
    check('No external network requests during automated testing', not external)
    context.close()
    browser.close()

report = {'status': 'passed', 'checks': len(results), 'mode': 'isolated-renderer-mocked-fetch-and-location' if ISOLATED else 'http-browser', 'passed': results, 'scope': 'Illustrative preview fixture only; tiles off. No live GeoNames import or Vercel deployment was tested.'}
(OUT / 'browser-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
