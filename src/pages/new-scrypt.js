// pages/new-scrypt.js
import { html, css } from 'lit';
import PageBase from '../components/page-base.js';
import { TITLE_PAGE_FIELDS } from '../scrypt/fields.js';
import { saveScrypt } from '../data-layer/db.js';
import { getBlankTemplate } from '../scrypt/default-options.js'; // your helper

import '../components/field-row.js';
import { prettyDate } from "../misc/helpers.js";

class NewScryptPage extends PageBase {
  static styles = [
    PageBase.styles,
    css`
      form   { display: flex; flex-direction: column; gap: 1.2rem; max-width: 8.5in; }
      footer { display: flex; gap: .8rem; justify-content: flex-end; margin-top: 1rem; }
      .msg   { min-height: 1.4em; }
    `
  ];

  static properties = {
    formData : { state:true },
    errors : { state:true },
    saving : { state:true }
  };

  constructor(){
    super();
    const today = new Date().toISOString().slice(0,10);
    this.formData = Object.fromEntries(TITLE_PAGE_FIELDS.map(f=>[f.key, f.key === 'date' ? today : '']));
    this.errors = {};
    this.saving = false;
  }

  render(){
    return html`<h2>New Scrypt</h2>

      <form @submit=${this.#submit}>
        ${TITLE_PAGE_FIELDS.map(f => html`<field-row
            .field=${f}
            .value=${this.formData[f.key]}
            .error=${this.errors[f.key]||''}
            @value-changed=${this.#updateValue}>
          </field-row>`)}

        <div class="msg" style="color:#e53935">${ this.errors._global || ''}</div>

        <footer>
          <button type=button @click=${ () => history.back() } ?disabled=${ this.saving }>Cancel</button>
          <button type=submit ?disabled=${this.saving || !this.#isValid()}>
            ${this.saving ? 'Creating…' : 'Create & Open'}
          </button>
        </footer>
      </form>`;
  }

  // Update state
  #updateValue(e){
    const {key,value} = e.detail;
    this.formData = { ...this.formData, [key]: value };
    // clear inline error as user types
    if (this.errors[key]) {
      const { [key]:_, ...rest } = this.errors;
      this.errors = rest;
    }
  }

  #isValid(){ return TITLE_PAGE_FIELDS.every(f => !f.required || this.formData[f.key].trim().length); }

  #validate(){
    const errs = {};
    TITLE_PAGE_FIELDS.forEach(f=>{ if (f.required && !this.formData[f.key].trim()) errs[f.key]=f.msgRequired; });
    this.errors = errs;
    return Object.keys(errs).length === 0;
  }

  async #submit(e){
    e.preventDefault();
    if (!this.#validate()) return;

    this.saving = true;
    try {
      const draft = getBlankTemplate();
      Object.assign(draft.titlePage, this.formData);
      draft.titlePage.date = prettyDate(draft.titlePage.date);

      const id = await saveScrypt(draft);

      this.dispatchEvent(new CustomEvent('open-scrypt', { detail:{ id, view:'editor' }, bubbles:true, composed:true }));
    } catch(err){
      this.errors = { _global: err.message };
    } finally {
      this.saving = false;
    }
  }
}
customElements.define('new-scrypt-page', NewScryptPage);
export default () => document.createElement('new-scrypt-page');
