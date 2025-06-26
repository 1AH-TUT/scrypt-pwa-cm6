import { LitElement, html, css } from "lit";
import { hasCurrentScrypt } from "../state/current-scrypt.js";
import { exportScript, hasNativeSaveDialog } from "../services/export-service.js";
import {getCurrentScriptId} from "../state/state.js";

export class AppSidebar extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    page:   { type: String   },
    loaded: { type: Boolean  }
  };

  static styles = css`
    :host { 
      display:flex;
      flex-direction:column; 
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      background: var(--app-sidebar-bg, #1e1e1e); 
      color: var(--app-sidebar-fg, #ccc);
      width: var(--app-sidebar-width, 220px);
      transition: width var(--app-sidebar-transition-ease, 0.2s ease);
      box-sizing: border-box;
    }
    header {
      height: 3rem;
      display: flex;
      align-items: center;
      padding: 0 0.5rem;
    }
    nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
    /* make each link a block so icons+labels stack vertically */
    nav a {
      display: flex;
      align-items: center;
      padding: 1rem;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }
    button.hamburger {
      all: unset;
      cursor: pointer;
    }
    :host(:not([open])) {
      width: var(--app-sidebar-width-closed);
    }
    :host(:not([open])) nav {
      padding: 0;
    }
    :host(:not([open])) nav span {
      display: none;
    }
  `;

  constructor() {
    super();
    this.open = true;
    this.loaded = hasCurrentScrypt();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("scrypt-changed",  this.#syncState);
    window.addEventListener("page-changed",    this.#onPage);
  }
  disconnectedCallback() {
    window.removeEventListener("scrypt-changed", this.#syncState);
    window.removeEventListener("page-changed",   this.#onPage);
    super.disconnectedCallback();
  }

  #syncState = () => {           // called when Scrypt loads/unloads
    this.loaded = hasCurrentScrypt();
  };
  #onPage = (e) => {             // called when router mounts a page
    this.page = e.detail;
  };


  #toggle() {
    const hostAside = this.closest('aside');
    hostAside.toggleAttribute('collapsed');
    this.open = !this.open;
  }

  #go(page) { this.dispatchEvent(new CustomEvent("nav", { detail: page, bubbles: true, composed: true })) }

  render() {
    const { loaded, page } = this;

    // Conditional links
    const editorLink   = (loaded && page !== "editor") ? html`<a @click=${() => this.#go("editor")}>📄 <span>Editor</span></a>` : null;

    const exportLink   = (loaded && page === "editor") ? html`
      <a
        @click=${() => exportScript({ id: getCurrentScriptId(), format: "scrypt" })}
        aria-label="Export current script">
        ⬇️ <span>${hasNativeSaveDialog ? "Export" : "Download"}</span>
      </a>` : null;

    return html`
      <header>
        <button class="hamburger" @click=${this.#toggle} aria-expanded=${this.open}>☰</button>
      </header>

      <nav>
        <a @click=${() => this.#go("workspace")}>🗂 <span>Workspace</span></a>
        ${editorLink} ${exportLink}
      </nav>
    `;
  }
}


customElements.define("app-sidebar", AppSidebar);
