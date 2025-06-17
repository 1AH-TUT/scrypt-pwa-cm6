// src/components/edit-scene-heading.js
import { html, css }  from 'lit';
import { EditBase }   from './edit-base.js';

/**
 * @component
 * EditSceneHeading — widget for scene headings (horizontal stacked).
 *
 * @extends EditBase
 * @property {object} value - Current scene heading, shape: { indicator, location, time }
 * @property {string[]} indicatorOptions - INT./EXT. options.
 * @property {string[]} locationOptions  - List of known locations.
 * @property {string[]} timeOptions      - List of possible times.
 * @fires save   - CustomEvent<{ indicator, location, time, text: string }>, on save (all UPPERCASE).
 * @fires cancel - Event, on cancel.
 */
export class EditSceneHeading extends EditBase {
  static styles = [
    EditBase.styles,
    css`
      .inputlike { font-size: smaller}
      .row {
        display: flex;
        gap: 1em;
        align-items: center;
      }
      /* All fields uppercase and inherit font */
      input, select {
        font-size: inherit;
        text-transform: uppercase;
      }
      .indicator {
        flex: 0 0 auto;
        min-width: 9ch;
        max-width: 12ch;
      }
      .location {
        flex: 1 1 auto;
        min-width: 8ch;
      }
      .time {
        flex: 0 0 auto;
        min-width: 12ch;
        max-width: 16ch
      }`
  ];

  static properties = {
    indicatorOptions: { type:Array },
    locationOptions:  { type:Array },
    timeOptions:      { type:Array },
    indicator:        { type:String },
    location:         { type:String },
    time:             { type:String }
  };

  constructor() {
    super();
    this.indicatorOptions = [];
    this.locationOptions  = [];
    this.timeOptions      = [];
    this.indicator = '';
    this.location  = '';
    this.time      = '';
  }

  /* Optional bulk setter (handy for tests) */
  set value(v) {
    if (v && typeof v === 'object') {
      this.indicator = v.indicator ?? '';
      this.location  = v.location  ?? '';
      this.time      = v.time      ?? '';
      this.requestUpdate();   // ensure re-render if already connected
    }
  }

  /* ------------ DOM ------------ */
  _renderControl() {
    const opt = (v, sel) => html`<option value=${v} ?selected=${sel}>${v}</option>`;

    return html`<div class="row" role="group" aria-label="Scene heading">
        <!-- Indicator -->
        <select
          class="inputlike indicator"
          @input=${e => (this.indicator = e.target.value)}
          @keydown=${this._onKeydown}
          aria-label="Indicator (INT./EXT.)"
        >
          ${this.indicatorOptions.map(o => opt(o, o === this.indicator))}
        </select>

        <!-- Location -->
        <input
          class="inputlike location"
          .value=${this.location}
          list="scene-locs"
          placeholder="Location"
          aria-label="Location"
          @input=${e => (this.location = e.target.value)}
          @keydown=${this._onKeydown}
        />
        <datalist id="scene-locs">
          ${this.locationOptions.map(o => html`<option value=${o}>`)}
        </datalist>

        <!-- Time (optional) -->
        <select
          class="inputlike time"
          @input=${e => (this.time = e.target.value)}
          @keydown=${this._onKeydown}
          aria-label="Time of day (optional)"
        >
          <option value="" ?selected=${this.time === ''}></option>
          ${this.timeOptions.map(o => opt(o, o === this.time))}
        </select>
      </div>`;
  }

  /* ------------ patch object ------------ */
  _getPatch() {
    if (!this.indicator.trim() || !this.location.trim()) {
      /* inline invalid feedback */
      this.shadowRoot.querySelectorAll('select,input').forEach(el => {
        if (!el.value.trim()) el.classList.add('invalid');
      });
      setTimeout(() =>
        this.shadowRoot.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid')),
        1200
      );
      return null;
    }

    const i = this.indicator.trim().toUpperCase();
    const l = this.location.trim().toUpperCase();
    const t = this.time.trim().toUpperCase();
    const text = t ? `${i} ${l} - ${t}` : `${i} ${l}`;
    return { indicator: i, location: l, time: t, text };
  }
}

customElements.define('edit-scene-heading', EditSceneHeading);
