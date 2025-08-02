/**
 * editor-view.js
 *
 * - Main CodeMirror 6 editor setup for screenplay PWA.
 * - Integrates editing widgets, plugin glue, and theme.
 * - Exports: editing state/effects, extensions builder, and createEditorView().
 */
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap, WidgetType } from "@codemirror/view";

import { TITLE_PAGE_FIELDS } from '../scrypt/fields.js';
import { ensureElementFullyVisible } from './editor-view-scroll-helpers.js'
import '../components/edit-action.js';
import '../components/edit-transition.js';
import '../components/edit-scene-heading.js'
import '../components/edit-dialogue.js';
import '../components/edit-title-input.js';
import '../components/edit-title-contact.js';

/*
  CSS lives here
  See also extension `screenplayLayout` (maps element types to decoration classes)
  */
import { mainTheme } from './editor-view-themes.js';

/* --- Debug only stuff --- */
function logSel(controller){
  return ViewPlugin.fromClass(class{
    update(u){
      if (u.selectionSet){
        const head = u.state.selection.main.head;
        const ln   = u.state.doc.lineAt(head).number-1;
        const m    = controller.lineMeta[ln];
        console.debug('✏️', ln, m?.id, m?.type);
      }
    }
  })
}

function logCaret() {
  return ViewPlugin.fromClass(class {
    update(u){
      if (u.selectionSet){
        const ln = u.state.doc.lineAt(u.state.selection.main.head).number;
        console.debug('🪝 caret now at line', ln);
      }
    }
  });
}


/* --- Editing Widget stuff --- */
const editableTypes = [
      'action', 'transition', 'scene_heading', 'dialogue',
      'title', 'byline', 'date', 'source', 'copyright', 'contact'
    ];

export const beginEdit = StateEffect.define();   // value: { id }
export const endEdit   = StateEffect.define();   // value: null

export const editingField = StateField.define({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(beginEdit)) return e.value;   // {id}
      if (e.is(endEdit))   return null;
    }
    return value;
  }
});

function makeEditDecorationField(controller) {
  return StateField.define({
    create: () => Decoration.none,

    update(decos, tr) {
      // Map existing decorations through document changes
      if (tr.docChanged) decos = decos.map(tr.changes);

      // Look for beginEdit / endEdit effects
      for (const e of tr.effects) {
        if (e.is(endEdit)) return Decoration.none;

        if (e.is(beginEdit)) {
          const { id } = e.value;
          const { start, end } = controller.elementPositions[id];
          const doc  = tr.newDoc;
          const from = doc.line(start + 1).from;
          const to   = end + 1 <= doc.lines
                     ? doc.line(end + 1).to
                     : doc.length;

          return Decoration.set([
            Decoration.replace({
              block: true,
              widget: new LitBlockWidget(controller, id)
            }).range(from, to)
          ]);
        }
      }
      return decos;
    },

    provide: f => EditorView.decorations.from(f)
  });
}

