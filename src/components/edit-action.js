// src/components/edit-action.js
import { LitElement, html, css } from 'lit';

export class EditAction extends LitElement {
  static properties = { text: { type: String } };
  static styles = css`
    :host { display: block; border: 5px solid #00bfff; font-size: 0; }
    textarea { width: 100%; height: 10rem; font:inherit; box-sizing: border-box; border: 0; font-size: var(--font-size-screenplay)}
  `;
  firstUpdated() {
    const ta = this.renderRoot.querySelector('textarea');
    if (ta) ta.focus();
  }
  render() {
    return html`<textarea .value=${this.text} @keydown=${this._onKeydown}></textarea>`;
  }

  _onKeydown(e) {
    const ta = /** @type {HTMLTextAreaElement} */(e.target);
    if (e.key === 'Escape') {
      e.preventDefault();
      this.dispatchEvent(new Event('cancel', { bubbles:true, composed:true }));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('save', {
        detail: { text: ta.value },
        bubbles: true, composed: true
      }));
    }
  }
}

customElements.define('edit-action', EditAction);
