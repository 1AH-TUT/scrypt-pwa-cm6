import { html, css } from 'lit';
import PageBase       from '../components/page-base.js';                 // re-use your base
import { saveScrypt } from '../data-layer/db.js';
import {getBlankTemplate} from "../scrypt/default-options.js";

function blankScrypt({ title, byline, date }) {
  const draft = getBlankTemplate();
  Object.assign(draft.titlePage, { title, byline, date });
  return draft
}

class NewScryptPage extends PageBase {
  static styles = [
    PageBase.styles,
    css`
      form   { display:flex; flex-direction:column; gap:1rem; max-width:26rem; }
      input  { font:inherit; padding:.4rem; }
      footer { display:flex; gap:.8rem; }
      .err   { color:#e53935; min-height:1.4em; }
    `
  ];

  static properties = {
    _saving: { state:true },   // disables button while awaiting save
    _err   : { state:true }
  };

  constructor() {
    super();
    this._saving = false;
    this._err    = '';
  }

  render() {
    const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    return html`
      <h2>Quick-Start • New Scrypt</h2>

      <form @submit=${this.#submit}>
        <label>
          Title (required)
          <input name=title required />
        </label>

        <label>
          Byline (required)
          <input name=byline required />
        </label>

        <label>
          Date
          <input name=date type=date .value=${today}/>
        </label>

        <div class="err">${this._err}</div>

        <footer>
          <button type=button
                  @click=${() => history.back()}
                  ?disabled=${this._saving}>
            Cancel
          </button>

          <button type=submit ?disabled=${this._saving}>
            ${this._saving ? 'Creating…' : 'Create & Open'}
          </button>
        </footer>
      </form>
    `;
  }

  firstUpdated() {
    this.renderRoot.querySelector('input[name="title"]')?.focus();
  }

  async #submit(e) {
    e.preventDefault();
    const form   = e.target;
    const title  = form.title.value.trim();
    const byline = form.byline.value.trim();
    const date   = form.date.value;

    if (!title || !byline) return;

    this._saving = true; this._err = '';
    try {
      const id = await saveScrypt(blankScrypt({ title, byline, date }));
      // Trigger navigation to editor
      this.dispatchEvent(new CustomEvent('open-scrypt',{
        detail:{ id, view:'editor' }, bubbles:true, composed:true
      }));
    } catch (err) {
      this._err = err.message;
    } finally {
      this._saving = false;
    }
  }
}
customElements.define('new-scrypt-page', NewScryptPage);

// factory for router
export default () => document.createElement('new-scrypt-page');
