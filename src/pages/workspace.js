import { LitElement, html, css } from 'lit';
import { validateScrypt } from '../data-layer/validator.js';
import { saveScrypt, deleteScrypt, getAllScryptMetas } from "../data-layer/db.js";
import { exportScript, hasNativeSaveDialog } from "../services/export-service.js";

import { PageBase } from '../components/page-base.js';
import { sanitizeScryptJSON } from "../misc/text-sanitiser.js";

export class WorkspacePage extends PageBase {
  static styles = [
    PageBase.styles,
    css`
      .workspace-page h3 { margin-top: 2em; }
      
      .workspace-message { margin: 0.5em 0; }
      
      .workspace-grid {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        width: max-content;
        min-width: 500px;
      }
      
      .workspace-row {
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        align-items: center;
        column-gap: 0.4em;
        padding: 0.2em 0;
        width: 100%;
      }
      
      .workspace-row button { padding: 0.2em 0.6em; }
      
      .workspace-row:hover { background: color-mix(in srgb, currentColor 10%, transparent);}
    `
  ];

  static properties = { };

  constructor() {
    super();
    this._scripts = [];
    this._msg = '';
    this._msgColor = 'inherit';
  }

  render() {
    return html`<h2>🗂 Workspace</h2>
      <p class="workspace-notice">
        <strong>Note:</strong> Everything in this workspace is saved locally in your browser and will remain available even after closing the app or restarting your device.<br/>
        Scrypts stored here won’t be available on other devices or browsers, and clearing site data will remove them.<br/>
        Use <b>Export / Download</b> to create backup or portable copies.<br/>
      </p>

      <h3>Import Scrypt file</h3>
      <input id="fileInput" type="file" accept=".scrypt" @change=${this._importFile} />
      <div class="workspace-message" style="color: ${this._msgColor}">${this._msg}</div>

      <h3>Start new Scrypt</h3>
      <button @click=${() => this.dispatchEvent(new CustomEvent('nav', { detail:'new', bubbles:true, composed:true }))}>New Script</button>

      <h3>Scrypts in Local Storage</h3>
      <div class="workspace-grid">
        ${this._scripts.map(s => html`
          <div class="workspace-row">
            <span>${s.titlePage?.title ?? `Script #${s.id}`}</span>
            <button @click=${() => this._openScrypt(s.id)}>Open</button>
            <button @click=${() => exportScript({ id: s.id, format: "scrypt" })}>
              ${hasNativeSaveDialog ? "Export" : "Download"}
            </button>
            <button @click=${() => this._deleteScrypt(s.id)}>Remove</button>
          </div>
        `)}
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this._refreshList();
  }

  async _refreshList() {
    this._scripts = await getAllScryptMetas();
    this.requestUpdate();
  }

  async _deleteScrypt(id) {
    await deleteScrypt(id);
    await this._refreshList();
  }

  _openScrypt(id) {
    this.dispatchEvent(new CustomEvent('open-scrypt', {
      detail: { id, view: 'editor' },
      bubbles: true, composed: true
    }));
  }


  async _importFile(e) {
    const fileInput = e.target;
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const { ok, errors } = await validateScrypt(obj);
      if (!ok) throw new Error(errors.map(e => `${e.instancePath} ${e.message}`).join('; '));
      const sanitized = sanitizeScryptJSON(obj, true);
      delete sanitized.id;
      const id = await saveScrypt(sanitized);
      this._msg = `Imported script with ID ${id}.`;
      this._msgColor = "green";
      fileInput.value = "";
    } catch (err) {
      this._msg = `Error importing file: ${err.message}`;
      this._msgColor = "red";
    } finally {
      await this._refreshList();
    }
  }
}

customElements.define('workspace-page', WorkspacePage);

// Export a factory for router
export default () => document.createElement('workspace-page');
