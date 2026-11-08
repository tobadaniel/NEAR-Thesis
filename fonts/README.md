# Embedded fonts

Variable WOFF2 files (latin subset) downloaded from Google Fonts,
SIL Open Font License 1.1 (see the families' own pages):

- `inter-latin.woff2` — Inter, wght 100–900 (rsms/inter)
- `space-grotesk-latin.woff2` — Space Grotesk, wght 300–700 (floriankarsten/space-grotesk)

`style.css` references them via `@font-face`; `build-single.mjs`
inlines them as base64 data URIs into `dist/near-thesis.html`, so the
single file keeps its typography opened straight from disk, offline.
