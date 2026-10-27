# Incident Archive v0.2.3 — Rendering correction

Observed defect: exported CHEMICAL images showed a hard vertical seam at the exact image midpoint and large diagonal triangle boundaries.

Diagnosis: the CHEMICAL shader source itself was unchanged from v0.2.0; the artifact came from geometry-interpolated texture coordinates.

Fix:
- Added `screenUV()` based on `gl_FragCoord / uResolution`.
- All fragment engines now sample image coordinates through `screenUV()`.
- CHEMICAL's actual processing math remains unchanged except for the UV source.
- Updated service-worker cache key and network-first handling for HTML/JS/CSS.


## v0.2.7 tuning
- SOLAR: intensity slightly reduced for better usability on portraits while keeping optical flare/ray behavior.
- CHEMICAL: softened destructive drift and tuned dye behavior for higher hit-rate on people.
- REGISTER: kept close to v0.2.5 with minor subject protection.
- LATENT: renamed from PHOTOGRAM and reworked toward latent-image / density-plate behavior, differentiated from CHEMICAL.
