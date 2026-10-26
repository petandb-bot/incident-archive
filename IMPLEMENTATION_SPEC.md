# Incident Archive v0.2.3 — Rendering correction

Observed defect: exported CHEMICAL images showed a hard vertical seam at the exact image midpoint and large diagonal triangle boundaries.

Diagnosis: the CHEMICAL shader source itself was unchanged from v0.2.0; the artifact came from geometry-interpolated texture coordinates.

Fix:
- Added `screenUV()` based on `gl_FragCoord / uResolution`.
- All fragment engines now sample image coordinates through `screenUV()`.
- CHEMICAL's actual processing math remains unchanged except for the UV source.
- Updated service-worker cache key and network-first handling for HTML/JS/CSS.
