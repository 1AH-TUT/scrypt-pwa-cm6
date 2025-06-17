// src/components/edit-dialogue.js
import { html, css } from 'lit';
import { EditBase }   from './edit-base.js';

/**
 * @component
 * EditDialogue — widget for editing dialogue blocks (vertical stacked).
 *
 * @extends EditBase
 * @property {object} value - Current dialogue, shape: { character, parenthetical, text }
 * @property {string[]} characterOptions - Existing character names for suggestions.
 * @fires save   - CustomEvent<{ character, parenthetical, text }>, on save (character always UPPERCASE).
 * @fires cancel - Event, on cancel.
 */
export class EditDialogue extends EditBase {
  static styles = [
    EditBase.styles,
    css`
      .vstack   { display: flex; flex-direction: column; align-items: center; }
      .char     { max-width: 3.6in; width: 50%; font-weight: bold; text-transform: uppercase; }
      .paren    { max-width: 3.6in; width: 50%; font-style: italic; }
      .text     { text-align: center; }
      textarea.text {
        height: 10rem;
        resize: vertical;
        text-align: left;
      }
      .inputlike { font-size: smaller; }
    `
  ];

  static properties = {
    characterOptions: { type: Array },
    character:        { type: String },
    parenthetical:    { type: String },
    text:             { type: String }
  };

  constructor() {
    super();
    this.characterOptions = [];
    this.character   = '';
    this.parenthetical = '';
    this.text        = '';
  }

  /* optional bulk setter */
  set value(v) {
    if (v && typeof v === 'object') {
      this.character     = v.character     ?? '';
      this.parenthetical = v.parenthetical ?? '';
      this.text          = v.text          ?? '';
      this.requestUpdate();
    }
  }

  /* ------------ DOM ------------ */
  _renderControl() {
    const opt = (v, sel) => html`<option value=${v} ?selected=${sel}>${v}</option>`;

    return html`
      <div class="vstack" role="group" aria-label="Dialogue block">
        <!-- CHARACTER -->
        <input
          class="inputlike char"
          list="char-names"
          aria-label="Character name"
          .value=${this.character}
          @input=${e => (this.character = e.target.value.toUpperCase())}
          @keydown=${this._onKeydown}
        />
        <datalist id="char-names">
          ${this.characterOptions.map(o => html`<option value=${o}>`)}
        </datalist>

        <!-- PARENTHETICAL (optional) -->
        <input
          class="inputlike paren"
          aria-label="Parenthetical (optional)"
          placeholder="(parenthetical)"
          .value=${this.parenthetical}
          @input=${e => (this.parenthetical = e.target.value)}
          @keydown=${this._onKeydown}
        />

        <!-- TEXT -->
        <textarea
          class="inputlike text"
          aria-label="Dialogue text"
          .value=${this.text}
          @input=${e => (this.text = e.target.value)}
          @keydown=${this._onKeydown}
        ></textarea>
      </div>
    `;
  }

  /* ------------ patch object ------------ */
  _getPatch() {
    if (!this.character.trim() || !this.text.trim()) {
      this.shadowRoot.querySelectorAll('.char, .text').forEach(el => el.classList.add('invalid'));
      setTimeout(() =>
        this.shadowRoot.querySelectorAll('.invalid')
          .forEach(el => el.classList.remove('invalid')),
        1200
      );
      return null;
    }

    /* always store character in uppercase, parenthetical trimmed */
    return {
      character:     this.character.trim().toUpperCase(),
      parenthetical: this.parenthetical.trim(),
      text:          this.text.trim()
    };
  }
}

customElements.define('edit-dialogue', EditDialogue);
