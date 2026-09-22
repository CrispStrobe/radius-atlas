# Radius Atlas

**Find postal localities within a radius, see them on a map, and export structured results.**

A dependency-free, static web application prepared for GitHub Pages and Vercel. It runs
spatial queries and file exports in the browser. There is no runtime database,
account system, API key, external geocoder or AI service.

The repository deliberately contains no deployable postal dataset. Production
builds obtain Germany and France data directly from GeoNames, and fail rather than
substitute test data. The live GitHub Pages deployment currently serves the
country-file import.

## Run locally

Install Node.js 22 or later, then run:

```sh
npm run data:refresh
npm run dev
```

Open `http://localhost:3000`. No `npm install` is needed: this project has no package
dependencies. It must be served over HTTP, not opened as a `file://` document.

The initial query is Kehl, 30 km, Germany, place-reference-point mode. Enable
France to run a cross-border query.

## Full dataset

```sh
npm run data:refresh
npm run dev
```

The importer fetches `DE.zip`, `FR.zip` and the GeoNames postal README. It validates
postal codes and coordinates, removes exact duplicate records, records rejected
rows, assigns stable hashed IDs, and writes `public/data/dataset.json`.

Each archive is recorded with its source URL, SHA-256 and HTTP `Last-Modified`
when available. The fetched README is archived beside the dataset. The retrieval
date does not mean every source record was updated that day.

The importer retries transient downloads. It **fails loudly** if downloads, ZIP
integrity, expected minimum record counts, or data-quality thresholds fail.

The current schema accepts ordinary five-digit German and French postcodes.
GeoNames rows labelled as CEDEX or other non-five-digit routing codes are counted
as intentionally unsupported and excluded; malformed coordinates and rows are
reported separately as rejected records.

For a Germany-only import on macOS/Linux:

```sh
COUNTRIES=DE npm run data:refresh
```

PowerShell:

```powershell
$env:COUNTRIES="DE"
npm run data:refresh
```

To use files already downloaded from GeoNames, put `DE.zip`, `FR.zip` and
`readme.txt` in a directory and set `GEONAMES_RAW_DIR` to that directory. This uses
the same ZIP parser and validation pipeline without fetching files.

```sh
GEONAMES_RAW_DIR=/absolute/path/to/geonames npm run data:refresh
```

Full source files: https://download.geonames.org/export/zip/

“Country files” means all accepted rows in the downloaded source files, not a
guarantee that GeoNames covers every actual delivery postcode or municipality.

## Deploy on GitHub Pages

The included `.github/workflows/pages.yml` tests the app, imports the full Germany
and France GeoNames files, builds `dist`, and deploys it on every push to `main`.
It can also be started manually from the repository's **Actions** tab.

1. Push this folder to a GitHub repository with `main` as its default branch.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main`, or run **Deploy GitHub Pages** from **Actions**.

The app uses relative asset and data URLs, so both `https://user.github.io/` and
project sites such as `https://user.github.io/radius-atlas/` work without a
hard-coded repository name. A `.nojekyll` file is included in each build.

The production workflow deliberately fails if the GeoNames import fails. For a
reproducible deployment, run `npm run data:refresh`, review and commit the generated
dataset and source notice, then change the workflow command from `npm run build:full`
to `npm run build`.

## Deploy on Vercel

Publish this folder as a GitHub repository and import it into Vercel. The included
`vercel.json` specifies:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js | 22.x (select in project settings if necessary) |
| Install command | `node --version` |
| Build command | `npm run build:full` |
| Output directory | `dist` |

`build:full` imports the country files and then builds the static assets.

For reproducible, network-independent deployments, run `npm run data:refresh`
locally, review and commit the generated snapshot and source notice, then change
`vercel.json`'s build command to `npm run build`. Each deployment will then use the
reviewed committed snapshot. Keep provenance and license notices with the data.

