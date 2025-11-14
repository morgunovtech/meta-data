# Meta Data Privacy Analyzer

Meta Data Privacy Analyzer is a Cloudflare Pages-ready single page application that helps investigate how much contextual and metadata information a shared photo exposes. The tool processes images entirely in the browser and uses Cloudflare Pages Functions strictly as hardened HTTP proxies for public open-data APIs (reverse geocoding, historical weather, nearby places, and potential surveillance sources).

## Features

- Drag & drop upload for JPEG, PNG, and WebP up to 20 MB with instant thumbnail generation.
- Local EXIF/XMP/IPTC/ICC parsing using `exifr`, including completeness scoring and capture device insights.
- Privacy "shock" section that surfaces inferred time zone, address, weather, nearby points of interest, and likely surveillance devices via proxied public APIs.
- Optional MapLibre map with accuracy visualization and fast links to Google Maps and Street View.
- Toggleable on-device object detection (TensorFlow.js + COCO SSD) with bounding box overlay.
- Client-side cleanup tools to strip metadata and blur detected people before downloading a cleaned copy.
- Full internationalisation (RU/EN/UZ) with instant language switching.

## Getting started

```bash
npm install
npm run dev
```

The dev server is powered by Vite and runs at `http://localhost:5173` by default. Pages Functions in `/functions` are automatically served under `/api/*`.

## Building for production

```bash
npm run build
```

The build command outputs static assets to the `dist/` directory, matching the Cloudflare Pages configuration.

To preview the production build locally:

```bash
npm run preview
```

## Cloudflare Pages deployment

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Functions directory:** `/functions`
- **Package manager:** npm

The project is designed for the standard Git → Pages workflow. No additional Wrangler configuration is required.

## Architecture notes

- The frontend is a React + TypeScript SPA bootstrapped with Vite.
- All heavy image processing (metadata parsing, cleanup, face blurring) happens in the browser; image bytes are never uploaded to the backend.
- Pages Functions act purely as pass-through proxies to public APIs (OpenStreetMap Nominatim, Open-Meteo, Overpass, and Nager public holiday API). They validate inputs, normalise responses, and return compact JSON payloads of the form `{ ok: boolean, data?: T, error?: string }`.
- Styling uses modern CSS with responsive layouts and accessible controls, avoiding third-party CSS frameworks to minimise bundle size.
- Internationalised text lives in `src/i18n/messages.ts`, with a context provider for runtime language switching.

## Security & privacy considerations

- Uploaded images stay entirely client-side; serverless functions only receive primitive metadata (coordinates, timestamps) when explicitly required for contextual lookups.
- External API requests include basic validation, conservative timeouts (via Workers defaults), and cache-friendly headers to reduce downstream load.
- Cleanup tools re-encode imagery in-browser to remove metadata and optionally blur detected people before download, supporting privacy-safe sharing workflows.

## License

See [LICENSE](LICENSE) if present in the repository.
