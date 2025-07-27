// src/components/edit-title-input.js
import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';
import { TITLE_FIELD_RULES } from "../misc/text-sanitiser.js";

/**
 * <edit-title-input
 *      field="title"           // required: which title-page key
 *      align="center|right">   // optional (default centre)
 * </edit-title-input>
 */
export class EditTitleInput extends EditBase {
  static sanitizeRules = TITLE_FIELD_RULES;

  static styles = [
    EditBase.styles,
    css`
      :host                         { display:block; width:100%; }
      :host([align="center"]) input { text-align:center; width:100%; margin:0 auto; }
      :host([align="right"])  input { text-align:right;  width:100%; }
      :host([align="left"])   input { text-align:left;  width:100%; }
      :host([field="title"])  input { font-size: var(--font-size-screenplay-title, 16pt); margin-top: 1in; text-transform: uppercase; }
      input                         { font-size:inherit; }
    `
  ];

  static properties = {
    field       : { type:String, reflect:true },
    align       : { type:String, reflect:true },
    required    : { type:Boolean },
  };

  constructor(){
    super();
    this.align = 'center';
    this.required = true;
  }

  _renderControl(){
    return html`<input class="inputlike title-input"
     .value=${this.value ?? ''}
     placeholder=${this.placeholder ?? ''}
     data-sanitize="default"
     @keydown=${this._onKeydown} >`;
  }

  _getPatch(){
    if(this.required && !this._validate(['input.title-input'])) return null;
    return { field:this.field, text:this.shadowRoot.querySelector('input').value.trim() };
  }
}
customElements.define('edit-title-input', EditTitleInput);