// Host for edit widgets
class LitBlockWidget extends WidgetType {
  constructor(controller, id){ super(); this.controller = controller; this.id = id; }
  eq(other){ return other.id === this.id; }
  toDOM(view){
    const node = document.createElement('div');
    const elObj = this.controller.scrypt._findElementById(this.id);

    let el;
    if (elObj.type === 'transition') {
      el = document.createElement('edit-transition');
      el.value = elObj.text;
      el.transitionOptions = this.controller.scrypt.getOptions('transition');
    } else if (elObj.type === 'action') {
      el = document.createElement('edit-action');
      el.value = elObj.text;
    } else if (elObj.type === 'scene_heading') {
      el = document.createElement('edit-scene-heading');
      el.indicatorOptions = [...this.controller.scrypt.getOptions('indicator')];
      el.locationOptions = [...this.controller.scrypt.getOptions('location')];
      el.timeOptions = [...this.controller.scrypt.getOptions('time')];
      el.indicator = elObj.indicator || '';
      el.location = elObj.location || '';
      el.time = elObj.time || '';
      if (el.indicator && !el.indicatorOptions.includes(el.indicator))
        el.indicatorOptions.unshift(el.indicator);
      if (el.time && !el.timeOptions.includes(el.time))
        el.timeOptions.unshift(el.time);
    } else if (elObj.type === 'dialogue') {
      el = document.createElement('edit-dialogue');
      el.characterOptions = this.controller.scrypt.getOptions('character');
      el.character     = elObj.character     || '';
      el.contd         = elObj.contd         || false;
      el.parenthetical = elObj.parenthetical || '';
      el.text          = elObj.text          || '';
    } else if (elObj.type === 'titlePage') {
      const field = this.id.slice(3);
      const value = elObj.text;
      if (field === 'contact') {
        el = document.createElement('edit-title-contact');
      } else {
        el = document.createElement('edit-title-input');
      }
      el.align = (field === 'date') ? 'right' : (field === 'copyright' || field === 'contact') ? 'left' : 'center';
      el.required = (field === 'title' || field === 'byline');
      el.value = value;
      el.field = field;
      el.placeholder = TITLE_PAGE_FIELDS.find(f => f.key === field)?.placeholder ?? "";
    }

    if (el){
      node.appendChild(el);

      el.addEventListener('cancel', () => {
        // close the widget
        view.dispatch({effects: endEdit.of(null)});

        // Queue undo insert
        queueMicrotask(() => {
          const wasFresh = this.controller.consumePendingInsert(this.id);
          if (wasFresh) {
            // Element never committed – remove it.
            this.controller.deleteElement(this.id, {deleteFullScene: false});

            // After controller flushes the deletion, restore caret/scroll to the newly selectedId (usually the original element) and scroll just-enough
            const restore = () => {
              this.controller.removeEventListener("change", restore);
              const id = this.controller.selectedId;
              const {start} = this.controller.elementPositions[id];
              const anchor = view.state.doc.line(start + 1).from;
              view.dispatch({selection: {anchor}});
              ensureElementFullyVisible(view, this.controller, id, "up");
              view.focus();
            };
            this.controller.addEventListener("change", restore, {once: true});
          } else {
            // The element was an existing one – cancel; caret back to it.
            const {start} = this.controller.elementPositions[this.id];
            const pos = view.state.doc.line(start + 1).from;
            view.dispatch({selection: {anchor: pos}});
            requestAnimationFrame(() => view.focus());
          }
        });
      });

      el.addEventListener('save', e => {
        // Clear Pending status
        this.controller.consumePendingInsert(this.id);

        // Update data model
        // this.controller.scrypt.updateElement(this.id, e.detail);
        if (this.id.startsWith('tp_')) {
          const { field, text } = e.detail;
          this.controller.scrypt.updateTitlePageField(field, text);
        } else {
          this.controller.scrypt.updateElement(this.id, e.detail);
        }

        // Immediately close the widget
        view.dispatch({ effects: endEdit.of(null) });

        // Do the final selection/focus & doc-replace only after the controller/model has _flushed & view has updated
        const open = () => {
          this.controller.removeEventListener('change', open);

          // Build new doc text
          const doc = this.controller.text;

          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: doc },
            effects: [ StateEffect.reconfigure.of(buildExtensions(this.controller)) ],
            selection: { anchor: view.state.doc.line(this.controller.elementPositions[this.id].start + 1).from },
            scrollIntoView: true
          });
          requestAnimationFrame(() => view.focus());
        };
        this.controller.addEventListener('change', open, { once: true });
      });
    }

    return node;
  }
}

/* --- Placeholder/Insert Bar --- */

export const beginInsert = StateEffect.define();

export const cancelInsert = StateEffect.define();

