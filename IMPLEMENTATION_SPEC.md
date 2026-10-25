# INCIDENT ARCHIVE v0.2.0 — IMPLEMENTATION SPEC

## Goal
Replace object-based anomaly generation with four image-state engines that create stronger, stranger, but more photographically convincing incidents.

## Shared design rules
- No literal inserted objects
- Mutations should arise from image-state change
- Keep UI minimal and similar to prior prototypes
- Use WEBGL for lightweight preview and export
- Use hidden chance-engine logic through recipe randomization

## Engines
### SOLAR
- Tone reversal / sabattier style thresholds
- White-rim edge response
- Film-like ray exposure and partial clipping
- Strong highlight bloom

### CHEMICAL
- Dye layer drift
- Bleach bath fields
- Cross-processed channel mixing
- Emulsion instability / spectral remapping

### REGISTER
- Chromatic misregistration
- Offset plate shift
- Slit-like duplication bands
- Edge-driven ghosting

### PRESSURE
- Thin-film interference
- Newton-ring style circles
- Local stress displacement
- Surface contact brightening and compression

## Parameters
- AMOUNT = effect strength
- CHANCE = recipe aggressiveness and family variance
- PRESERVE = source color / structure retention

## Recipe randomization
Each mode rolls:
- family label
- palette
- random field vectors h0-h2 / r0-r2
- seed