Queries use URL parameters at `/`, so no SPA catch-all rewrite is necessary.
Static JSON and application assets are same-origin. Tile images come directly from
the selected provider. Do not put secret tokens in the public configuration.

## Publish the GitHub repository

From this folder, using the GitHub CLI after authenticating:

```sh
git init -b main
git add .
git commit -m "Initial Radius Atlas app"
gh repo create radius-atlas --public --source=. --remote=origin --push
```

The canonical repository is https://github.com/CrispStrobe/radius-atlas and the
live deployment is https://crispstrobe.github.io/radius-atlas/.

## What the app does

- Location/postcode search with disambiguating administrative labels, 0–500 km
  radius, Germany/France filters, shareable query links, and map-picked centers.
- Interactive map: pan, zoom, keyboard controls, geodesic radius outline, result
  markers, place labels, click details, and optional street tiles.
- Two explicit selection rules (below); distance-sorted, searchable, paginated
  result table; unambiguous country-scoped postcode deduplication.
- CSV, JSON, GeoJSON and unique-PLZ CSV exports, with source credits and coverage
  information. Full CSV and JSON include query context and provenance.
- A small English/German/French convenience parser, for example
  `all PLZ within 30 km of Kehl` or
  `alle PLZ im Umkreis von 30 km um Kehl` or
  `tous les codes postaux dans un rayon de 30 km autour de Kehl`. This is not
  general natural-language AI.
- English, German and French interface localization selected from the header,
  persisted locally and included in shareable query URLs. The convenience parser
  also accepts equivalent French radius wording.

## What “within 30 km” means

**Places → all their known PLZ:** group records by country, administrative fields
and exact postal-locality name. Derive a spherical mean of each group's distinct
coordinates. Select groups whose reference point is at most the requested radius
away. Return every known postal record in those groups, even where an individual
postal point is outside the circle. Those rows are marked explicitly.

**Postal points → only inside radius:** test each original postal coordinate.
Return only those inside the circle. The map shows those postal points.

Both use a spherical Haversine calculation with mean Earth radius 6371.0088 km.
They are approximate straight-line distances, not WGS84 ellipsoidal survey-grade
measurements, road distance, or travel time.

**Postal locality ≠ political municipality.** This version does not promise the
exact earlier requirement “all PLZ of all political municipalities.” In Germany,
GeoNames postal `admin3` is often a district, not an eight-digit AGS. The app never
promotes it to a municipal identifier. Separate place names belonging to one
municipality are not automatically merged. See [method and next layer](docs/method.md).

No municipal boundaries or postal-area polygons are bundled. The GeoJSON export
contains points, not municipality polygons. Source coordinates may be estimated.

## Export contract

One full-results row per accepted source postal record. Several records can share
a PLZ; the `uniquePostalCodes` array uses `(country, postalCode)` as the key.
Records include original postal coordinates, derived place-reference coordinates,
both distances, source accuracy where supplied, and `pointInsideRadius`.

JSON additionally contains the complete query, source provenance, attribution,
license and source coverage. CSV repeats source and query information in columns.
The PLZ-only CSV includes attribution but intentionally omits detailed query fields;
keep its companion full JSON for an auditable query. Empty full CSV results contain
headers only: use JSON to retain metadata for an empty result.

CSV is UTF-8 with BOM and CRLF, supports comma or semicolon, escapes delimiters and
quotes, and prefixes potentially dangerous spreadsheet formula cells. PLZ values
are never converted to integers. **Spreadsheet applications can still strip
leading zeros unless the column is imported as text.** JSON preserves the string
unambiguously. The table filter and pagination never limit exported matches.

## Licensing

| Layer | License / status |
| --- | --- |
| Original code, tests, tooling, HTML, CSS | MIT |
| Original README and documentation | CC BY 4.0 |
| Imported GeoNames postal data | CC BY 4.0 per upstream source notice |
| Optional OSM basemap | Separate OSM attribution and provider terms; not in exports |

Creative Commons recommends software-specific licenses for program code:
https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software

