# Chrome Web Store — Permissions & Review Notes

This document provides context for Chrome Web Store reviewers on Mira's permissions, architecture, and security posture.

## Permissions Justification

### Host Permissions: `<all_urls>`

Mira is a job application auto-filler. Application forms appear on thousands of different employer domains — there's no fixed set of URLs we can pre-declare. The four ATS platforms we support (Greenhouse, Lever, Ashby, Workday) are frequently embedded on company career pages via iframes, meaning the form may load on any arbitrary domain.

The content script is registered with `allFrames: true` to detect forms inside iframes, but it remains dormant until the user explicitly initiates a fill from the sidepanel. No background scanning or data collection occurs.

### `scripting`

Used to programmatically inject the content script into frames that weren't present at page load (dynamically created iframes). This is necessary because ATS platforms like Workday and iCIMS load their application forms in iframes created via JavaScript after the initial page load.

### `unlimitedStorage`

The extension bundles an ONNX machine learning model (~49MB including tokenizer) for on-device form field classification. This model runs entirely locally via WebAssembly — no data is sent to external servers. The model is stored in the extension package, not downloaded at runtime.

### `offscreen`

Chrome MV3 does not allow WASM execution in service workers. The offscreen document hosts the ONNX Runtime session for ML inference, created when the sidepanel opens and destroyed when it closes.

## Content Security Policy

```
script-src 'self' 'wasm-unsafe-eval'; object-src 'self';
```

`wasm-unsafe-eval` is required by ONNX Runtime Web (`ort-wasm-simd-threaded.wasm`) to instantiate WebAssembly modules. All WASM binaries are bundled with the extension — no remote code is fetched or executed.

## MAIN World Script

The extension injects a lightweight script into the page's JavaScript context (`world: 'MAIN'`). This is necessary to:

1. **Access React internals** — Modern job application platforms (Greenhouse, Ashby, Lever) use React. Setting `input.value` alone doesn't trigger React's change detection. The script invokes React's internal `onChange` handlers to ensure form state updates correctly.

2. **Simulate realistic input** — Some form validation requires a complete event sequence (focus → keydown → input → change → blur). The script dispatches these events in the correct order.

The MAIN world script:

- Does **not** use `eval()`, `innerHTML`, `document.write()`, or `Function()` constructor
- Does **not** make network requests or load remote code
- Does **not** access cookies, localStorage, or session data
- Does **not** read or modify page content beyond the targeted form fields
- Communicates with the content script exclusively via `window.postMessage` with a custom `__mira` protocol identifier and source validation (`event.source !== window`)

`document.execCommand('insertText')` is used in one code path for character-by-character typing into search/filter inputs. This is a standard DOM API (deprecated but functional) used exclusively for text insertion, not code execution.

## Data Handling

- All user data (profile, documents, application history) is stored in `chrome.storage.local` on the user's device
- No data is transmitted to external servers
- No analytics, telemetry, or usage tracking
- The ML model runs on-device via WASM — no cloud inference
- Resume files are stored as base64 in local storage and only used during form filling
