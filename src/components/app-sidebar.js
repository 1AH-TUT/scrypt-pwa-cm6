import { LitElement, html, css } from "lit";

export class AppSidebar extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true }
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
  }

  #toggle() {
    const hostAside = this.closest('aside');
    hostAside.toggleAttribute('collapsed');
    this.open = !this.open;
  }

  #go(page) { this.dispatchEvent(new CustomEvent("nav", { detail: page, bubbles: true, composed: true })) }

  render() {
    return html`<header>
        <button class="hamburger" @click=${this.#toggle} aria-expanded=${this.open}>☰</button>
      </header>
      <nav>
        <a @click=${() => this.#go("workspace")}>🗂 <span>Workspace</span></a>
        <br />
        <a @click=${() => this.#go("editor")}>📄 <span>Editor</span></a>
      </nav>`;
  }
}


customElements.define("app-sidebar", AppSidebar);
