# Meta Data – photo metadata & privacy analyzer

This project is a Cloudflare Pages-friendly single-page app that inspects the privacy surface of photos. It parses EXIF/XMP/IPTC/ICC metadata in the browser, highlights sensitive signals, and enriches the context with weather, holiday and maps data proxied through Cloudflare Pages Functions.

## Features

- Drag & drop photo upload with client-side validation (JPEG/PNG/WebP up to 20 MB).
- Local EXIF/XMP/IPTC/ICC parsing via [`exifr`](https://github.com/MikeKovarik/exifr); image bytes never leave the browser.
- Thumbnail preview, fullscreen viewer, metadata completeness scoring, and camera processing chain hints.
- “Shock block” privacy insights: timezone/holiday resolution, reverse geocoded address, MapLibre map, historical weather, nearby POIs, and likely surveillance spots via public APIs proxied through Pages Functions.
- Optional on-device content analysis using TensorFlow.js + COCO-SSD with graceful degradation on low-power devices.
- Cleanup & download tools to re-export images with stripped metadata and optional face blurring.
- Full i18n coverage (RU/EN/UZ) with a runtime language switcher.

## Getting started

```bash
npm install
npm run dev
```

The Vite dev server listens on `http://localhost:5173/`.

### Build

```bash
npm run build
```

The static bundle is emitted to `dist/`.

### Preview

```bash
npm run preview
```

## Cloudflare Pages deployment

Configure your Pages project with the following settings:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Functions directory:** `/functions`

Pages Functions (`/functions/*.ts`) act as thin HTTP proxies to public services (OpenStreetMap Nominatim, Open-Meteo, Date.Nager, Overpass API). They only accept primitive parameters (coordinates, timestamps) and never receive raw image bytes.

## Tech stack

- React + TypeScript + Vite
- `exifr` for metadata parsing
- MapLibre GL JS for mapping
- TensorFlow.js COCO-SSD for optional object detection
- Cloudflare Pages Functions for API proxying

## License

See [LICENSE](LICENSE) if present in the repository; otherwise all rights reserved.
