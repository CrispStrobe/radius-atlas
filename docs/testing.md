# Verification and delivery status

Verification recorded on 2026-09-22. Software tests use illustrative test data;
they do not establish the accuracy or completeness of actual postal geography.

## Successfully checked

- **26 Node.js unit tests**, with no package dependencies. These cover spherical
  distance and projection mathematics, boundary inclusion, record validation,
  selection semantics, country filtering, namesake disambiguation, unsupported
  text-query rejection, deduplication, export metadata, leading-zero PLZ,
  CSV escaping and formula defence, ZIP integrity and GeoNames TSV parsing.
- **JavaScript syntax checks** across source, scripts and unit tests.
- **Static build** from the bundled, clearly labelled 39-record fixture.
- **25 isolated Chromium renderer checks** using the original module bodies,
  with HTTP data fetches and browser location/history mocked. These exercise
  actual DOM controls, map drawing and coordinate picking, CSV/JSON/GeoJSON
  downloads, country filters, result filtering, shared-query state handling,
  the source dialog, and desktop/mobile layouts.
- **Local HTTP asset checks** for the index, entry module, configuration and data.

Desktop and mobile screenshots were rendered and visually reviewed. External
street tiles were disabled, and the automated browser run made no external
network requests. The points-only map is the real application renderer, not an
artist's mockup.

## Not verified here

The environment blocked outbound country-file downloads and normal Chromium
navigation. As a result, **live GeoNames country downloads, full-country runtime
performance, normal HTTP browser module loading, actual OpenStreetMap tile
rendering, clipboard integration, Vercel security headers, and a live Vercel
build/deployment have not been verified**. No remote GitHub repository has been
created. The included national importer is tested at the ZIP/TSV component level,
not against an actual downloaded country archive in this environment.

No claim of comprehensive accessibility certification or browser compatibility
is made. The app provides labels, a keyboard-accessible map and a table alternative,
but has not had a formal accessibility audit.

## Reproduce the checks

```sh
npm test
npm run check
npm run build
npm start
```

With Python and Playwright installed, run this in a second terminal:

```sh
python tests/browser-smoke.py
```

This normal mode serves the real app over HTTP. **The smoke suite expects the
bundled preview fixture**, so run it before replacing that fixture with country
data, or use a clean checkout. Unit tests always use their own separate fixture.
The optional browser suite is not part of the dependency-free Node CI workflow.

For restricted environments that allow DOM rendering but not browser navigation:

```sh
ISOLATED_DOM=1 python tests/browser-smoke.py
```

The isolated mode wraps this project's named ES-module bodies and substitutes
only HTTP responses and location/history. It is a test harness, not the production
build or proof of real HTTP-browser integration. Browser results and screenshots
are written to `test-results/`. No street tiles are requested in either mode.

Before a public release, run `npm run data:refresh`, review the archived upstream
notice, perform actual national-data queries in a normal browser, cross-check
known places and edge cases against an independent appropriate source, and
verify the selected basemap service's terms and deployment behavior.