function insertPlaceholderField(controller) {
  return StateField.define({
    create() { return Decoration.none; },

    update(decos, tr) {
      // Keep current decorations in sync with document edits
      if (tr.docChanged) decos = decos.map(tr.changes);

      // Loop over all effects in this transaction
      for (let ef of tr.effects) {
        // Remove the placeholder if cancel effect seen
        if (ef.is(cancelInsert)) return Decoration.none;

        // If beginInsert, insert placeholder with the element id
        if (ef.is(beginInsert)) {
          const { pos, id, beforeAfter } = ef.value;
          const deco = Decoration.widget({
            side: 1,
            widget: new PlaceholderWidget(controller, id, beforeAfter)
          }).range(pos);
          return Decoration.set([deco]);
        }
      }
      // Otherwise, no change
      return decos;
    },

    provide: f => EditorView.decorations.from(f)
  });
}

class PlaceholderWidget extends WidgetType {
  constructor(controller, id, beforeAfter, { persistent = false } = {}) {
    super();
    this.controller = controller;
    this.id = id;
    this.beforeAfter = beforeAfter;
    this.persistent = persistent;
  }
  toDOM() {
    const { controller, id } = this;
    const wrap = document.createElement('div');
    wrap.className = 'cm-insert-bar';
    wrap.setAttribute('role', 'toolbar');
    wrap.setAttribute('aria-label', 'Insert element');
    wrap.setAttribute('aria-keyshortcuts', 'Alt+N, Alt+Shift+N');
    wrap.tabIndex = -1;  // focusable but skipped in Tab order

    if (!this.persistent) {
      // If the bar loses focus, cancel
      wrap.addEventListener('blur', (e) => {
        requestAnimationFrame(() => {
          // Prevent the bar from closing immediately when focus moves between buttons
          if (!wrap.contains(document.activeElement)) {
            wrap.dispatchEvent(new CustomEvent('cm-cancel-insert', { bubbles: true }));
          }
        });
      }, true); // useCapture: true so it fires as soon as any child blurs
    }

    // Look up the meta for the ref element
    const meta = controller.lineMeta.find(m => m && m.id === id);
    const isInSceneZero = meta && meta.sceneNo === 0;
    const isFirstRealSceneHeading = meta && meta.sceneNo === 1 && meta.type === 'scene_heading' && this.beforeAfter === 'before';

    const types = [
      { label: 'Action',     type: 'action',        shortcut: 'A'  },
      { label: 'Dialogue',   type: 'dialogue',      shortcut: 'D'  },
      { label: 'Transition', type: 'transition',    shortcut: 'T'  },
      { label: 'Scene',      type: 'scene_heading', shortcut: 'S' },
    ].filter(info => {
      // Only offer Action/Transition in scene 0
      if (isInSceneZero) return info.type === 'action' || info.type === 'transition';
      if (isFirstRealSceneHeading) return info.type !== 'dialogue';
      return true;
    });
    const keyForType = Object.fromEntries(types.map(({ type, shortcut }) => [type, shortcut]));

    // Add the buttons
    types.forEach(info => {
      const first = info.label[0];
      const rest = info.label.slice(1);
      const btn = document.createElement('button');
      btn.innerHTML = `<span style="text-decoration: underline">${first}</span>${rest}`;
      btn.setAttribute('aria-label', `Insert ${info.label} (${info.shortcut})`);
      btn.classList.add(`cm-insert-btn-${info.type}`);
      btn.dataset.type = info.type;
      btn.onclick = () => this.insertElement(info.type, wrap);
      wrap.appendChild(btn);
    });

    wrap.addEventListener('keydown', e => {
      const btns = Array.from(wrap.querySelectorAll('button'));
      const idx  = btns.indexOf(document.activeElement);

      // Arrow keys cycle buttons
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const next = btns[(idx + step + btns.length) % btns.length];
        next.focus();
        return;
      }

      // If single letter (not combined with ctrl/alt/meta/shift)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.length === 1) {
        const k = e.key.toUpperCase();
        for (const info of types) {
          if (keyForType[info.type] === k) {
            e.preventDefault();
            e.stopPropagation();
            this.insertElement(info.type, wrap);
            return;
          }
        }
      }

      if (this.persistent) return;

      // Tab / Shift+Tab at ends cancels, otherwise moves between buttons
      if (e.key === 'Tab') {
        e.preventDefault();

        if (e.shiftKey) {
          if (idx === 0) {
            wrap.dispatchEvent(new CustomEvent('cm-cancel-insert', { bubbles: true }));
          } else {
            btns[idx - 1].focus();
          }
        } else {
          if (idx === btns.length - 1) {
            wrap.dispatchEvent(new CustomEvent('cm-cancel-insert', { bubbles: true }));
          } else {
            btns[idx + 1].focus();
          }
        }
        return;
      }

      // Escape cancels
      if (e.key === 'Escape') {
        wrap.dispatchEvent(new CustomEvent('cm-cancel-insert', { bubbles: true }));
      }

    });

    if (!this.persistent) {
      // First let CodeMirror finish its internal focus dance, then grab focus for the first button.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { wrap.querySelector('button')?.focus(); });
      });
    }

    return wrap;
  }
  insertElement(type, wrap) {
    wrap.dispatchEvent(new CustomEvent("cm-request-insert", {
      bubbles: true,
      detail: { type, id: this.id, persistent: this.persistent, beforeAfter: this.beforeAfter }
    }));
  }
}

