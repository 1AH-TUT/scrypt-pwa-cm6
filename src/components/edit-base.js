import { LitElement, html, css } from 'lit';

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
  static properties = { value: { type: String } };

  static styles = css`
    :host { display: block; }
    .inputlike {
      font-size: var(--font-size-screenplay, 14pt);
      width: 100%;
      box-sizing: border-box;
      padding: 0.25em 1em;
      margin: 0.5em 0;
    }
    .invalid { border: 2px solid #e53935; }
  `;

  /* ---------- Hooks for subclasses ---------- */
  _renderControl() { return html``; }
  _getPatch()      { return { text: this.value ?? '' }; }
  /* ------------------------------------------ */

  firstUpdated()  { this.shadowRoot.querySelector('.focus')?.focus(); }
  render()        { return this._renderControl(); }

  /* ---------- Shared save / cancel ---------- */
  _finish(type) {
    if (type === 'save') {
      const patch = this._getPatch();
      if (patch) {
        this.dispatchEvent(
          new CustomEvent('save', { detail: patch, bubbles: true, composed: true })
        );
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

      /* If Tab would leave the widget → intercept & save */
      if ( (!e.shiftKey && atLast) || (e.shiftKey && atFirst) ) {
        e.preventDefault();
        this._finish('save');
      }
      /* otherwise let Tab move within the widget (do not preventDefault) */
    }
  }
}
