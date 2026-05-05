# Chrome Web Store — Permissions & Review Notes

This document provides context for Chrome Web Store reviewers on Mira's permissions, architecture, and security posture.

The first section ("Submission Form — Ready-to-Paste") contains the exact
text intended for each field of the CWS dashboard's submission form. The
second section onward is the deeper engineering rationale for reviewers
who want detail.

---

## Submission Form — Ready-to-Paste

### Single-purpose statement

Mira is a job-application auto-fill tool. It stores a profile you build
yourself and uses it to fill application forms on supported career sites
(Greenhouse, Lever, Ashby, Workday, iCIMS) when you explicitly trigger a
fill. On first install it opens a guided walkthrough with a sample
profile so you can try the auto-fill once before building your own. It
does nothing else.

### Are you using remote code?

**No.** All JavaScript and WebAssembly is bundled inside the extension
package. No code is fetched from external servers at runtime. The ML model
file (`model_quantized.onnx`) and ONNX Runtime WASM binaries ship with the
extension and are loaded from `chrome.runtime.getURL` paths only.

### Permission justifications (per-permission, ≤1000 chars each)

**`activeTab`** — Required to identify the user's currently active tab so
the fill command targets the form they're viewing. Used in the side panel,
context menu, and keyboard-shortcut handlers.

**`tabs`** — Used to read the active tab's URL (to detect supported ATS
platforms and onboarding state) and to open the onboarding tab on first
install or when the user replays the walkthrough from Settings. No tab
content is read from this permission alone.

**`sidePanel`** — Mira's primary UI is a Chrome side panel where the user
edits their profile, manages presets, and triggers fills. The permission
is required to register and open the side panel programmatically.

**`storage`** — Stores the user's profile, presets, application history,
and settings in `chrome.storage.local`. All data is local; nothing is
synced or transmitted.

**`unlimitedStorage`** — Required because uploaded resumes/cover letters
are stored as base64 inside `chrome.storage.local`, which can exceed the
default 5 MB quota when a user keeps multiple files across multiple
profile presets.

**`offscreen`** — Chrome MV3 service workers cannot execute WebAssembly.
The offscreen document hosts the ONNX Runtime session for on-device ML
inference. It is created lazily on the first fill request and destroyed
after 5 minutes of inactivity to free WASM memory.

**`scripting`** — Content scripts are NOT statically injected. They use
runtime registration and are programmatically injected via
`chrome.scripting.executeScript` only when the user triggers a fill.
This is the sole injection mechanism. `allFrames: true` is needed because
ATS platforms (notably Workday and embedded Greenhouse forms) use
nested iframes.

**`webNavigation`** — Used to detect when iframes finish loading on a
target page so the fill pipeline can wait for embedded ATS forms (e.g.,
Greenhouse iframes embedded on company career pages) before scanning.
No browsing history is read or stored.

**`contextMenus`** — Registers the right-click "Mira: Auto-fill" menu
item so users can trigger filling without opening the side panel. If the
user has multiple profile presets, sub-items appear for each preset.

**`alarms`** — Manages the ML idle timeout. Five minutes after the last
fill, an alarm fires and unloads the ONNX Runtime session to release WASM
memory. `chrome.alarms` is required (rather than `setTimeout`) because
service-worker timers do not survive worker sleep.

### Host permission `<all_urls>` justification

Job application forms appear on tens of thousands of unique employer
domains, plus ATS-hosted subdomains (`*.greenhouse.io`, `*.ashbyhq.com`,
`*.lever.co`, `*.myworkday.com`, `*.icims.com`). There is no fixed URL
list to declare — career portals are commonly embedded as iframes on
arbitrary company domains. The content script does NOT auto-run on any
page; it is injected programmatically only when the user explicitly
triggers a fill via the side panel button, context menu, or keyboard
shortcut. No background scanning, no passive data collection.

### Privacy practices disclosure (data usage)

Mira does NOT collect, transmit, sell, or share any user data. All of
the following stays exclusively in `chrome.storage.local` on the user's
device:

- Personally identifiable information (name, email, address, phone)
- Authentication / sign-in info: not collected
- Financial / payment info: not collected
- Health info: not collected
- Web history: not collected
- User activity / clicks / keystrokes: not collected
- Website content: not collected

The extension uses the user's locally stored profile only to fill form
fields when the user explicitly triggers a fill. No analytics, no
telemetry, no remote logging.

---

## Detailed Permissions Justification (engineering rationale)

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
