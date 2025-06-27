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
import '../components/edit-title-input.js';
import '../components/edit-title-contact.js';

/*
  CSS lives here
  See also extension `screenplayLayout` (maps element types to decoration classes)
  */
import { mainTheme } from './editor-view-themes.js';
import { oneDark } from "@codemirror/theme-one-dark";

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
    } else if (elObj.type === 'titlePage') {
      const field = this.id.slice(3);
      const value = elObj.text;
      if (field === 'contact') {
        el = document.createElement('edit-title-contact');
        el.field = 'contact';
        el.value = value;
        el.required = false;
        el.placeholder = "Contact details";
      } else {
        el = document.createElement('edit-title-input');
        el.field = field;
        el.value = value;
        el.align = (field === 'date' || field === 'contact') ? 'right' : (field === 'copyright') ? 'left' : 'center';
        el.required = (field === 'title' || field === 'byline');
        if (field === 'title')       el.placeholder = "Screenplay Title (required)";
        else if (field === 'byline')  el.placeholder = "Byline — e.g. Written by [Name], Draft Note, or Director Credit (required)";
        else if (field === 'source')  el.placeholder = "Adapted from (novel, play, true events), Original Story, or Additional Note";
        else if (field === 'copyright') el.placeholder = "Copyright notice — e.g. © Year Name or Production Company";
        else if (field === 'date') el.placeholder = "Date — e.g., 1 Jan 2024";
      }
    }

    if (el){
      node.appendChild(el);

      el.addEventListener('cancel', () => {
        // close the widget
        view.dispatch({effects: endEdit.of(null)});

        // Queue undo insert
        queueMicrotask(() => {
          // Yank if freshly added and user backed out
          if (this.controller.consumePendingInsert(this.id)) {
            this.controller.deleteElement(this.id, {deleteFullScene: false});
            return;
          }
        });

        // Restore selection/focus
        const {start} = this.controller.elementPositions[this.id];
        const pos = view.state.doc.line(start + 1).from;
        view.dispatch({selection: {anchor: pos}});
        requestAnimationFrame(() => view.focus());
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
        if (!meta) continue;

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

// Navigation
function elementNavigator(controller) {
  // Helper: move selection to the first line of element `targetId`
  const gotoElement = (view, targetId, scrollToBlank=true, block="nearest") => {
    if (targetId === "_insert_bar_") {
      // Find the persistent insert bar and focus it
      const bar = view.dom.querySelector('.cm-insert-bar');
      bar?.querySelector("button")?.focus();
      return;
    }

    const { start } = controller.elementPositions[targetId];
    scrollSelect(view, start, block === "center");
  };

  const move = dir => view => {
    const ids = getElementOrder(controller);

    // Get the element currently selected
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

  const doInsertPlaceholder = (view, loc, curId, posInfo) => {
    const doc = view.state.doc;
    let pos;
    if (loc === "below") {
      pos = doc.line(posInfo.end + 2).from;
    } else {
      pos = doc.line(posInfo.start).from;
    }
    view.dispatch({ effects: beginInsert.of({ pos, id: curId, beforeAfter: loc === "below" ? "after" : "before" }) });
    requestAnimationFrame(() => view.focus());
  };

  const insertPlaceholder = loc => view => {
    let curId = controller.selectedId ?? controller.lineMeta[view.state.doc.lineAt(view.state.selection.main.head).number - 1]?.id;
    const posInfo = controller.elementPositions[curId];
    if (!curId || !posInfo) return false;

    // If we’re on the last element and asked to insert below, just jump to persistent bar
    const ids = getElementOrder(controller);
    const lastId = ids.at(-2);  // before _insert_bar_
    if (loc === "below" && curId === lastId) {
      gotoElement(view, "_insert_bar_");
      return true;
    }

    doInsertPlaceholder(view, loc, curId, posInfo);
    return true;
  };

  const inInsertBar = () => !!document.activeElement?.closest(".cm-insert-bar");

  const gotoFirst = view => {
    const firstId = getElementOrder(controller)[0];
    const anchor = view.state.doc.line(controller.elementPositions[firstId].start + 1).from;

    view.dispatch({
      selection: { anchor },
      effects: EditorView.scrollIntoView(0, { y: "start" }),
    });

    return true;
  };

  const gotoLast = view => {
    const lastId = getElementOrder(controller).at(-2);  // skip insert_bar
    const anchor = view.state.doc.line(controller.elementPositions[lastId].start + 1).from;

    view.dispatch({
      selection: { anchor },
      effects: EditorView.scrollIntoView(view.state.doc.length, { y: "end", yMargin: 500 })
    });

    return true;
  };

  const gotoNextScene = view => {
    const nextId = controller.getNextSceneHeadingId(controller.selectedId);
    if (nextId) {
      gotoElement(view, nextId, false, "center");
      return true;
    }
    return false;
  }

  const gotoPrevScene = view => {
    const prevId = controller.getPreviousSceneHeadingId(controller.selectedId);
    if (prevId) {
      gotoElement(view, prevId, false, "center");
      return true;
    }
    return false;
  }

  const deleteElement = () => {
    const id = controller.selectedId;
    if (!id) return false;

    controller.deleteElement(id, { deleteFullScene: false });
    return true;
  }

  return keymap.of([
    { key: "Tab",         run: view => { if (inInsertBar()) return false; return move("next")(view); } },
    { key: "Shift-Tab",   run: view => { if (inInsertBar()) return false; return move("prev")(view); } },
    { key: "Home",        run: gotoFirst,     preventDefault: true },
    { key: "End",         run: gotoLast ,     preventDefault: true },
    { key: "PageUp",      run: gotoPrevScene, preventDefault: true },
    { key: "PageDown",    run: gotoNextScene, preventDefault: true },
    { key: "Delete",      run: deleteElement, preventDefault: true },
    { key: "Backspace",   run: deleteElement, preventDefault: true },
    { key: "Alt-n",       run: insertPlaceholder("below"), preventDefault: true },
    { key: "Alt-Shift-n", run: insertPlaceholder("above"), preventDefault: true },
    // extra keys for mac...
    { key: "Mod-Alt-n",  run: insertPlaceholder("below"), preventDefault: true },
    { key: "Mod-Alt-Shift-n", run: insertPlaceholder("above"), preventDefault: true },

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
          // meta may be null if we were passed a blank line... safe to not set
          if (meta?.id != null && meta?.id !== controller.selectedId) {
            controller.setSelected(meta.id);
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
        // Apply element block decoration
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

function interceptEnter(controller){
  return keymap.of([{
    key:'Enter',
    run(view){
      const ln= view.state.doc.lineAt(view.state.selection.main.head).number-1;
      const meta = controller.lineMeta[ln];
      const toIntercept = ['action', 'transition', 'scene_heading', 'dialogue', 'title','byline','date','source','copyright','contact'];
      if (!toIntercept.includes(meta?.type)) {
        return false;
      }
      view.dispatch({ effects: beginEdit.of({ id:meta.id }) });
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

function scrollSelect(view, lineNo0, center = false) {
  const pos = view.state.doc.line(lineNo0 + 1).from;

  requestAnimationFrame(() => {
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: center ? "center" : "nearest" })
    });
  });
}

const getElementOrder = controller => { return [...controller.elementOrder, "_insert_bar_"]; }

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

    // Update Scrypt
    const newId   = controller.createElementRelativeTo(refId, type, beforeAfter);

    // Close the insert bar
    view.dispatch({ effects: cancelInsert.of(null) });

    if (newId) {
      // Open the edit widget for the new element only after the controller/model has flushed & view has updated
      const open = () => {
        controller.removeEventListener("change", open);

        view.dispatch({ effects: beginEdit.of({ id: newId }) });

        const { start } = controller.elementPositions[newId];
        view.dispatch({
          selection: { anchor: view.state.doc.line(start + 1).from },
          ...(persistent  // If we came from the permanent insert bar, always scroll to doc end and some for good measure
            ? { effects: EditorView.scrollIntoView(view.state.doc.length, { y: "end", yMargin: 500 }) }
            : { scrollIntoView: true }
          )
        });
      };
      // do this once, after the next change event is handled
      controller.addEventListener("change", open, { once: true });
    }
  });

  view.dom.addEventListener('dblclick', e => {
    const cmPos = view.posAtDOM(e.target, 0);
    if (cmPos == null) return;

    // Find the line that was double-clicked
    const line = view.state.doc.lineAt(cmPos).number - 1;
    const meta = controller.lineMeta[line];
    if (!meta?.id) return;

    const editableTypes = [
      'action', 'transition', 'scene_heading', 'dialogue',
      'title', 'byline', 'date', 'source', 'copyright', 'contact'
    ];
    if (!editableTypes.includes(meta.type)) return;

    view.dispatch({ effects: beginEdit.of({ id: meta.id }) });
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
        view.dispatch({ selection: { anchor }, scrollIntoView: true });
      }
    });
  });

  return view
}
