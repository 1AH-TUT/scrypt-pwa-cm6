import { LitElement, css } from 'lit';

/** Host takes full height and owns its own scrollbars. */
export class PageBase extends LitElement {
  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      height: 100%;          /* fill #view-slot row */
      overflow: auto;        /* regain scrollbars */
      padding: 1rem 1.2rem;  /* all regular pages get default padding */
    }
  `;
}
customElements.define('app-page', PageBase);
export default PageBase;