The source data and documentation can use attribution-oriented CC licenses while
the code uses MIT. Do not place a single blanket CC notice over third-party data.
If you later introduce OpenPLZ/OSM-derived data, assess the ODbL obligations and do
not simply relabel that database as CC BY-SA. See `LICENSE-DATA.md` and
`THIRD_PARTY_NOTICES.md`.

## Basemap, privacy and public deployment

Edit `public/config.json` to select a tile provider. The default is the standard
OpenStreetMap tile endpoint. This does **not** mean unlimited free tile hosting.
Read https://operations.osmfoundation.org/policies/tiles/ and use a provider/service
appropriate for your public traffic and operational requirements. There is no SLA
for the community tile service. Keep required attribution visible, and publish an
operator contact and privacy information appropriate to your deployment.

Only visible tiles are requested. No prefetch, scraping, tile archive, offline-map
download or cache bypass is implemented. The normal browser HTTP cache is used.
The referrer policy preserves the referring origin. The map provides a points-only
mode; country queries and exports do not need tiles to load. Pending tile requests
may finish after tiles are switched off; no new ones are scheduled.

Query text is not sent to an AI or geocoder. Loading the application and sharing
query URLs still exposes normal URL/request information to the hosting provider;
the tile provider receives IP/referrer and tile-area information. “Browser-side”
does not mean that hosting or third-party tiles involve no network or logs.

## Verification

```sh
npm test
npm run check
npm run build:full
npm start
```

Unit tests exercise radius boundaries, coordinates, country filtering, namesakes,
place-first versus point-first selection, leading-zero PLZ, CSV injection defence,
export provenance, ZIP parsing/CRC, duplicate detection and validation.
They always use an isolated fixture under `tests/`, which is never copied into a
site build. GitHub Actions imports the country files before verifying the build.

Optional browser smoke test, with Python 3 and Playwright installed:

```sh
python -m pip install playwright
python -m playwright install chromium
npm run dev
# In a second terminal:
python tests/browser-smoke.py
```

The smoke test disables external street tiles, checks controls and exports, and
saves desktop/mobile screenshots under `test-results/`. It does not scrape OSM.

## Project layout

```text
index.html                  Accessible query/map/results interface
src/geo.js                  Spherical distances and map projection
src/data.js                 Dataset validation and locality index
src/query.js                Selection engine and simple text parser
src/exports.js              CSV / JSON / GeoJSON and source metadata
src/map.js                  Canvas slippy map, no external JS dependency
src/app.js                  UI interactions
scripts/refresh-data.mjs    Country downloads and import pipeline
scripts/import-geonames.mjs GeoNames TSV parser and data provenance
scripts/zip.mjs             Bounded ZIP reader, CRC verification
scripts/build.mjs           Static output → dist/
public/config.json         Public tile configuration
public/data/               Generated dataset and source notice (gitignored)
vercel.json                Production build and security headers
tests/                     Unit and optional browser tests
docs/                      Semantics, deployment limitations and QA
```

The current suite contains **32 unit and repository checks**. The production
GitHub Actions workflow also imports GeoNames and deploys the generated site.
To run the optional browser suite without live network requests:

```sh
ISOLATED_DOM=1 python tests/browser-smoke.py
```

## Operational limits and extensions

Country JSON is loaded as one snapshot and indexed in memory in each browser.
Queries scan that index; there is no server-side spatial index or vector-tile
backend. The map caps visible context markers at 2,500 and matched markers at
3,000, while the table and exports retain every result. Large-country performance
and assistive-technology accessibility have not been benchmarked or certified.
For wider coverage or many polygons, use country-partitioned assets, a spatial
index/worker, or a spatial database as a deliberate next step.

For exact political-municipality queries, replace postal-locality grouping with
an authoritative municipality identifier and a documented municipality-to-PLZ
crosswalk. Choose official reference points or municipality-boundary intersection
explicitly; do not infer municipalities from a shared place name. Keep each
upstream license attached to that additional layer.