function persistentInsertBar(controller) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.build(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }
    build(view) {
      // Find the position for the persistent placeholder:
      let pos;
      if (view.state.doc.length === 0) {
        pos = 0;
      } else {
        pos = view.state.doc.length;
      }
      const ids = getElementOrder(controller);
      const lastId = ids.length > 1 ? ids[ids.length - 2] : null; // ignore _insert_bar_
      const deco = Decoration.widget({
        side: 1,
        widget: new PlaceholderWidget(controller, lastId, "after", { persistent:true }),
      }).range(pos);
      return Decoration.set([deco]);
    }
  }, {
    decorations: v => v.decorations
  });
}


/* --- Other CM6 Extensions --- */

// Layout
function screenplayLayout(controller) {
  return ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.build(view); }
    update(u) {
      if (u.docChanged || u.viewportChanged)
        this.decorations = this.build(u.view);
    }
    build(view) {
      const b = new RangeSetBuilder();
      for (let { from } of view.viewportLineBlocks) {
        const ln= view.state.doc.lineAt(from).number - 1;
        const meta = controller.lineMeta[ln];
        if (!meta) continue; // ignore blank lines

        // Add class to hide blank lines marked fold_spacer (folded dialogue)
        if (meta.type === "fold_spacer") {
          b.add(from, from, Decoration.line({ class:"cm-fold-spacer" }));
          continue;
        }

        // Add margin label if line has a label
        if (meta.label) {
          b.add(from, from, Decoration.line({
            class: "cm-title-label",
            attributes: { "data-label": meta.label }
          }));
        }

        const CLASS_BY_TYPE = {
          transition: "cm-transition",
          scene_heading: "cm-heading",
          action: "cm-action",
          title: "cm-fp-title",
          byline: "cm-center",
          source: "cm-center",
          copyright: "cm-center",
          contact: "cm-left",
          date: "cm-right",
          page_break: "cm-page-break"
        };

        let cls;
        if (meta.type === "dialogue") {
          cls = meta.field === "character"     ? "cm-char"
              : meta.field === "parenthetical" ? "cm-paren"
              : "cm-dialogue";
        } else { cls = CLASS_BY_TYPE[meta.type] || "cm-body" }

        if (meta.type === "scene_heading") {
          b.add(from, from,
            Decoration.line({
              class: "cm-heading",
              attributes: { "data-scene": String(meta.sceneNo ?? "") }
            }));
        } else if (meta.type === "page_break") {
          b.add(from, from,
            Decoration.line({
              class: "cm-page-break",
              attributes: { "data-pg": String(meta.page ?? "") }
            }));
        } else {
          b.add(from, from, Decoration.line({ class: cls }));
        }
      }
      return b.finish();
    }
  }, { decorations: v => v.decorations });
}

