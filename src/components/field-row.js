// src/components/field-row.js
import { LitElement, css, html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { sanitizeText, CONTACT_RULES, TITLE_FIELD_RULES } from '../misc/text-sanitiser.js';


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
 * The parent page/component is responsible for validation and updating `error` as needed.
 */
export class FieldRow extends LitElement {
  static sanitizeRules = {
    default: TITLE_FIELD_RULES,
    contact: CONTACT_RULES
  };

  static styles = css`
    :host  { display: grid; grid-template-columns: 8rem 1fr; gap: .8rem; }
    label  { font-weight: 600; align-self: center; }
    input, textarea {
      font: inherit; width: 100%; padding: .4rem; box-sizing: border-box;
      caret-color: var(--fg-editor, currentColor);
    }
    .error { color: #e53935; font-size: smaller; grid-column: 2/3; }
  `;

  static properties = {
    field : { type:Object },
    value : { type:String },
    error : { type:String },
    rulesKey  : { type: String,  attribute: 'rules-key' },
    autoFocus : { type: Boolean }
  };

  constructor() {
    super();
    this.rulesKey = 'default';
    this.autoFocus = false;
  }

  firstUpdated() {
    if (this.autoFocus) {
      this.renderRoot.querySelector('input, textarea')?.focus();
    }
  }

  /* --- Helpers --- */

  _ruleFor() {
    const map = this.constructor.sanitizeRules;
    return map?.[ this.rulesKey ] || map?.default || DEFAULT_RULES;
  }

  /**  Apply the sanitizer and keep the caret where the user expects it */
  _sanitizeWithCaret(orig, inserted, selStart, selEnd, rules) {
    const before   = orig.slice(0, selStart);
    const after    = orig.slice(selEnd);
    const intended = before + inserted + after;

    // Full sanitised text
    const { clean } = sanitizeText(intended, rules);

    // Sanitize only the text up to (and incl.) the caret
    const { clean: prefix } = sanitizeText(before + inserted, rules);
    const caret = Math.min(prefix.length, clean.length);
    return { clean, caret };
  }

  /* --- Event Handlers --- */
  #emit(clean) {
    if (clean === this.value) return;
    this.dispatchEvent(new CustomEvent('value-changed', {
      detail: { key: this.field.key, value: clean }
    }));
  }


  #onPaste = (e) => {
    if (!(e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement)) return;

    e.preventDefault();
    const ta = e.target;
    const paste = (e.clipboardData ?? window.clipboardData).getData('text');
    const { selectionStart: s, selectionEnd: end, value: orig } = ta;
    const { clean, caret } = this._sanitizeWithCaret(orig, paste, s, end, this._ruleFor());

    ta.value = clean;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input', { bubbles:true }));   // keep Lit in sync
    
    this.#emit(clean);
  };

  #onInput = e => {
    const ta = e.target;
    const { selectionStart:s, selectionEnd:end, value:orig } = ta;

    let { clean, caret } =
      this._sanitizeWithCaret(orig, '', s, end, this._ruleFor());

    // field.maxLength wins over rules.maxCols (pick one or merge)
    if (this.field.maxLength && clean.length > this.field.maxLength) {
      clean = clean.slice(0, this.field.maxLength);
      caret = Math.min(caret, clean.length);
    }

    if (ta.value !== clean) {
      ta.value = clean;
      ta.setSelectionRange(caret, caret);
    }

    this.#emit(clean);
  };

  /* --- Dom rendering --- */

  renderInput() {
    const { type='text', key, placeholder='', maxLength, rows } = this.field;

    if (type === 'textarea')
      return html`<textarea
        rows=${rows || 3} id=${key}
        type=${type}
        .value=${this.value || ''} 
        placeholder=${placeholder}
        maxlength=${ifDefined(maxLength)}
        @paste=${this.#onPaste}
        @input=${this.#onInput}></textarea>`;

   // all others for now
   return html`<input
    id=${key}
    type=${type}
    .value=${this.value || ''} 
    placeholder=${placeholder}
    maxlength=${ifDefined(maxLength)}
    @paste=${this.#onPaste}
    @input=${this.#onInput}>`;
  }

  render() {
    const { label, required } = this.field;
    return html`
      <label for=${this.field.key}>
        ${label}${required ? html`<span aria-hidden="true">*</span>` : ''}
      </label>
      ${this.renderInput()}
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
    `;
  }

}

customElements.define('field-row', FieldRow);
