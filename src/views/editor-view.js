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

        // Move to next element and refocus
        // const ids = this.controller.elementOrder();
        // const idx = ids.indexOf(this.id);
        // const nextId = ids[(idx + 1) % ids.length];
        // const {start} = this.controller.elementPositions[nextId];
        // const pos = view.state.doc.line(start + 1).from;
        // view.dispatch({selection: {anchor: pos}});
        // setTimeout(() => view.focus(), 0);

        // Restore selection to the current element's start after save
        this.controller.reindex();
        const {start} = this.controller.elementPositions[this.id];
        const pos = view.state.doc.line(start + 1).from;
        view.dispatch({selection: {anchor: pos}});
        setTimeout(() => view.focus(), 0);
      });

      el.stopEvent = e => (e.key === 'Escape' || e.key === 'Tab');
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
              attributes: { "data-scene": String(meta.SceneNo ?? "") }
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
    if (!ids.length) return false;

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

  return keymap.of([
    { key: "Tab",       run: move("next")  },
    { key: "Shift-Tab", run: move("prev")  },
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

/* Reusable extension builder */
export const buildExtensions = controller => [
  editingField,
  makeEditDecorationField(controller),
  interceptEnter(controller),
  screenplayLayout(controller),
  elementSelector(controller),
  elementHighlighter(controller),
  elementNavigator(controller),
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
  return view
}
