import {LitElement, html, css} from "@lit";

export class AppSidebar extends LitElement {
  static properties = {open: {type: Boolean}};
  static styles = css`
    :host { display:flex; flex-direction:column; background:#1e1e1e; color:#ccc;
            width: var(--sidebar-w, 220px); transition: width .2s ease; }
    header {height:3rem; display:flex; align-items:center; padding:0 .5rem;}
    nav {flex:1; overflow-y:auto;}
    button.hamburger {all:unset; cursor:pointer;}
    :host(:not([open])) nav span {display:none;}  /* icon-only mode */
  `;
  constructor(){ super(); this.open = true; }
  #toggle(){ this.open = !this.open; this.style.setProperty('--sidebar-w', this.open ? '220px' : '56px'); }
  render(){
    return html`
      <header>
        <button class="hamburger" @click=${this.#toggle} aria-expanded=${this.open}>☰</button>
      </header>
      <nav>
        <a @click=${()=>this.dispatchEvent(new CustomEvent('nav', {detail:'editor'}))}>
          📄 <span>Editor</span>
        </a>
        <a @click=${()=>this.dispatchEvent(new CustomEvent('nav', {detail:'library'}))}>
          📚 <span>Library</span>
        </a>
      </nav>`;
  }
}
customElements.define('app-sidebar', AppSidebar);
