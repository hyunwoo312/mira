/**
 * Floating overlay UI injected into the host page via Shadow DOM.
 * Uses React + Framer Motion, rendered into a closed shadow root.
 */

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildStyles } from './overlay-styles';
import { OverlayApp, type OverlayState } from './overlay-component';
import { THEME_STORAGE_KEY as THEME_KEY } from '@/lib/theme';

const SETTINGS_KEY = 'mira_settings';
const DEFAULT_DISMISS_MS = 8000;

export interface FillResult {
  filled: number;
  failed: number;
  skipped: number;
  total: number;
  ats?: string;
  durationMs?: number;
  mlAvailable?: boolean;
  totalFormElements?: number;
}

export interface LogItem {
  field: string;
  value?: string;
  status: 'filled' | 'skipped' | 'failed';
  source?: string;
  confidence?: number;
  skipReason?: string;
  failReason?: string;
  attemptedValue?: string;
  widgetType?: string;
  category?: string;
  sectionHeading?: string;
  groupLabels?: string[];
  elementHint?: string;
}

export type Phase = 'ml-loading' | 'filling';

export class FillOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private reactRoot: Root;
  private isDark = false;
  private state: OverlayState = {
    visible: false,
    phase: null,
    result: null,
    logs: [],
    pageUrl: '',
    timerActive: false,
    timerPaused: false,
    isDark: false,
  };
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private timerStartedAt = 0;
  private timerElapsed = 0;
  private cleanupFns: (() => void)[] = [];

  constructor() {
    this.host = document.createElement('div');
    this.host.id = '__mira-overlay-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = buildStyles();
    this.shadow.appendChild(style);

    const container = document.createElement('div');
    this.shadow.appendChild(container);

    this.reactRoot = createRoot(container);
    document.documentElement.appendChild(this.host);

    // Load theme
    chrome.storage.local.get(THEME_KEY).then((r) => {
      this.isDark = r[THEME_KEY] === 'dark';
      this.state = { ...this.state, isDark: this.isDark };
      this.render();
    });

    // React to theme changes
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[THEME_KEY]) {
        this.isDark = changes[THEME_KEY].newValue === 'dark';
        this.state = { ...this.state, isDark: this.isDark };
        this.render();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    this.cleanupFns.push(() => chrome.storage.onChanged.removeListener(onStorage));

    const onUnload = () => this.destroy();
    window.addEventListener('beforeunload', onUnload);
    this.cleanupFns.push(() => window.removeEventListener('beforeunload', onUnload));

    this.render();
  }

  show(phase: Phase): void {
    this.clearDismissTimer();
    this.ensureAttached();
    this.state = {
      ...this.state,
      visible: true,
      phase,
      result: null,
      logs: [],
      pageUrl: window.location.href,
      timerActive: false,
      timerPaused: false,
      isDark: this.isDark,
    };
    this.render();
  }

  showResult(result: FillResult, logs?: LogItem[]): void {
    this.clearDismissTimer();
    this.ensureAttached();
    this.timerStartedAt = Date.now();
    this.timerElapsed = 0;
    this.state = {
      ...this.state,
      visible: true,
      phase: null,
      result,
      logs: logs ?? [],
      pageUrl: window.location.href,
      timerActive: true,
      timerPaused: false,
      isDark: this.isDark,
    };
    this.render();
    chrome.storage.local.get(SETTINGS_KEY).then((r) => {
      const settings = (r[SETTINGS_KEY] as { overlayDismissMs?: number | null }) ?? null;
      const dismissMs =
        settings && 'overlayDismissMs' in settings ? settings.overlayDismissMs : DEFAULT_DISMISS_MS;
      if (dismissMs == null) {
        this.state = { ...this.state, timerActive: false };
        this.render();
        return;
      }
      this.dismissTimer = setTimeout(() => this.dismiss(), dismissMs);
    });
  }

  dismiss(): void {
    this.clearDismissTimer();
    this.state = { ...this.state, visible: false, timerActive: false };
    this.render();
  }

  destroy(): void {
    this.clearDismissTimer();
    this.reactRoot.unmount();
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.host.remove();
  }

  private render(): void {
    this.reactRoot.render(
      createElement(OverlayApp, {
        state: this.state,
        onDismiss: () => this.dismiss(),
        onPauseDismiss: () => {
          this.clearDismissTimer();
          this.timerElapsed += Date.now() - this.timerStartedAt;
          this.state = { ...this.state, timerPaused: true };
          this.render();
        },
        onResumeDismiss: () => {
          if (!this.state.timerActive || this.state.phase) return;
          const remaining = Math.max(1000, DEFAULT_DISMISS_MS - this.timerElapsed);
          this.timerStartedAt = Date.now();
          this.state = { ...this.state, timerPaused: false };
          this.render();
          this.dismissTimer = setTimeout(() => this.dismiss(), remaining);
        },
        onOpenPanel: () => {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});
        },
        onToggleTheme: () => {
          this.isDark = !this.isDark;
          this.state = { ...this.state, isDark: this.isDark };
          chrome.storage.local.set({ [THEME_KEY]: this.isDark ? 'dark' : 'light' });
          this.render();
        },
      }),
    );
  }

  private ensureAttached(): void {
    if (!this.host.isConnected) {
      document.documentElement.appendChild(this.host);
    }
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}
