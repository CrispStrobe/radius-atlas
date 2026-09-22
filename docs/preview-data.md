# The included preview is a software fixture

© 2026 Radius Atlas contributors — CC BY 4.0.

The archive includes 39 manually constructed postal examples, using familiar
place names around Kehl and a few distant examples for testing. Coordinates are
approximate illustrative values; the fields are not a GeoNames extraction and
have not been validated as a geographic or postal dataset. Administrative code
fields intentionally contain `preview`. These records are not a complete list of
places, municipalities, or PLZ within any radius.

This allows the UI, exports and tests to run without network access. The source
notice, dataset metadata, app warning, exports, README and build output all mark
the preview clearly. Do not remove that warning while keeping the fixture data.

A successful `npm run data:refresh` replaces the served fixture and the placeholder
source notice with data downloaded from GeoNames and the exact upstream README.
The separate fixture in `tests/fixtures/preview.json` remains for unit tests.

`node scripts/create-preview.mjs` resets the served dataset to the fixture and
must not be run in a production build that is meant to use the full data.
