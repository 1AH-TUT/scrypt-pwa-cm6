// src/components/edit-title-contact.js
import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';
import { CONTACT_RULES, sanitizeText } from "../misc/text-sanitiser.js";


export class EditTitleContact extends EditBase {
  static sanitizeRules = CONTACT_RULES;

  constructor(){
    super();
    this.required = false;
  }

  static styles = [
    EditBase.styles,
    css`
      :host        { display:block; width:100%; }
      textarea     { text-align:left; width:100%; height:8rem; resize:vertical; font-size: smaller }
    `
  ];

  static properties = {
    field:        { type:String },
    required:     { type:Boolean }
  };

  _renderControl(){
    return html`<textarea
        class="inputlike contact-area"
        .value=${this.value ?? ''}
        @keydown=${this._onKeydown}
        placeholder=${this.placeholder ?? ''}
        aria-label="contact information"
        rows="${EditTitleContact.sanitizeRules['maxLines']}"
      ></textarea>`;
  }
  _getPatch(){
    if(this.required && !this._validate(['textarea.contact-area'])) return null;
    return { field: this.field, text:this.shadowRoot.querySelector('textarea').value.trim() };
  }

}
customElements.define('edit-title-contact', EditTitleContact);
