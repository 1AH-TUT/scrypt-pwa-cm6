import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';

export class EditAction extends EditBase {
  static styles = [
    EditBase.styles,
    css`textarea { height: 10rem; border: 0; }`
  ];

  /* DOM */
  _renderControl() {
    return html`<textarea
        class="inputlike focus"
        .value=${this.value ?? ''}
        @keydown=${this._onKeydown}
      ></textarea>`;
  }

  /* Patch object */
  _getPatch() {
    const text = this.shadowRoot.querySelector('textarea')?.value ?? '';
    return { text };
  }
}
customElements.define('edit-action', EditAction);
