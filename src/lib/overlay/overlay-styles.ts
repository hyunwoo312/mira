/** Overlay Shadow DOM styles — matches Mira sidepanel theme. */

export function buildStyles(): string {
  return `
    :host {
      all: initial !important;
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Theme ── */
    .mira-widget {
      --bg: #F4F2F0;
      --bg-alt: #FCFBFB;
      --fg: #1A1A1A;
      --muted: #999;
      --dim: rgba(26,26,26,0.25);
      --border: #DCD8D3;
      --green: #10B981;
      --amber: #F59E0B;
      --red: #EF4444;

      pointer-events: auto;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: var(--fg);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.05);
      width: 340px;
      overflow: hidden;
      position: relative;
      transform-origin: bottom right;
    }

    .mira-widget.dark {
      --bg: #2A2825;
      --bg-alt: #252320;
      --fg: #E8E6E3;
      --muted: #807D78;
      --dim: rgba(232,230,227,0.20);
      --border: rgba(232,230,227,0.12);
      box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15);
    }

    /* ── Header ── */
    .ov-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    .ov-header-left { display: flex; align-items: center; gap: 6px; }
    .ov-header-title { font-size: 13px; font-weight: 500; letter-spacing: -0.01em; }
    .ov-header-right { display: flex; align-items: center; gap: 6px; }
    .ov-btn-icon {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; padding: 3px 4px; border-radius: 4px;
      font-family: inherit; font-size: 10px; font-weight: 500;
      color: var(--muted); cursor: pointer; transition: color 0.15s, background 0.15s;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .ov-btn-icon:hover { color: var(--fg); background: var(--dim); }
    .ov-divider { width: 1px; height: 14px; background: var(--border); }

    /* ── Shared ── */
    .ov-pad { padding: 14px; }
    .ov-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px 14px; }
    .ov-row { display: flex; align-items: center; }
    .ov-row-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ov-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-family: inherit; }
    .ov-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .ov-dot-active { background: var(--fg); }
    .ov-dot-green { background: var(--green); }
    .ov-dot-amber { background: var(--amber); }
    .ov-dot-red { background: var(--red); }
    .ov-dim { color: var(--muted); }

    /* ── ML Loading ── */
    .ov-loading-text { font-size: 13px; font-weight: 500; font-family: inherit; }

    /* ── Filling ── */
    .ov-shimmer-group { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .ov-shimmer {
      height: 8px; border-radius: 4px;
      background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite linear;
    }
    @keyframes shimmer { to { background-position: -200% 0; } }

    /* ── Result ── */
    .ov-result-title { font-size: 15px; font-weight: 500; letter-spacing: -0.01em; margin-top: 2px; font-family: inherit; }
    .ov-result-count { font-size: 13px; font-weight: 500; white-space: nowrap; flex-shrink: 0; font-family: inherit; }
    .ov-bar-track { display: flex; height: 4px; border-radius: 4px; overflow: hidden; background: var(--dim); }
    .ov-bar-seg { height: 100%; }
    .ov-green { background: var(--green); }
    .ov-amber { background: var(--amber); }
    .ov-red { background: var(--red); }

    /* ── Log toggle ── */
    .ov-log-btn {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      width: 100%; padding: 7px 12px;
      background: var(--bg-alt); border: 1px solid var(--border); border-radius: 6px;
      font-family: inherit; font-size: 10px; font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--fg); cursor: pointer; transition: border-color 0.15s;
    }
    .ov-log-btn:hover { border-color: var(--muted); }

    /* ── Log panel ── */
    .ov-log-panel { border-top: 1px solid var(--border); background: var(--bg-alt); overflow: hidden; }
    .ov-log-panel-head {
      display: flex; justify-content: flex-end;
      padding: 6px 10px 0;
    }
    .ov-copy-btn {
      all: unset; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 6px;
      font-size: 10px; color: var(--muted);
      transition: color 120ms, background 120ms;
    }
    .ov-copy-btn:hover { color: var(--fg); background: rgba(0,0,0,0.04); }
    .mira-widget.dark .ov-copy-btn:hover { background: rgba(255,255,255,0.05); }
    .ov-log-scroll { max-height: 280px; overflow-y: auto; padding: 6px 14px 14px; }
    .ov-log-scroll::-webkit-scrollbar { width: 4px; }
    .ov-log-scroll::-webkit-scrollbar-track { background: transparent; }
    .ov-log-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

    /* ── Log group — matches fill-bar.tsx ── */
    .ov-log-group { margin-bottom: 10px; }
    .ov-log-group:last-child { margin-bottom: 0; }
    .ov-log-group-head {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 0 4px; position: sticky; top: 0;
      background: var(--bg-alt); z-index: 1;
    }
    .ov-log-group-name { font-size: 10px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-family: inherit; }
    .ov-log-group-count { font-size: 10px; color: var(--dim); font-family: inherit; }

    /* ── Log item — matches fill-bar.tsx LogItem ── */
    .ov-log-item {
      padding: 4px 6px; border-radius: 4px;
      transition: background 0.1s;
    }
    .ov-log-item:hover { background: var(--dim); }
    .ov-log-item-top { display: flex; align-items: center; gap: 4px; }
    .ov-log-item-field {
      font-size: 11px; color: var(--fg); opacity: 0.6;
      flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: inherit;
    }
    .ov-log-item-detail {
      font-size: 10px; color: var(--muted); margin-top: 1px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: inherit;
    }
    .ov-log-item-detail.muted { opacity: 0.7; }

    /* Tags — ML, AB badges matching fill-bar */
    .ov-tag {
      flex-shrink: 0; font-size: 8px; font-weight: 500; font-family: inherit;
      padding: 1px 4px; border-radius: 3px;
      background: var(--dim); color: var(--muted);
    }
    .ov-tag-green { background: rgba(16,185,129,0.1); color: #059669; }
    .ov-tag-amber { background: rgba(245,158,11,0.1); color: #d97706; }

    /* ── Log overflow button ── */
    .ov-log-more {
      display: block; width: 100%; text-align: center;
      padding: 6px 0; margin-top: 4px;
      font-size: 10px; font-family: inherit;
      color: var(--muted); background: none; border: none;
      cursor: pointer; transition: color 0.15s;
    }
    .ov-log-more:hover { color: var(--fg); }

    /* ── Timer ── */
    .ov-timer-track { position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; }
    .ov-timer-bar {
      height: 100%; width: 100%; background: var(--fg); opacity: 0.12;
      animation: shrink 8s linear forwards; transform-origin: left;
    }
    .ov-timer-bar.paused { animation-play-state: paused; }
    @keyframes shrink { from { width: 100%; } to { width: 0%; } }

    @media (prefers-reduced-motion: reduce) {
      .ov-shimmer, .ov-timer-bar { animation: none; }
    }
  `;
}
