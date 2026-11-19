# Neon Coast Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/competitions/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/htyo00/gta6-cover-art-01/rank.svg)](https://make.fun/competitions/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/htyo00/gta6-cover-art-01/reward.svg)](https://make.fun/competitions/gta6-cover-art-01)

Entry for the make.fun competition [Make GTA 6 Cover Art](https://make.fun/competitions/gta6-cover-art-01): an offline web app that turns your own photos into a Vice City sunset cover poster and exports it as a PNG to share.

## What it does

- **Multi-panel posters** — 4-panel, 6-panel and 9-panel grids, hero-and-three, full-bleed, and a tilted snapshot layout.
- **Any photo** — upload several photos, or use the two bundled samples. Click a photo, then click a panel to place it; drag inside a panel to crop and position, scroll to zoom, per panel.
- **Colour grades** — seven gradient-map grades: Sunset, Neon, Vice, Heat, Teal & gold, Noir, Candy.
- **Lettering** — Anton titles and Pacifico script subtitles (both SIL Open Font License, vendored under `app/fonts/`) over a halftone title block, plus a five-star heat meter and ribbon badge.
- **Polish** — film grain, vignette, live preview, undo/redo.
- **Export** — one click to PNG at 1080×1080, 1080×1350, 1920×1080, or story 1080×1920.

## Run it

Serve `app/` with any static file server and open `index.html` — no build step, no network requests, photos never leave your machine.

```sh
cd app && python3 -m http.server 8000
```

## Screenshot modes

- `?shot=cover` — the exported cover full-frame (used for the cover screenshots).
- `?shot=editor` — the editor with a photo loaded.

Both accept `&layout=…&grade=…&title=…&subtitle=…`.

## Originality

All artwork is generated from the user's own photos in the browser. No Rockstar Games logo, artwork or font is used. Typefaces Anton, Pacifico and Bebas Neue are licensed under the SIL Open Font License; see `app/fonts/OFL.txt`.
