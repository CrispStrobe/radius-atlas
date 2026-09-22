# Spatial method and authoritative municipality upgrade

© 2026 Radius Atlas contributors — CC BY 4.0.

## Current implementation

The query operates on GeoNames postal records, not verified administrative
municipalities. A place group is identified by country, all three supplied
administrative codes, and the case-folded exact locality name. Accents and
punctuation are kept in the identity; they are ignored only for search.

A group's reference point is the spherical mean of its distinct coordinates. This
is a repeatable algorithm, not a town hall, geographic polygon centroid, resident
weighted center, or officially endorsed municipal point. Estimated upstream
coordinates remain estimated after processing.

The radius test is inclusive. An implementation tolerance of 1e-9 km handles
floating-point noise, not source uncertainty. Haversine uses a mean Earth radius
of 6371.0088 km; the map's radius outline uses the same spherical model. Near a
threshold, source coordinates and spherical-versus-ellipsoidal differences can
change whether a record qualifies. Do not use this app for surveying, precise
eligibility decisions or parcel-level analysis without a suitable data/method layer.

Place-first filtering returns all known rows for selected locality groups. Point
filtering returns only selected postal coordinates. The distinction is retained in
the table, JSON, full CSV and GeoJSON. Postal codes are identifiers, not numbers.
Cross-border unique codes are keyed by `(country, postalCode)`.

The current map limits rendered result markers to 3,000 visible points and context
markers to 2,500. The result table and exports remain complete relative to the
loaded dataset and selected rule. Points can overlap; use the structured table
and exports for exhaustive inspection.

## Scope gaps

This does not implement administrative-boundary intersections, PLZ-area
intersections, isochrones, route distances, or an arbitrary GIS/AI query language.
DE/FR source files are supported. Other countries may have different postcode and
administrative formats and require a reviewed adapter and validation policy.

## Adding political municipalities correctly

A subsequent authoritative layer should have three explicit relations:

```
municipalities(country, municipality_id, name, reference_lat, reference_lon,
               reference_method, valid_from, valid_to, geometry)
municipality_postcodes(country, municipality_id, postal_code, source, valid_at)
source_provenance(source, version, retrieved_at, license, attribution, checksum)
```

Use a verified AGS for German municipalities; never deduce it from a postal
locality's name or assume that a five-digit GeoNames district code is an AGS.
Preserve strings with leading zeros. Crosswalk and boundary vintages must agree.

For **municipal point mode**, query reference points first and then join all
municipality–postcode rows. Record whether the point is a town hall, official
reference point, a reproducibly derived point, or another agreed convention.

For **boundary intersection mode**, intersect municipality polygons with the
chosen geodesic radius region (or use a distance-aware spatial database). A
municipality can qualify even when its reference point is outside the circle.
Define whether the origin is a Kehl point or the whole Kehl municipality.

BKG VG250 is an option for municipality geometries under dl-de/by-2-0. A reviewed
OpenPLZ crosswalk would introduce ODbL duties; retain those terms. The imported
data license cannot be replaced by this app's MIT or CC BY documentation license.
Neither adapter is implemented in the present repository.

References checked during preparation:

- GeoNames postal schema and limitations:
  https://download.geonames.org/export/zip/readme.txt
- OpenPLZ Germany schema:
  https://www.openplzapi.org/en/germany/
- OpenPLZ license:
  https://www.openplzapi.org/en/faq/
- BKG VG250:
  https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-stand-01-01-vg250-01-01.html

Verify the current data vintages and licenses before adding a new provider.
