/**
 * MAIN world content script — runs in the page's JavaScript context.
 *
 * Provides form field automation by simulating user interactions:
 * - setText: fill text inputs/textareas with full event sequence
 * - reactClick: invoke React onClick handlers with native fallback
 * - setChecked: toggle checkboxes/radios with proper change detection
 * - setSelect: set native select values with event dispatch
 *
 * Runs in the MAIN world to access React internals (__reactProps$,
 * __reactFiber$) needed for SPA form filling. Communicates with the
 * content script via window.postMessage using a '__mira' protocol.
 * No data leaves the page — all operations are local DOM manipulation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  registration: 'runtime',

  main() {
    if ((window as unknown as Record<string, unknown>).__miraPageScriptLoaded) return;
    (window as unknown as Record<string, unknown>).__miraPageScriptLoaded = true;

    const PROTOCOL = '__mira';
    const EVT_OPTS = { bubbles: true, cancelable: true };

    function getReactPropsKey(el: Element): string | null {
      return Object.keys(el).find((k) => /^(__reactProps|__reactEventHandlers)\$/.test(k)) ?? null;
    }

    /**
     * Simplify's core event dispatch: fire native DOM event AND call React handler.
     * Used for text/select fills where React needs to process onChange.
     */
    function dispatchDual(
      el: Element,
      EventCtor: new (type: string, init?: Record<string, unknown>) => Event,
      eventName: string,
      reactHandlerName: string,
    ): void {
      try {
        const evt = new (EventCtor as any)(eventName, EVT_OPTS);
        try {
          Object.defineProperty(evt, 'target', { writable: false, value: el });
          Object.defineProperty(evt, 'currentTarget', { writable: false, value: el });
        } catch {
          /* some events don't allow defineProperty */
        }

        el.dispatchEvent(evt);

        const propsKey = getReactPropsKey(el);
        if (propsKey) {
          const handler = (el as any)[propsKey]?.[reactHandlerName];
          if (typeof handler === 'function') {
            (evt as any).nativeEvent = evt;
            handler(evt);
          }
        }
      } catch {
        /* swallow */
      }
    }

    function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;

      const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      const ownSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
      if (protoSetter && ownSetter && protoSetter !== ownSetter) {
        protoSetter.call(el, value);
      } else if (ownSetter) {
        ownSetter.call(el, value);
      }

      el.value = value;
      el.setAttribute('value', value);
    }

    function setText(
      el: HTMLInputElement | HTMLTextAreaElement,
      value: string,
      skipBlur = false,
    ): boolean {
      // Reset React's value tracker so it detects the change
      const tracker = (el as any)._valueTracker;
      if (tracker) tracker.setValue('');

      // dispatchDual needed for text inputs — React's onChange requires
      // the direct handler call to update form state properly.
      dispatchDual(el, FocusEvent, 'focus', 'onFocus');
      el.dispatchEvent(new FocusEvent('focusin', EVT_OPTS));
      dispatchDual(el, MouseEvent, 'click', 'onClick');
      el.dispatchEvent(new KeyboardEvent('keydown', EVT_OPTS));
      el.dispatchEvent(new KeyboardEvent('keypress', EVT_OPTS));

      setValue(el, value);

      el.dispatchEvent(new CustomEvent('textInput', EVT_OPTS));
      dispatchDual(el, InputEvent, 'input', 'onInput');
      el.dispatchEvent(new KeyboardEvent('keyup', EVT_OPTS));
      dispatchDual(el, Event, 'change', 'onChange');

      if (!skipBlur) {
        dispatchDual(el, FocusEvent, 'blur', 'onBlur');
        el.dispatchEvent(new FocusEvent('focusout', EVT_OPTS));
      }

      return el.value === value;
    }

    function reactClick(el: Element): void {
      try {
        const propsKey = getReactPropsKey(el);
        if (!propsKey) throw Error();
        const handler = (el as any)[propsKey]?.onClick;
        if (typeof handler !== 'function') throw Error();
        const evt = new MouseEvent('click', EVT_OPTS);
        Object.defineProperty(evt, 'target', { writable: false, value: el });
        Object.defineProperty(evt, 'currentTarget', { writable: false, value: el });
        handler(evt);
      } catch {
        (el as HTMLElement).click();
      }
    }

    function setChecked(el: HTMLInputElement, checked: boolean): void {
      if (el.checked !== checked) {
        // Reset React's value tracker so it detects the change
        const tracker = (el as any)._valueTracker;
        if (tracker) tracker.setValue(String(!checked));

        dispatchDual(el, FocusEvent, 'focus', 'onFocus');
        dispatchDual(el, MouseEvent, 'click', 'onClick');
        el.checked = checked;
        dispatchDual(el, InputEvent, 'input', 'onInput');
        dispatchDual(el, Event, 'change', 'onChange');
        dispatchDual(el, FocusEvent, 'blur', 'onBlur');
      }
    }

    function clickElement(el: Element): void {
      dispatchDual(el, FocusEvent, 'focus', 'onFocus');
      dispatchDual(el, MouseEvent, 'mousedown', 'onMouseDown');
      dispatchDual(el, MouseEvent, 'mouseup', 'onMouseUp');
      dispatchDual(el, MouseEvent, 'click', 'onClick');
      dispatchDual(el, FocusEvent, 'blur', 'onBlur');
    }

    function setSelect(el: HTMLSelectElement, value: string): boolean {
      el.focus();
      el.click();
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new InputEvent('input', EVT_OPTS));
      el.dispatchEvent(new Event('change', EVT_OPTS));
      el.dispatchEvent(new FocusEvent('blur', EVT_OPTS));
      return el.value === value;
    }

    function findFiber(el: Element) {
      const key = Object.keys(el).find(
        (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
      );
      return key ? (el as any)[key] : null;
    }

    function getSelectState(el: Element) {
      const starts = [el];
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        starts.push(parent);
        parent = parent.parentElement;
      }

      for (const node of starts) {
        let fiber = findFiber(node);
        for (let d = 0; d < 15 && fiber; d++) {
          const props = fiber.memoizedProps || fiber.pendingProps;
          if (props && typeof props.onChange === 'function' && Array.isArray(props.options)) {
            const value = props.value;
            let currentValue: string | null = null;
            if (value) {
              currentValue = Array.isArray(value)
                ? value.map((v: any) => v.label ?? v).join(', ')
                : (value.label ?? value);
            }
            return {
              options: props.options.map((o: any) => ({
                label: o.label,
                value: String(o.value ?? o.label),
              })),
              currentValue,
              isMulti: !!props.isMulti,
              onChange: props.onChange,
            };
          }
          fiber = fiber.return;
        }
      }
      return null;
    }

    function setSelectValue(el: Element, label: string): boolean {
      const state = getSelectState(el);
      if (!state?.onChange) return false;
      const normalized = label.toLowerCase().trim();
      const match =
        state.options.find(
          (o: any) =>
            (o.label ?? '').toLowerCase().trim() === normalized ||
            (o.value ?? '').toLowerCase().trim() === normalized,
        ) ??
        state.options.find((o: any) => {
          const l = (o.label ?? '').toLowerCase().trim();
          return l
            ? new RegExp('\\b' + normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(
                l,
              ) ||
                (normalized.length >= 8 && normalized.includes(l))
            : false;
        });
      if (!match) return false;
      if (state.isMulti) {
        const current = Array.isArray(state.currentValue) ? state.currentValue : [];
        state.onChange([...current, match], { action: 'select-option', option: match });
      } else {
        state.onChange(match, { action: 'select-option', option: match });
      }
      return true;
    }

    function findElement(miraId: string): HTMLElement | null {
      return document.querySelector(`[data-mira-id="${miraId}"]`);
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object' || !msg[PROTOCOL] || !msg.id || !msg.action) return;

      const el = msg.miraId ? findElement(msg.miraId) : null;
      const reply = (data: Record<string, unknown>) =>
        window.postMessage({ [PROTOCOL]: true, id: msg.id, ...data }, '*');

      try {
        switch (msg.action) {
          case 'setText': {
            if (
              !el ||
              (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement))
            ) {
              reply({ success: false });
              return;
            }
            const success = setText(
              el as HTMLInputElement | HTMLTextAreaElement,
              msg.value,
              msg.skipBlur,
            );
            reply({ success });
            return;
          }

          case 'typeText': {
            if (!el || !(el instanceof HTMLInputElement)) {
              reply({ success: false });
              return;
            }
            el.focus();
            el.select();
            document.execCommand('delete', false);
            for (const char of String(msg.value)) {
              document.execCommand('insertText', false, char);
            }
            reply({ success: el.value === msg.value });
            return;
          }

          case 'setComboboxValue': {
            if (!el || !(el instanceof HTMLInputElement)) {
              reply({ success: false });
              return;
            }
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            el.focus();
            el.click();
            const tracker = (el as any)._valueTracker;
            if (tracker) tracker.setValue('');
            setValue(el as HTMLInputElement, msg.value);
            dispatchDual(el, InputEvent, 'input', 'onInput');
            dispatchDual(el, Event, 'change', 'onChange');
            reply({ success: true });
            return;
          }

          case 'click': {
            if (!el) {
              reply({ success: false });
              return;
            }
            clickElement(el);
            reply({ success: true });
            return;
          }

          case 'keyDown': {
            if (!el) {
              reply({ success: false });
              return;
            }
            const kbEvt = new KeyboardEvent('keydown', {
              key: msg.key,
              code: msg.code ?? '',
              keyCode: msg.keyCode ?? 0,
              bubbles: true,
              cancelable: true,
            });
            el.dispatchEvent(kbEvt);
            const propsKey = getReactPropsKey(el);
            if (propsKey) {
              const handler = (el as any)[propsKey]?.onKeyDown;
              if (typeof handler === 'function') {
                (kbEvt as any).nativeEvent = kbEvt;
                handler(kbEvt);
              }
            }
            reply({ success: true });
            return;
          }

          case 'clickButtonGroup': {
            if (!el) {
              reply({ success: false });
              return;
            }
            // Use reactClick for a single invocation of the React onClick handler.
            // dispatchDual would double-fire: once via native event bubbling to
            // React's root listener, and once via direct handler call — toggling
            // the button back. Focus/blur are safe (non-toggling) and help Ashby
            // detect the field as "touched" for validation.
            el.dispatchEvent(new FocusEvent('focus', EVT_OPTS));
            reactClick(el);
            const fieldEntry = el.closest('[class*="fieldEntry"], [class*="field-entry"]');
            if (fieldEntry) {
              const hiddenCb = fieldEntry.querySelector(
                'input[type="checkbox"][tabindex="-1"]',
              ) as HTMLInputElement | null;
              if (hiddenCb) {
                const tracker = (hiddenCb as any)._valueTracker;
                if (tracker) tracker.setValue('');
                hiddenCb.checked = true;
                hiddenCb.dispatchEvent(new InputEvent('input', EVT_OPTS));
                hiddenCb.dispatchEvent(new Event('change', EVT_OPTS));
              }
            }
            el.dispatchEvent(new FocusEvent('blur', EVT_OPTS));
            reply({ success: true });
            return;
          }

          case 'setChecked': {
            if (!el || !(el instanceof HTMLInputElement)) {
              reply({ success: false });
              return;
            }
            setChecked(el, msg.checked);
            reply({ success: true });
            return;
          }

          case 'setSelect': {
            if (!el || !(el instanceof HTMLSelectElement)) {
              reply({ success: false });
              return;
            }
            reply({ success: setSelect(el, msg.value) });
            return;
          }

          case 'getSelectState': {
            if (!el) {
              reply({ success: false });
              return;
            }
            const state = getSelectState(el);
            if (!state) {
              reply({ success: false });
              return;
            }
            reply({
              success: true,
              result: {
                options: state.options,
                currentValue: state.currentValue,
                isMulti: state.isMulti,
              },
            });
            return;
          }

          case 'setSelectValue': {
            if (!el) {
              reply({ success: false });
              return;
            }
            reply({ success: setSelectValue(el, msg.label) });
            return;
          }

          case 'ping': {
            reply({ success: true });
            return;
          }
        }
      } catch {
        reply({ success: false, error: 'exception' });
      }
    });

    // Signal ready
    window.postMessage({ [PROTOCOL]: true, action: 'ready' }, '*');
  },
});