// Navigation
function elementNavigator(controller) {
  /**
  * @function gotoElement
  * Handles controller selection and editor caret placement
  * @param {EditorView} view the active CM view
  * @param {string} id Id of target element
  * @param {"up"|"down"|"none"} dir hint at direction of caret movement
  * @param {object} [opts]
  * @param {boolean} [opts.centre]  – always-centre over-ride for default scrollIntoView behaviour
  */
  const gotoElement = (view, id, dir = "none", { centre = false } = {}) => {
    if (id === "_insert_bar_") {
     view.dom.querySelector(".cm-insert-bar button")?.focus();
     return;
    }

    // Mark selection in controller – triggers the selected-changed handler
    controller.setSelected(id, dir);

    // Calculate the CM caret position
    const { start } = controller.elementPositions[id];
    const anchor = view.state.doc.line(start + 1).from;

    // Build the transaction
    const transaction = { selection: { anchor } };
    // Centre if asked (note: will be layered on top of default scrollIntoView triggered by the selected-changed handler)
    if (centre) transaction["effects"] = [EditorView.scrollIntoView(view.state.doc.line(start + 1).from, { y: "center" })];

    view.dispatch(transaction);
  };

  const move = dir => view => {
    if (inInsertBar()) return false;

    const ids  = getElementOrder(controller);
    const cur  = controller.selectedId
               ?? controller.lineMeta[view.state.doc.lineAt(
                    view.state.selection.main.head).number - 1]?.id
               ?? ids[0];
    const next = ids[(ids.indexOf(cur) + (dir === "down" ? 1 : ids.length - 1)) % ids.length];
    gotoElement(view, next, dir);
    return true;
  };

  const gotoFirst = view => gotoElement(view, getElementOrder(controller)[0],  "up");

  const gotoLast  = view => gotoElement(view, getElementOrder(controller).at(-2), "down");

  const gotoNextScene = view => {
    const id = controller.getNextSceneHeadingId(controller.selectedId);
    if (!id) return false;
    gotoElement(view, id, "down", { centre: true });
    return true;
  };

  const gotoPrevScene = view => {
    const id = controller.getPreviousSceneHeadingId(controller.selectedId);
    if (!id) return false;
    gotoElement(view, id, "up", { centre: true });
    return true;
  }

  const deleteElement = () => {
    const id = controller.selectedId;
    if (!id) return false;
    controller.deleteElement(id, { deleteFullScene: false });
    return true;
  }

  const doInsertPlaceholder = (view, loc, curId, posInfo) => {
    const doc = view.state.doc;
    let pos;
    if (loc === "below") {
      pos = doc.line(posInfo.end + 2).from;
    } else {
      pos = doc.line(posInfo.start).from;
    }

    // Dispatch the placeholder effect first
    view.dispatch({ effects: beginInsert.of({ pos, id: curId, beforeAfter: loc === "below" ? "after" : "before" }) });

    // Ensure the anchor line is visible and focus
    queueMicrotask(() => {
     ensureElementFullyVisible(view, controller, curId);
     view.focus();
   });
  };

  const insertPlaceholder = loc => view => {
    let curId = controller.selectedId ?? controller.lineMeta[view.state.doc.lineAt(view.state.selection.main.head).number - 1]?.id;
    const posInfo = controller.elementPositions[curId];
    if (!curId || !posInfo) return false;

    // If we’re on the last element and asked to insert below, just jump to persistent bar
    const ids = getElementOrder(controller);
    const lastId = ids.at(-2);  // before _insert_bar_
    if (loc === "below" && curId === lastId) {
      gotoElement(view, "_insert_bar_", "down");
      return true;
    }

    doInsertPlaceholder(view, loc, curId, posInfo);
    return true;
  };

  const inInsertBar = () => !!document.activeElement?.closest(".cm-insert-bar");

  return keymap.of([
    { key: "Tab",         run: move("down"),  preventDefault: true },
    { key: "Shift-Tab",   run: move("up"),    preventDefault: true },
    { key: "Home",        run: gotoFirst,         preventDefault: true },
    { key: "End",         run: gotoLast ,         preventDefault: true },
    { key: "PageUp",      run: gotoPrevScene,     preventDefault: true },
    { key: "PageDown",    run: gotoNextScene,     preventDefault: true },
    { key: "Delete",      run: deleteElement,     preventDefault: true },
    { key: "Backspace",   run: deleteElement,     preventDefault: true },
    { key: "Alt-n",       run: insertPlaceholder("below"), preventDefault: true },
    { key: "Alt-Shift-n", run: insertPlaceholder("above"), preventDefault: true },
    // extra keys for mac...
    { key: "Ctrl-Mod-n",       run: insertPlaceholder("below"), preventDefault: true },
    { key: "Ctrl-Mod-Shift-n", run: insertPlaceholder("above"), preventDefault: true },

  ]);
}

