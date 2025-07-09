import { LitElement, html, css } from 'lit';
import { saveScrypt }            from '../data-layer/db.js';

function blankScrypt({ title, byline }) {
  return {
    /* ﹥ Title page – only the required fields for now */
    titlePage: { title, byline, date:'', source:'', copyright:'', contact:'' },

    /* ﹥ Data – bootstrap with an empty “lead-in” scene (index 0)  */
    data: { scenes: [
        { id:'s0', elements:[{"type": "transition", "text": "FADE IN:", "id": "se1" },] },
        { id:'s1', elements:[{"type": "scene_heading", "indicator": "INT.","location": "","time": "", "text": "INT.", "id": "se2" },] },
      ] },

    /* ﹥ Meta – fresh counter & schema version */
    metaData: { schemaVer:'0.1', nextId:2 }
  };
}

export class NewScryptDrawer extends LitElement {
  static properties = { open:{ type:Boolean, reflect:true } };

  static styles = css`
    :host            { display:block; }
    dialog           { border:3px solid var(--fg-page); width:22rem; max-width:90vw; }
    form             { display:flex; flex-direction:column; gap:.8rem; }
    input            { font:inherit; padding:.4rem; }
    footer           { display:flex; gap:.6rem; justify-content:flex-end; }
    [hidden]         { display:none!important; }
  `;

  #handleClose()        { this.open = false; this.shadowRoot.querySelector('dialog')?.close(); }
  #handleCancel = ()    => this.#handleClose();

  async #handleSubmit(e){
    e.preventDefault();
    const form   = e.target;
    const title  = form.title.value.trim();
    const byline = form.byline.value.trim();

    if (!title || !byline) return;

    const json= blankScrypt({ title, byline });
    const id = await saveScrypt(json);

    this.dispatchEvent(new CustomEvent('open-scrypt', {
      detail:{ id, view:'editor' }, bubbles:true, composed:true
    }));

    form.reset();
    this.#handleClose();
  }

  render(){
    return html`
        <dialog @close=${this.#handleCancel} @focusout=${this.#onFocusOut}>
            <form @submit=${this.#handleSubmit}>
                <h3>New Scrypt</h3>

                <label>
                    Title (required)
                    <input name=title required ${ref => (this.titleFld = ref)}/>
                </label>

                <label>
                    Byline (required)
                    <input name=byline required ${ref => (this.bylineFld = ref)}/>
                </label>

                <footer>
                    <button type=button @click=${this.#handleCancel}>Cancel</button>
                    <button type=submit>Create</button>
                </footer>
            </form>
        </dialog>`;
  }

  updated(chg) {
    if (chg.has('open')) {
      const dlg = this.shadowRoot.querySelector('dialog');
      if (this.open) {
        if (!dlg.open) dlg.showModal();
        this.shadowRoot.querySelector('input[name="title"]')?.focus();
      }
      else dlg.close();
    }

    this.dispatchEvent(new CustomEvent('drawer-toggle', { detail:{ open:this.open }, bubbles:true, composed:true }));
  }

  #onFocusOut = e => {
    requestAnimationFrame(() => {
      const dlg = this.shadowRoot.querySelector('dialog');
      const focused = this.shadowRoot.activeElement || document.activeElement;
      if (dlg.open && !dlg.contains(focused)) this.#handleClose();
    });
  };
}
customElements.define('new-scrypt-drawer', NewScryptDrawer);
