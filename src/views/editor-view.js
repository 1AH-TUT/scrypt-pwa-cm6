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

/* Debug only stuff */
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

/* Editing Widget stuff */

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
        // close the widget
        view.dispatch({effects: endEdit.of(null)});

        // Queue undo insert
        queueMicrotask(() => {
          // Yank if freshly added and user backed out
          if (this.controller._pendingInserts.has(this.id)) {
            this.controller._pendingInserts.delete(this.id);
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
        // Housekeeping
        this.controller._pendingInserts.delete(this.id);

        // Update data model
        this.controller.scrypt.updateElement(this.id, e.detail);

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

/*  Placeholder/Insert Bar */

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

        // If beginInsert, insert placeholde with the element id
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
      { label: 'Action',     type: 'action' },
      { label: 'Dialogue',   type: 'dialogue' },
      { label: 'Scene',      type: 'scene_heading' },
      { label: 'Transition', type: 'transition' }
    ].filter(info => {
      // Only offer Action/Transition in scene 0
      if (isInSceneZero) return info.type === 'action' || info.type === 'transition';
      if (isFirstRealSceneHeading) return info.type !== 'dialogue';
      return true;
    });

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { wrap.querySelector('button')?.focus(); });
      });
    }

    return wrap;
  }
  insertElement(type, wrap) {
    wrap.dispatchEvent(new CustomEvent("cm-request-insert", {
      bubbles: true,
      detail: { type, id: this.id, beforeAfter: this.beforeAfter }
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


/* Other CM6 Extensions */

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
      if (lineDiv) lineDiv.scrollIntoView({ block });
    };

    // Scroll the first line (nearest)
    scrollLineAt(startPos);

    // Scroll the blank line after the element,
    if (scrollToBlank) {
      const blankPos = doc.line(end + 2).from;
      scrollLineAt(blankPos);
    }
    view.focus();
  };

  const move = dir => view => {
    const ids = getElementOrder(controller);

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

    const ids = getElementOrder(controller);
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

    // Dispatch the effect to trigger insertPlaceholderField
    view.dispatch({ effects: beginInsert.of({ pos, id: curId, beforeAfter: loc === "below" ? "after" : "before" }) });

    // focus the editor
    requestAnimationFrame(() => view.focus());

    return true;
  }

  const inInsertBar = () => !!document.activeElement?.closest(".cm-insert-bar");

  const gotoFirst = view => {
    const first = getElementOrder(controller)[0];
    gotoElement(view, first);           // scene-0 or first real element
    return true;
  };

  const gotoLast = view => {
    const last = getElementOrder(controller).slice(-2)[0]; // before _insert_bar_
    gotoElement(view, last);
    return true;
  };

  function gotoNextScene(view, controller) {
    const nextId = controller.getNextSceneHeadingId(controller.selectedId);
    if (nextId) {
      gotoElement(view, nextId, false, "center");
      return true;
    }
    return false;
  }

  function gotoPrevScene(view, controller) {
    const prevId = controller.getPreviousSceneHeadingId(controller.selectedId);
    if (prevId) {
      gotoElement(view, prevId, false, "center");
      return true;
    }
    return false;
  }

  function makeElementDelete(controller) {
    return function (view) {
      // Ignore if focus is in an insert bar - might not be needed...
      if (document.activeElement?.closest(".cm-insert-bar")) {
        return false;
      }

      const id = controller.selectedId;
      if (!id) return false;

      controller.deleteElement(id, { deleteFullScene: false });
      return true;
    };
  }
  const deleteCmd = makeElementDelete(controller);

  return keymap.of([
    {
      key: "Tab", run: view => {
        if (inInsertBar()) return false;
        return move("next")(view);
      }
    },
    {
      key: "Shift-Tab", run: view => {
        if (inInsertBar()) return false;
        return move("prev")(view);
      }
    },
    { key: "Home",      run: gotoFirst, preventDefault: true },
    { key: "End",       run: gotoLast , preventDefault: true },
    { key: "PageUp",    run: view => gotoPrevScene(view, controller), preventDefault: true },
    { key: "PageDown",  run: view => gotoNextScene(view, controller), preventDefault: true },
    { key: "Delete",    run: deleteCmd, preventDefault: true },
    { key: "Backspace", run: deleteCmd, preventDefault: true },
    { key: "Alt-n",     run: insertPlaceholder("below")  },
    { key: "Alt-Shift-n", run: insertPlaceholder("above")  },
  ]);
}

function elementSelector(controller) {
  return ViewPlugin.fromClass(
    class {
      update(update) {
        // Whenever the main selection moves…
        if (update.selectionSet) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head).number - 1;
          const meta = controller.lineMeta[line];
          // controller.setSelected(meta?.id ?? null);
          if (meta?.id !== controller.selectedId) controller.setSelected(meta?.id ?? null);
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

// Misc
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
  focusable,
  EditorView.lineWrapping,
  oneDark,
  myTheme
];

const getElementOrder = controller => {
  const ids = controller.elementOrder();
  ids.push("_insert_bar_");
  return ids;
}

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
      queueMicrotask(() => view.focus());
  });

  view.dom.addEventListener("cm-request-insert", e => {
    const { type, id: refId, beforeAfter } = e.detail;
    
    // Update Scrypt
    const newId   = controller.createElementRelativeTo(refId, type, beforeAfter);

    // Close the insert bar right away
    view.dispatch({ effects: cancelInsert.of(null) });

    if (newId) {
      // Open the edit widget for the new element only after the controller/model has flushed & view has updated
      const open = () => {
        controller.removeEventListener("change", open);
        view.dispatch({ effects: beginEdit.of({ id: newId }) });
        const { start } = controller.elementPositions[newId];
        view.dispatch({
          selection: { anchor: view.state.doc.line(start + 1).from },
          scrollIntoView: true
        });
      };
      // do this once, after the next change event is handled
      controller.addEventListener("change", open, { once: true });
    }
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
