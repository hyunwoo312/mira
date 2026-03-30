# Mira

Chrome extension that auto-fills job applications. Supports Ashby, Greenhouse, and Lever.

Uses a fine-tuned MiniLM model to classify form fields and match answers. Heuristic patterns handle the obvious stuff (name, email, phone), ML handles the rest (sponsorship, consent, EEO questions).

## Setup

```bash
pnpm install
pnpm build
```

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" → select `.output/chrome-mv3/`
4. Open any job application and click the Mira icon in the sidebar

## Development

```bash
pnpm dev          # hot-reload dev server
pnpm build        # production build (~7min on WSL2, ~1min on native Linux)
pnpm build:ui     # rebuild UI only (reuses cached models)
```

## ML Model

The field classifier lives in `public/models/field-classifier/`. A pre-trained ONNX model is included and works out of the box.

## Architecture

```
src/
  entrypoints/
    sidepanel/        # React UI (profile editor + fill button)
    content.ts        # Content script (runs fillPage pipeline)
    page-script.ts    # MAIN world script (React props access)
    background.ts     # Service worker (ML inference relay)
    offscreen/        # Offscreen document (ONNX model loading)
  lib/
    autofill/         # Pipeline: scan → classify → fill
    ml/               # Transformers.js classifier + embeddings
  components/         # UI components
  hooks/              # React hooks (profile, fill, theme, scrollspy)
```

The autofill pipeline:

1. **Scan** — detect all form fields on the page (ATS-specific scanners)
2. **Classify** — Tier 1 (options) → Tier 2 (heuristics) → Tier 3 (ML) → Tier 4 (fallback patterns)
3. **Fill** — text fields first, then selects, then groups, then location (deferred for API loading)

## Tech

- React 19, TypeScript, Tailwind CSS 4, Radix UI, Framer Motion
- WXT (Chrome extension framework)
- Transformers.js + ONNX Runtime (in-browser ML inference)
- React Hook Form + Zod (profile management)

## License

MIT
