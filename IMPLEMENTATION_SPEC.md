# Incident Archive v0.1.2 implementation notes

This is a parameter-level brush-up of v0.1.1, not a rewrite.

- p5.js WEBGL / GLSL remains unchanged architecturally.
- Four independent fragment shaders remain: SPECIMEN / TRANSFER / ECHO / BLOOMCAST.
- Chance Engine recipe structure is unchanged.
- UI structure and hidden EDIT panel are unchanged.
- Preview/export pipeline is unchanged.

The only substantive changes are stronger internal ranges and blend weights so the result is visibly transformed after MUTATE.
