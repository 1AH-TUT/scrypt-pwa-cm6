import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';

/**
 * @component
 * EditTransition — dropdown widget for editing 'transition' lines.
 *
 * @extends EditBase
 * @property {string} value - Current transition text/value.
 * @property {string[]} transitionOptions - Array of transition options.
 * @fires save   - CustomEvent<{ text: string }>, on save (always uppercased).
 * @fires cancel - Event, on cancel.
 */
export class EditTransition extends EditBase {
  static styles = [
    EditBase.styles,
    css`
      .right { display: flex; justify-content: flex-end; }
      select { min-width: 14ch; max-width: 20ch; text-align: right; }
      .inputlike { font-size: smaller}
    `
  ];

  static properties = {
    ...EditBase.properties,
    transitionOptions: { type: Array }
  };

  _renderControl() {
    const opt = (v, sel) => html`<option value=${v} ?selected=${sel}>${v}</option>`;

    return html`<div class="right" role="group" aria-label="Transition">
        <select
          class="inputlike focus"
          aria-label="Transition type"
          @keydown=${this._onKeydown}
          @blur=${this._maybeSaveOnWidgetBlur}
        >
          ${this.transitionOptions.map(o => opt(o, o === this.value))}
        </select>
      </div>`;
  }

  _getPatch() {
    const text = this.shadowRoot.querySelector('select')?.value.toUpperCase() ?? '';
    return { text };
  }
}
customElements.define('edit-transition', EditTransition);
