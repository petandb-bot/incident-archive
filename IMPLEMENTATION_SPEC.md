# Incident Archive v0.2.1 — Implementation Spec

- Base: v0.2.0 phenomena architecture
- Modes:
  - SOLAR: slightly reduced ray dominance while keeping sabattier / film-burn identity
  - CHEMICAL: retained
  - REGISTER: retained
  - CONTACT: replaces PRESSURE with a photogram/contact-print style shader
- CONTACT engine:
  - organic shadow masks built from warped FBM fields
  - thread/filament sub-structures
  - exposed-paper bleaching at mask edges
  - palette-driven exposure drift rather than object insertion
- UI architecture unchanged for stability
