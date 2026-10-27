# INCIDENT ARCHIVE v0.2.9 · EDITORIAL GUI

This is a GUI-only revision of v0.2.8.

- Photo engines unchanged: SOLAR / CHEMICAL / REGISTER / LEAK.
- Redesigned single-column responsive interface, inspired by muted grey/lavender typography and a magenta action accent.
- Original photo aspect ratio preserved in preview and high-resolution PNG export.
- The top-right three-line icon **opens the photo picker**; it is not an inert menu.
- MUTATE / EDIT / SAVE buttons are operational; BACK remains available in the metadata strip.
- Edit panel retains AMOUNT / CHANCE / PRESERVE / export resolution.
- Metadata displays filename and file modified date (not EXIF capture date).
- PWA icon, theme, asset URLs, and Service Worker cache refreshed.

## Deployment

Unzip the GitHub replacement ZIP into the **root** of your GitHub Pages repository, overwriting the previous files. After publishing, open the page again in Safari. For Safari's installed home-screen version, reopening may be needed for the updated Service Worker to activate.

## Files

`index.html`, `style.css`, `sketch.js`, `sw.js`, `manifest.webmanifest`, and `icons/`.
