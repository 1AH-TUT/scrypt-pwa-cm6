import { LitElement, html, css } from "lit";

export class AppSidebar extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true }
  };

  static styles = css`
    :host { display:flex; flex-direction:column; background:#1e1e1e; color:#ccc;
      width: var(--sidebar-width, 220px);
      transition: width 0.2s ease;
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
      display: flex;
      flex-direction: column;
    }
    /* make each link a block so icons+labels stack vertically */
    nav a {
      display: flex;
      align-items: center;
      padding: 0.5rem;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }
    button.hamburger {
      all: unset;
      cursor: pointer;
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
    this.open = !this.open;
    this.style.setProperty(
      "--sidebar-width",
      this.open ? "220px" : "56px"
    );
  }

  #go(page) { this.dispatchEvent(new CustomEvent("nav", { detail: page, bubbles: true, composed: true })) }

  render() {
    return html`
      <header>
        <button class="hamburger" @click=${this.#toggle} aria-expanded=${this.open}>☰</button>
      </header>
      <nav>
        <a @click=${() => this.#go("editor")}>📄 <span>Editor</span></a>
        <a @click=${() => this.#go("library")}>📚 <span>Library</span></a>
      </nav>`;
  }
}


customElements.define("app-sidebar", AppSidebar);
