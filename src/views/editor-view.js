/**
 * editor-view.js
 *
 * - Main CodeMirror 6 editor setup for screenplay PWA.
 * - Integrates editing widgets, plugin glue, and theme.
 * - Exports: editing state/effects, extensions builder, and createEditorView().
 */
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap, WidgetType } from "@codemirror/view";

import '../components/edit-action.js';
import '../components/edit-transition.js';
import '../components/edit-scene-heading.js'
import '../components/edit-dialogue.js';

/*
  CSS lives here
  See also extension `screenplayLayout` (maps element types to decoration classes)
  */
import { myTheme } from './editor-view-themes.js';
import { oneDark } from "@codemirror/theme-one-dark";


/*
  Editing Widget stuff
  */

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
      el.parenthetical = elObj.parenthetical || '';
      el.text          = elObj.text          || '';
    }

    if (el){
      node.appendChild(el);

      el.addEventListener('cancel', () => {
        view.dispatch({effects: endEdit.of(null)});
        const {start} = this.controller.elementPositions[this.id];
        const pos = view.state.doc.line(start + 1).from;
        view.dispatch({selection: {anchor: pos}});
        setTimeout(() => view.focus(), 0);
      });

      el.addEventListener('save', e => {
        this.controller.scrypt.updateElement(this.id, e.detail);
        this.controller.reindex();
        const newDoc = this.controller.text;
        view.dispatch({
          changes: {from: 0, to: view.state.doc.length, insert: newDoc},
          effects: [
            endEdit.of(null),
            StateEffect.reconfigure.of(buildExtensions(this.controller))
          ]
        });

        // Restore selection to the current element's start after save
        this.controller.reindex();
        const {start} = this.controller.elementPositions[this.id];
        const pos = view.state.doc.line(start + 1).from;
        view.dispatch({selection: {anchor: pos}});
        setTimeout(() => view.focus(), 0);
      });
    }

    return node;
  }
}


/*
  CM6 Extensions
  */

// Layout (maps element types to decoration classes)
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
        if (!meta) continue;

        const CLASS_BY_TYPE = {
          transition: "cm-transition",
          scene_heading: "cm-heading",
          title: "cm-fp-title",
          action: "cm-action",
          source: "cm-center",
          byline: "cm-center",
          date: "cm-right",
          contact: "cm-left",
          page_break: "cm-line-break"
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
            })
          );
        } else {
          b.add(from, from, Decoration.line({ class: cls }));
        }
      }
      return b.finish();
    }
  }, { decorations: v => v.decorations });
}

function interceptEnter(controller){
  return keymap.of([{
    key:'Enter',
    run(view){
      const ln   = view.state.doc.lineAt(view.state.selection.main.head).number-1;
      const meta = controller.lineMeta[ln];
      if (!['action', 'transition', 'scene_heading', 'dialogue'].includes(meta?.type)) return false;
      view.dispatch({ effects: beginEdit.of({ id:meta.id }) });
      return true;
    }
  }]);
}

function elementNavigator(controller) {
  // Helper: move selection to the first line of element `targetId`
  const gotoElement = (view, targetId) => {
    if (targetId === "_insert_bar_") {
      // Find the persistent insert bar and focus it
      const bar = view.dom.querySelector('.cm-insert-bar');
      bar?.querySelector("button")?.focus();
      return;
    }

    const { start, end } = controller.elementPositions[targetId];
    const doc = view.state.doc;

    // Move the cursor to the first line
    const startPos = doc.line(start + 1).from;
    view.dispatch({ selection: { anchor: startPos } });

    // Helper: scroll a given doc position into view
    const scrollLineAt = pos => {
      const { node } = view.domAtPos(pos);
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      const lineDiv = el.closest(".cm-line");
      if (lineDiv) lineDiv.scrollIntoView({ block: "nearest" });
    };

    // Scroll the first line (nearest)
    scrollLineAt(startPos);

    // Scroll the *blank* line after the element,
    const blankPos = doc.line(end + 2).from;
    scrollLineAt(blankPos);

    view.focus();
  };

  const move = dir => view => {
    const ids = controller.elementOrder();

    // What’s the element under the current selection head?
    let curId = controller.selectedId;
    if (curId == null) {
      const headLine = view.state.doc.lineAt(view.state.selection.main.head).number - 1;
      curId = controller.lineMeta[headLine]?.id ?? ids[0];
    }

    const idx   = ids.indexOf(curId);
    const next  = ids[(idx + (dir === "next" ? 1 : ids.length - 1)) % ids.length];
    gotoElement(view, next);
    return true;
  };

  const insertPlaceholder = loc => view => {
    console.debug("insertPlaceholder :", loc)

    const ids = controller.elementOrder();
    if (!ids.length) return false;

    let curId = controller.selectedId;
    if (curId == null) {
      console.debug("insertPlaceholder:  no element selected")
      return false
    }
    console.debug("insertPlaceholder curId=", curId)

    const posInfo = controller.elementPositions[curId];
    if (!posInfo) {
      console.debug("insertPlaceholder: no posInfo")
      return false;
    }
    console.debug("insertPlaceholder: posInfo:", posInfo)

    const doc = view.state.doc;
    let pos;
    if (loc === "below") {
      // Insert after this element's last line and trailing blank line
      pos = doc.line(posInfo.end + 2).from;
    } else {
      // Insert before this element's first line
      pos = doc.line(posInfo.start).from;
    }
    console.debug("insertPlaceholder: pos:", pos)

    // Now dispatch the effect to trigger insertPlaceholderField
    view.dispatch({ effects: beginInsert.of({ pos }) });

    // focus the editor
    setTimeout(() => view.focus(), 0);

    return true;
  }

  const inInsertBar = () => !!document.activeElement?.closest(".cm-insert-bar");

  return keymap.of([
    {
      key: "Tab",
      run: view => {
        if (inInsertBar()) return false;          // let browser handle it
        return move("next")(view);                // our own navigation
      }
    },
    {
      key: "Shift-Tab",
      run: view => {
          if (inInsertBar()) return false;          // browser handles reverse-tab
        return move("prev")(view);
      }
    },
    { key: "Alt-n", run: insertPlaceholder("below")  },
    { key: "Alt-Shift-n", run: insertPlaceholder("above")  },
  ]);
}

