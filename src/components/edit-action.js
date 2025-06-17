import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';

/**
 * @component
 * EditAction — textarea widget for editing 'action' lines.
 *
 * @extends EditBase
 * @property {string} value - Action text to edit.
 * @fires save   - CustomEvent<{ text: string }>, on save.
 * @fires cancel - Event, on cancel.
 */
export class EditAction extends EditBase {
  static styles = [
    EditBase.styles,
    css`textarea { height: 10rem; border: 0; resize: vertical; }`
  ];

  /* DOM */
  _renderControl() {
    return html`<textarea
        class="inputlike focus"
        .value=${this.value ?? ''}
        @keydown=${this._onKeydown}
        aria-label="Action description"
      ></textarea>`;
  }

  /* Patch object */
  _getPatch() {
    const text = this.shadowRoot.querySelector('textarea')?.value ?? '';
    return { text: text.trim() };
  }
}
customElements.define('edit-action', EditAction);
