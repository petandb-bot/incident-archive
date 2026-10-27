# Incident Archive v0.2.9.1 GUI implementation

Baseline: v0.2.8 LEAK_MODE. GLSL shader source and recipe families are preserved verbatim.

Responsive main composition: masthead → image canvas/empty state → four horizontally spaced mode tabs → filename/date/BACK → three main actions → magenta footer strip. Edit drawer expands below actions.

The preview and export dimensions remain based on original image aspect ratio. The preview uses the previous high-DPI `uResolution` correction. The header's menu motif triggers the actual OPEN file picker.

No static photo is bundled. Opening a photo replaces the graphic placeholder with the processed photo, preserving its dimensions.


Change scope: LEAK_FRAG only, plus version/cache metadata. The 3 fixed shaders are identical to v0.2.9.
