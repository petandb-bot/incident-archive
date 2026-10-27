# Incident Archive v0.2.7.1 — Preview Density Fix

- Fixes preview-only edge stretching on Retina / high-DPI displays.
- Keeps original image aspect ratio.
- Export behavior and all four engine algorithms are unchanged from v0.2.4.
- Preview shader resolution now uses the physical WEBGL drawing-buffer size.

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
- LATENT


## v0.2.7.1 tuning
- SOLAR: intensity slightly reduced for better usability on portraits while keeping optical flare/ray behavior.
- CHEMICAL: softened destructive drift and tuned dye behavior for higher hit-rate on people.
- REGISTER: kept close to v0.2.5 with minor subject protection.
- LATENT: renamed from PHOTOGRAM and reworked toward latent-image / density-plate behavior, differentiated from CHEMICAL.


- v0.2.7.1: stronger mode output, full-image color filtering, and richer whole-photo tone changes while keeping the same 4-mode structure.
