# Chrome Web Store — Permissions & Review Notes

This document provides context for Chrome Web Store reviewers on Mira's permissions, architecture, and security posture.

## Permissions Justification

### Host Permissions: `<all_urls>`

Mira is a job application auto-filler. Application forms appear on thousands of different employer domains — there's no fixed set of URLs we can pre-declare. The five ATS platforms we support (Greenhouse, Lever, Ashby, Workday, iCIMS) are frequently embedded on company career pages via iframes, meaning the form may load on any arbitrary domain.

Content scripts are **not auto-injected on any page**. They use `registration: 'runtime'` and are only injected programmatically via `chrome.scripting.executeScript` when the user explicitly triggers a fill (via sidepanel button, context menu, or keyboard shortcut). No code runs on any page until the user takes action. No background scanning or data collection occurs.

### `scripting`

Content scripts are injected on-demand via `chrome.scripting.executeScript` only when the user triggers a fill. This is the sole injection mechanism — there are no manifest-declared content scripts. The `scripting` permission is required to inject into all frames (`allFrames: true`), including dynamically created iframes used by ATS platforms like Workday.

### `unlimitedStorage`

The extension bundles an ONNX machine learning model (~49MB including tokenizer) for on-device form field classification. This model runs entirely locally via WebAssembly — no data is sent to external servers. The model is stored in the extension package, not downloaded at runtime.

### `offscreen`

Chrome MV3 does not allow WASM execution in service workers. The offscreen document hosts the ONNX Runtime session for ML inference, created lazily on the first fill request and destroyed after 5 minutes of inactivity via `chrome.alarms`.

### `contextMenus`

Provides a right-click "Mira: Auto-fill" context menu item so users can trigger form filling without opening the sidepanel. If the user has multiple profile presets, sub-items are shown for each preset.

### `alarms`

Used to manage the ML model idle timeout. After 5 minutes of no fill activity, an alarm fires to destroy the offscreen document and release WASM memory. `chrome.alarms` is used instead of `setTimeout` because service worker timers are lost when Chrome puts the worker to sleep.

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
