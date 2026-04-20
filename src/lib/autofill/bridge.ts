const PROTOCOL = '__mira';
let _ready = false;

interface BridgeResponse {
  success?: boolean;
  [key: string]: unknown;
}
const _pending = new Map<
  string,
  { resolve: (data: BridgeResponse) => void; timer: ReturnType<typeof setTimeout> }
>();

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Same-window + same-origin guard. An iframe in the host page cannot spoof
    // protocol messages from a different origin, and cross-window posters are
    // ignored outright.
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || !msg[PROTOCOL]) return;

    if (msg.action === 'ready') {
      _ready = true;
      return;
    }

    if (msg.id && !msg.action && _pending.has(msg.id)) {
      const { resolve, timer } = _pending.get(msg.id)!;
      clearTimeout(timer);
      _pending.delete(msg.id);
      resolve(msg);
    }
  });
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function send(
  action: string,
  params: Record<string, unknown> = {},
  timeoutMs = 2000,
): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    const id = genId();
    const timer = setTimeout(() => {
      _pending.delete(id);
      resolve({ success: false, error: `timeout:${action}` });
    }, timeoutMs);

    _pending.set(id, { resolve, timer });
    window.postMessage({ [PROTOCOL]: true, id, action, ...params }, window.location.origin);
  });
}

/** Tag an element with a unique data attribute for cross-context reference */
function tagElement(el: HTMLElement): string {
  let id = el.getAttribute('data-mira-id');
  if (!id) {
    id = 'mira-' + genId();
    el.setAttribute('data-mira-id', id);
  }
  return id;
}

export function isBridgeReady(): boolean {
  return _ready;
}

/** Initialize the bridge. Page script is injected by WXT as a MAIN world content script. */
export function initBridge(): void {
  // Retry ping to detect when page script is ready
  const checkReady = (attempt = 0) => {
    if (_ready || attempt > 20) return;
    send('ping').then((r) => {
      if (r?.success) _ready = true;
      else setTimeout(() => checkReady(attempt + 1), 100);
    });
  };
  setTimeout(checkReady, 50);
}

/** Set text value with full keyboard event sequence */
export async function bridgeSetText(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setText', { miraId, value });
  return r?.success ?? false;
}

/** Minimal combobox value set: focus + setValue + React onChange. Triggers search API. */
export async function bridgeSetComboboxValue(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setComboboxValue', { miraId, value });
  return r?.success ?? false;
}

/** Set text value WITHOUT blur — keeps combobox dropdowns open */
export async function bridgeSetTextNoBlur(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setText', { miraId, value, skipBlur: true });
  return r?.success ?? false;
}

/** Click an element (dual dispatch: DOM event + React handler) */
export async function bridgeClick(el: HTMLElement): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('click', { miraId });
  return r?.success ?? false;
}

/** Set checkbox/radio checked state */
export async function bridgeSetChecked(el: HTMLElement, checked: boolean): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setChecked', { miraId, checked });
  return r?.success ?? false;
}

/** Type text character by character via execCommand — triggers real InputEvents */
export async function bridgeTypeText(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('typeText', { miraId, value }, 5000);
  return r?.success ?? false;
}

/** Click a button group button and set its hidden checkbox atomically */
export async function bridgeClickButtonGroup(el: HTMLElement): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('clickButtonGroup', { miraId });
  return r?.success ?? false;
}

/** Dispatch keyboard event via MAIN world (triggers React onKeyDown) */
export async function bridgeKeyDown(
  el: HTMLElement,
  key: string,
  code: string,
  keyCode: number,
): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('keyDown', { miraId, key, code, keyCode });
  return r?.success ?? false;
}

/** Trigger Workday monikerSearchBox search by invoking React's onKeyDown prop directly. */
export async function bridgeWorkdayMonikerSearch(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('workdayMonikerSearch', { miraId, value });
  return r?.success ?? false;
}

/** Set native select value */
export async function bridgeSetSelect(el: HTMLElement, value: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setSelect', { miraId, value });
  return r?.success ?? false;
}

/** Get React Select options and current value */
export async function bridgeGetSelectState(el: HTMLElement): Promise<{
  options: Array<{ label: string; value: string }>;
  currentValue: string | null;
  isMulti: boolean;
} | null> {
  const miraId = tagElement(el);
  const r = await send('getSelectState', { miraId });
  if (!r?.success) return null;
  return r.result as {
    options: Array<{ label: string; value: string }>;
    currentValue: string | null;
    isMulti: boolean;
  } | null;
}

/** Set React Select value by option label */
export async function bridgeSetSelectValue(el: HTMLElement, label: string): Promise<boolean> {
  const miraId = tagElement(el);
  const r = await send('setSelectValue', { miraId, label });
  return r?.success ?? false;
}
