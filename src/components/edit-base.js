import { LitElement, html, css } from 'lit';
import { sanitizeText, DEFAULT_RULES } from "../misc/text-sanitiser.js";

/**
 * @component
 * Base class for all in-place edit widgets (LitElement).
 *
 * @abstract
 * @property {string|object} value - Current value to edit.
 * @method _renderControl - Must be implemented by subclasses to provide widget DOM.
 * @method _getPatch - Optionally override to provide patch object for 'save' event.
 * @fires save   - CustomEvent with detail: patch object, on successful save.
 * @fires cancel - Event on cancel.
 */
export class EditBase extends LitElement {
  static sanitizeRules = DEFAULT_RULES;
  #committed = false;

  static properties = {
    value: { type: String },
    placeholder:  { type:String },
  };

  static styles = css`
    :host { display: block; }
    .inputlike {
      font-size: var(--font-size-screenplay, 14pt);
      width: 100%;
      box-sizing: border-box;
      padding: 0.25em 1em;
      margin: 0.5em 0;
      color: var(--fg-editor, currentColor);
      caret-color: var(--fg-editor, currentColor);
    }
    .invalid { border: 2px solid #e53935; outline:2px solid #e53935; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('focusout', this._maybeSaveOnWidgetBlur, true);
  }
  disconnectedCallback() {
    this.removeEventListener('focusout', this._maybeSaveOnWidgetBlur, true);
    super.disconnectedCallback();
  }
  _maybeSaveOnWidgetBlur = (e) => {
    // If focus is still inside this widget, do nothing
    if (this.contains(e.relatedTarget)) return;
    // Defer the save until after the current CM6 update finishes
    setTimeout(() => {
      this._finish('save');
    }, 0);
  };

  /* ---------- Hooks for subclasses ---------- */
  _renderControl() { return html``; }
  _getPatch()      { return { text: this.value ?? '' }; }
  /* ------------------------------------------ */

  firstUpdated() {
    const textInputs = this.shadowRoot.querySelectorAll('input[data-sanitize], textarea[data-sanitize]');
    textInputs.forEach(el => {
      el.addEventListener('input', this._onInput);
      el.addEventListener('paste', this._onPaste);
    });
    const focusables = this.shadowRoot.querySelectorAll('input, select, textarea');
    focusables[0]?.focus();
  }

  render() { return this._renderControl(); }

  /**
   * Validate that each selector has a non-empty, trimmed value.
   * Adds `.invalid` and wires up one-time clear on next input/change.
   * @param {string[]} selectors  – e.g. ['select.indicator','input.location']
   * @returns {boolean}  – true if all fields are valid
   */
  _validate(selectors) {
    const invalidEls = selectors
      .map(sel => this.shadowRoot.querySelector(sel))
      .filter(el => el && !el.value.trim());

    if (invalidEls.length) {
      invalidEls.forEach(el => {
        el.classList.add('invalid');
        const clear = () => {
          el.classList.remove('invalid');
          el.removeEventListener('input', clear);
          el.removeEventListener('change', clear);
        };
        el.addEventListener('input', clear, { once: true });
        el.addEventListener('change', clear, { once: true });
      });
      return false;
    }
    return true;
  }

  /* ---------- Shared save / cancel ---------- */
  _finish(type) {
    if (this.#committed) return; // already fired once
    this.#committed = true;

    if (type === 'save') {
      const patch = this._getPatch();
      if (patch) {
        this.dispatchEvent(new CustomEvent('save', { detail: patch, bubbles: true, composed: true }));
      }
      else {
        this.#committed = false;
      }
    } else {
      this.dispatchEvent(new Event('cancel', { bubbles: true, composed: true }));
    }
  }

  /* ---------- Keyboard handling ---------- */
  _onKeydown(e) {
    /* Esc → cancel */
    if (e.key === 'Escape') {
      e.preventDefault();
      return this._finish('cancel');
    }

    /* Ctrl+Enter → explicit save (even in <textarea>) */
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      return this._finish('save');
    }

    /* Enter in non-textarea → save */
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      return this._finish('save');
    }

    /* Tab navigation */
    if (e.key === 'Tab') {
      const focusables = [...this.shadowRoot.querySelectorAll(
        'input, select, textarea'
      )].filter(el => !el.disabled && el.tabIndex >= 0);

      if (!focusables.length) return;

      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      const atFirst = (e.target === first);
      const atLast  = (e.target === last);

      // If Tab would leave the widget → intercept & save
      if ( (!e.shiftKey && atLast) || (e.shiftKey && atFirst) ) {
        e.preventDefault();
        e.stopPropagation();  // prevent CodeMirror from seeing this Tab
        this._finish('save');
      }
    }
  }

  /* ---------- String sanitization ---------- */
  _sanitize(str) {
    const { clean } = sanitizeText(str, this.constructor.sanitizeRules);
    return clean;
  }

  _ruleFor(el) {
    const map = this.constructor.sanitizeRules;
    if (!map) return DEFAULT_RULES;
    if (map.default && typeof map === 'object') {
      return map[el.dataset.sanitize] || map.default;
    }
    // legacy: single rule object
    return map;
  }

  /* Returns { clean, caret } where caret is the index to place the caret in the cleaned string */
  _sanitizeWithCaret(orig, inserted = '', selectionStart, selectionEnd, rules) {
    // Build the text as the user intends it before sanitizing
    const before    = orig.slice(0, selectionStart);
    const after     = orig.slice(selectionEnd);
    const intended  = before + inserted + after;

    // Sanitize the whole string
    const { clean } = sanitizeText(intended, rules);

    // Sanitize only the part before the caret
    const { clean: prefix } = sanitizeText(before + inserted, rules);

    // Place the caret at the end of the sanitized prefix
    const caret = Math.min(prefix.length, clean.length);

    return { clean, caret };
  }

  _onPaste = e => {
    e.preventDefault();
    const ta = e.currentTarget;
    const paste = (e.clipboardData ?? window.clipboardData).getData('text');
    const { selectionStart, selectionEnd, value: orig } = ta;
    const rules = this._ruleFor(ta);

    const { clean, caret } = this._sanitizeWithCaret(orig, paste, selectionStart, selectionEnd, rules);

    ta.value = clean;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };

  _onInput = e => {
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value: orig } = ta;
    const rules = this._ruleFor(ta);

    const { clean, caret } = this._sanitizeWithCaret(orig, '', selectionStart, selectionEnd, rules);

    if (ta.value !== clean) {
      ta.value = clean;
      ta.setSelectionRange(caret, caret);
    }
  };

}
