# Third-party notices

## GeoNames country data (downloaded by the production import)
Provider: GeoNames. License: CC BY 4.0 as named in the postal source README.
Source: https://download.geonames.org/export/zip/
Attribution: Postal data © GeoNames, CC BY 4.0; converted, validated and deduplicated
by Radius Atlas; locality reference points and distances are derived.

The README has a historical 3.0 link despite naming 4.0; the importer archives the
fetched README. Country snapshots are hashed with SHA-256 and retain HTTP
Last-Modified where available. Retrieval date is not a claim that every underlying
record was updated that day.

## OpenStreetMap basemap (external, optional)
Map attribution: © OpenStreetMap contributors.
Copyright and licensing: https://www.openstreetmap.org/copyright
Tile policy: https://operations.osmfoundation.org/policies/tiles/

OSM data is under ODbL; map imagery and service terms are separate from the
GeoNames query dataset. Nothing is spatially joined from the basemap into exports.
There is no map-screenshot exporter or offline tile download feature.

## JavaScript dependencies
None. The app and build tooling use browser APIs and Node.js built-ins.
The fonts are local system fonts; no font files or external font service is bundled.
