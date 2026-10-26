Incident Archive v0.2.4

- aspect-ratio preserved for landscape / portrait images
- mirrored edge extension removed
- preview fits image naturally inside stage

# Incident Archive v0.2.3 — UV FIX

This revision fixes the center seam and large triangular discontinuities visible in CHEMICAL output.

## What changed
- CHEMICAL processing recipe remains the v0.2.0 FIX version.
- Texture coordinates now come from fragment pixel coordinates (`gl_FragCoord`) instead of interpolated plane mesh UVs.
- The same seam-safe coordinate path is used by all four engines.
- Service Worker cache updated to v0.2.3 and code assets use network-first loading.

## Modes
- SOLAR
- CHEMICAL
- REGISTER
- PHOTOGRAM