function elementSelector(controller) {
  return ViewPlugin.fromClass(
    class {
      update(update) {
        if (update.selectionSet) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head).number - 1;
          const meta = controller.lineMeta[line];
          if (meta?.id && meta?.id !== controller.selectedId) {
            // Defer until CM’s update cycle has finished
            queueMicrotask(() => controller.setSelected(meta.id, "none"));
          }
        }
      }
    }
  );
}

function elementHighlighter(controller) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.build(view);
    }
    update(update) {
      // Rebuild if the selectedId changed, or viewport scrolled, or doc changed
      if (
        update.docChanged ||
        update.viewportChanged ||
        controller.selectedId !== this._last
      ) {
        this.decorations = this.build(update.view);
      }
    }
    build(view) {
      this._last = controller.selectedId;
      if (this._last == null) return Decoration.none;

      const builder = new RangeSetBuilder();
      const lineNoPositions = controller.elementPositions[this._last];
      if (!lineNoPositions) return builder.finish();

      const { start, end } = lineNoPositions;
      // Iterate over the lines in the viewport, decorate those in [start,end]
      for (let { from } of view.viewportLineBlocks) {
        const ln = view.state.doc.lineAt(from).number - 1;
        if (ln < start || ln > end) continue;
        const meta = controller.lineMeta[ln];
        if (isBlank(meta)) continue;

        // Apply element block decoration
        const type = meta.type;
        builder.add(from, from, Decoration.line({
          class: `cm-elt-selected cm-elt-selected-${type}`
        }));
      }
      return builder.finish();
    }
  }, {
    decorations: v => v.decorations
  });
}

function interceptEnter(controller){
  return keymap.of([{
    key:'Enter',
    run(view){
      const ln= view.state.doc.lineAt(view.state.selection.main.head).number-1;
      const meta = controller.lineMeta[ln];
      if (!editableTypes.includes(meta?.type)) return false;

      // Make sure it's selected
      controller.setSelected(meta.id, "none");

      // After scroll triggered by selection, open the edit widget
      queueMicrotask(() => {
        view.dispatch({ effects: beginEdit.of({ id: meta.id }) });

        // Ensure the new widget’s tail isn’t clipped
        queueMicrotask(() =>
          ensureElementFullyVisible(view, controller, meta.id, "down")
        );
      });

      return true;
    }
  }]);
}

export const buildExtensions = controller => [
  // logSel(controller),  // debug only
  // logCaret(),  // debug only
  editingField,
  makeEditDecorationField(controller),
  interceptEnter(controller),
  screenplayLayout(controller),
  elementSelector(controller),
  elementHighlighter(controller),
  elementNavigator(controller),
  insertPlaceholderField(controller),
  persistentInsertBar(controller),
  EditorView.editable.of(false),
  EditorView.contentAttributes.of({ tabindex: "0" }),
  EditorView.lineWrapping,
  mainTheme
];


/* --- Helpers --- */
const getElementOrder = controller => { return [...controller.elementOrder, "_insert_bar_"]; }

const isBlank = m => !m || m.type === "fold_spacer";

/*
  Create the View
  */