/* begin insertPlaceholder stuff - to be moved later */

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

        // Add the placeholder if beginInsert effect seen
        if (ef.is(beginInsert)) {
          const pos = ef.value.pos;
          const lineNo = tr.newDoc.lineAt(pos).number - 2;
          const deco = Decoration.widget({
            side: 1, // after the position
            widget: new PlaceholderWidget(controller, lineNo)
          }).range(ef.value.pos);
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
  constructor(controller, lineNo, { persistent = false } = {}) {
    super();
    this.controller = controller;
    this.lineNo = lineNo;
    this.persistent = persistent;
  }
  toDOM() {
    const wrap = document.createElement('div');
    wrap.className = 'cm-insert-bar';
    wrap.setAttribute('role', 'toolbar');
    wrap.setAttribute('aria-label', 'Insert element');
    wrap.setAttribute('aria-keyshortcuts', 'Alt+N, Alt+Shift+N');
    wrap.tabIndex = -1;  // focusable but skipped in Tab order

    if (!this.persistent) {
      // If the bar loses focus, cancel
      wrap.addEventListener('blur', (e) => {
        setTimeout(() => {
          // If no button inside has focus
          if (!wrap.contains(document.activeElement)) {
            wrap.dispatchEvent(new CustomEvent('cm-cancel-insert', { bubbles: true }));
          }
        }, 0);
      }, true); // useCapture: true so it fires as soon as any child blurs
    }

    const types = [
      { label: 'Action',     type: 'action' },
      { label: 'Dialogue',   type: 'dialogue' },
      { label: 'Scene',      type: 'scene_heading' },
      { label: 'Transition', type: 'transition' }
    ];
    // Add the buttons
    types.forEach(info => {
      const btn = document.createElement('button');
      btn.textContent = info.label;
      btn.setAttribute('aria-label', `Insert ${info.label}`);
      btn.classList.add(`cm-insert-btn-${info.type}`);
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
      // first let CodeMirror finish its internal focus dance, then grab focus for the first button.
      setTimeout(() => {
       setTimeout(() => wrap.querySelector('button')?.focus(), 0);
      }, 0);
    }

    return wrap;
  }
  insertElement(type, wrap) {
    wrap.dispatchEvent(new CustomEvent("cm-request-insert", {
      bubbles: true,
      detail: {type, lineNo: this.lineNo, beforeAfter: "after"}
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
        // After the last line
        pos = view.state.doc.length;
      }
      let lineNo = view.state.doc.lineAt(pos).number - 2;
      const deco = Decoration.widget({
        side: 1,
        widget: new PlaceholderWidget(controller, lineNo, { persistent: true }),
      }).range(pos);
      return Decoration.set([deco]);
    }
  }, {
    decorations: v => v.decorations
  });
}
/* end insertPlaceholder stuff - to be moved later */

function elementSelector(controller) {
  return ViewPlugin.fromClass(
    class {
      update(update) {
        // Whenever the main selection moves…
        if (update.selectionSet) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head).number - 1;
          const meta = controller.lineMeta[line];
          controller.setSelected(meta?.id ?? null);
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
      // iterate over the lines in the viewport, but only decorate those in [start,end]
      for (let { from } of view.viewportLineBlocks) {
        const ln = view.state.doc.lineAt(from).number - 1;
        if (ln < start || ln > end) continue;
        // apply element block decoration
        const type = controller.lineMeta[ln].type;
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

const focusable = EditorView.contentAttributes.of({ tabindex: "0" });

/* DRY extension builder */
export const buildExtensions = controller => [
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
  focusable,
  EditorView.lineWrapping,
  oneDark,
  myTheme
];


/*
  Create the View
  */

export function createEditorView({ parent, controller }) {
  if (!controller) throw new Error("createEditorView: controller missing");

  const state = EditorState.create({
    doc: controller.text,
    extensions: buildExtensions(controller)
  });

  const view = new EditorView({ parent, state });
  // Make the outer editor node focusable & grab focus
  view.dom.tabIndex = 0;
  view.focus();

  view.dom.addEventListener('cm-cancel-insert', () => {
    view.dispatch({ effects: cancelInsert.of(null) });
    setTimeout(() => view.focus(), 0);
  });

  view.dom.addEventListener("cm-request-insert", e => {
    const { type, lineNo, beforeAfter } = e.detail;

    // 1. mutate screenplay
    const newId = controller.createElementAtLine(lineNo, type, beforeAfter);

    // 2 · rebuild document + drop placeholder
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: controller.text },
      effects: [
        StateEffect.reconfigure.of(buildExtensions(controller)),
        cancelInsert.of(null)          // same txn – no flicker
      ]
    });

    // 3 · place caret at first line of the fresh element
    if (newId) {
      const { start } = controller.elementPositions[newId];
      view.dispatch({ selection: { anchor: view.state.doc.line(start + 1).from } });
    }

    view.focus();
  });

  return view
}
