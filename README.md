# Meta Data — photo metadata & privacy analyzer

Meta Data is a single-page application that inspects photo metadata entirely in the browser and augments it with contextual signals like maps, historical weather, nearby points of interest, and potential surveillance hotspots. The goal is to help users understand what private details a shared image may unintentionally disclose.

## Features

- Drag & drop upload for JPEG, PNG, and WebP images with client-side validation.
- Local EXIF/XMP/IPTC/ICC parsing using [`exifr`](https://github.com/MikeKovarik/exifr); the original image never leaves the browser.
- Metadata completeness scoring, shooting device insights, and quick links for maps and Street View.
- MapLibre GL JS map for precise GPS visualization and accuracy radius overlays.
- “Shock block” privacy insights combining metadata with reverse geocoding, timezone/holiday lookup, historical weather, nearby POIs, and surveillance candidates via Cloudflare Pages Functions that proxy public APIs.
- Optional content analysis powered by TensorFlow.js (coco-ssd) with graceful fallback on low-end devices and optional bounding box overlay.
- Client-side cleanup tools to strip metadata segments and blur detected faces before download.
- Full RU / EN / UZ localisation with an inline language switcher.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on Vite with hot module replacement.

## Building for production

```bash
npm run build
```

The optimized static bundle is written to `dist/`. Preview it locally via `npm run preview`.

## Cloudflare Pages deployment

- Build command: `npm run build`
- Output directory: `dist`
- Functions directory: `/functions`

Pushes to the repository will trigger Pages to build the static assets and deploy the accompanying Functions that proxy external APIs (Nominatim, BigDataCloud, Nager.Date, Open-Meteo, Overpass API). No raw image data is sent to these services — only primitive fields like coordinates or timestamps.

## Privacy and safety notes

- All heavy lifting (file validation, metadata parsing, thumbnailing, cleanup) stays inside the browser. Functions act strictly as HTTP proxies to public APIs and only receive non-sensitive query parameters.
- Error handling across the app guides the user with retry options whenever remote lookups fail; core metadata utilities continue to work offline.
