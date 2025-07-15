// components/field-row.js
import { LitElement, css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

/**
 * <field-row>
 *
 * form‑row component consisting of:
 *   • a left‑hand <label>
 *   • a right‑hand <input> or <textarea>
 *   • an optional inline error message.
 *
 * public API:
 * field { Object } configuration describing the control to render. Expected keys:
 *     {
 *       key:         string,       // unique field id / name
 *       label:       string,       // human‑readable label text
 *       type:        'text' | 'date' | 'textarea' | any valid <input type>
 *       placeholder: string,       // optional placeholder text
 *       required:    boolean,      // marks the label with * and used by parent validation
 *       maxLength:   number,       // (optional) hard character limit, enforced locally
 *       rows:        number        // (textarea only) visible rows
 *     }
 *
 * value { String } – current value (supplied by parent form).
 * error { String } – validation message to display under the control.
 *
 * ### Events
 * Fires **`value-changed`** whenever the user edits the control:
 * { detail: { key: field.key, value: newValue } }
 * The parent page/component is responsible for validation and updating
 * `error` as needed.
 */
export class FieldRow extends LitElement {
  static styles = css`
    :host  { display: grid; grid-template-columns: 8rem 1fr; gap: .8rem; }
    label  { font-weight: 600; align-self: center; }
    input, textarea {
      font: inherit; width: 100%; padding: .4rem;
      box-sizing: border-box;
    }
    .error { color: #e53935; font-size: smaller; grid-column: 2/3; }
  `;

  static properties = {
    field : { type:Object },
    value : { type:String },
    error : { type:String }
  };

  #onInput(e) {
    const f = this.field;
    let val = e.target.value;
    if (f.maxLength && val.length > f.maxLength) {
      val = val.slice(0, f.maxLength);           // hard truncate
      e.target.value = val;                      // reflect in UI
    }
    this.dispatchEvent(new CustomEvent('value-changed',{ detail:{ key: f.key, value: val } }));
  }

  renderInput() {
    const { type='text', key, placeholder='', maxLength, rows } = this.field;

    if (type === 'textarea')
      return html`<textarea
        rows=${rows || 3} id=${key}
        type=${type}
        .value=${this.value || ''} 
        placeholder=${placeholder}
        maxlength=${ifDefined(maxLength)}
        @input=${this.#onInput}></textarea>`;

   // all others for now
   return html`<input
    id=${key}
    type=${type}
    .value=${this.value || ''} 
    placeholder=${placeholder}
    maxlength=${ifDefined(maxLength)}
    @input=${this.#onInput}>`;
  }

  render() {
    const { label, required } = this.field;
    return html`
      <label for=${this.field.key}>
        ${label}${required? html`<span aria-hidden="true">*</span>`:''}
      </label>
      ${this.renderInput()}
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
    `;
  }
}
customElements.define('field-row', FieldRow);