export function createEditorView({ parent, controller }) {
  if (!controller) throw new Error("createEditorView: controller missing");

  // Figure out where we want the cursor
  let initialSelection;
  if (controller.selectedId) {
    const { start } = controller.elementPositions[controller.selectedId];
    const pos = controller.text
      .split("\n")
      .slice(0, start + 1)
      .reduce((sum, line) => sum + line.length + 1, 0) - 1;
    initialSelection = { anchor: pos };
  }

  // Build the editor state
  const state = EditorState.create({
    doc: controller.text,
    selection: initialSelection,
    extensions: buildExtensions(controller)
  });

  // Build the Editor View
  const view = new EditorView({ parent, state });
  // Make the outer editor node focusable & grab focus
  view.dom.tabIndex = 0;
  requestAnimationFrame(() => view.focus());

  /* --- Event listeners --- */

  view.dom.addEventListener('cm-cancel-insert', () => {
    view.dispatch({ effects: cancelInsert.of(null) });
      queueMicrotask(() => view.focus());
  });

  view.dom.addEventListener("cm-request-insert", e => {
    const { type, id: refId, persistent, beforeAfter } = e.detail;

    // Update Scrypt & create the element
    const newId = controller.createElementRelativeTo(refId, type, beforeAfter);

    // Close the insert bar
    view.dispatch({ effects: cancelInsert.of(null) });

    if (newId) {
      // After the controller re‑flushes, open the edit widget
      const open = () => {
        controller.removeEventListener("change", open);

        // Open the edit widget
        view.dispatch({ effects: beginEdit.of({ id: newId }) });

        // After CM has rendered the widget, scroll one frame later
        requestAnimationFrame(() => {
          const scrollTarget = beforeAfter === "before" ? newId : refId;
          ensureElementFullyVisible(
           view,
           controller,
           scrollTarget,
           beforeAfter === "before" ? "up" : "down"
          );
        });

        // Move the caret
        const { start } = controller.elementPositions[newId];
        const tx = { selection:{ anchor: view.state.doc.line(start + 1).from } };
        if (persistent) {
          tx.effects = EditorView.scrollIntoView(
            view.state.doc.length,
            { y:"end", yMargin:500 }
          );
        }
        view.dispatch(tx);

      };
      // Do this once, after the next change event is handled
      controller.addEventListener("change", open, { once: true });
    }
  });

  view.dom.addEventListener('dblclick', e => {
    const cmPos = view.posAtDOM(e.target, 0);
    if (cmPos == null) return;

    // Find the line that was double-clicked
    const line = view.state.doc.lineAt(cmPos).number - 1;
    const meta = controller.lineMeta[line];
    if (isBlank(meta)) return;

    if (!editableTypes.includes(meta.type)) return;

    queueMicrotask(() => {
      controller.setSelected(meta.id, "none");   // fires selected-changed

      // After any scroll has happened, open the widget, then re-check visibility.
      queueMicrotask(() => {
        view.dispatch({ effects: beginEdit.of({ id: meta.id }) });

        // Ensure the widget is fully on-screen
        queueMicrotask(() =>
          ensureElementFullyVisible(view, controller, meta.id, "down")
        );
      });
    });
  });

  controller.addEventListener('change', e => {
    const { kind } = e.detail || {};
    const newDoc = controller.text;

    // Replace the document & reconfigure
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newDoc },
      effects: [ StateEffect.reconfigure.of(buildExtensions(controller)) ]
    });

    // Queue positioning the cursor/selection
    queueMicrotask(() => {
      const pos = controller.elementPositions[controller.selectedId]?.start;
      if (typeof pos === 'number') {
        const anchor = view.state.doc.line(pos + 1).from;
        view.dispatch({ selection: { anchor } });
        ensureElementFullyVisible(view, controller, controller.selectedId, "none");
      }
    });
  });

  controller.addEventListener("selected-changed", e => {
    const { newId, dir } = e.detail;
    ensureElementFullyVisible(view, controller, newId, dir);
  });

  return view
}
