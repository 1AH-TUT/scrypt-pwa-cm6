import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap, WidgetType } from "@codemirror/view";

import { oneDark } from "@codemirror/theme-one-dark";
import '../components/edit-action.js';

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



// --- Editing Effects and Field ---
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

class LitBlockWidget extends WidgetType {
  constructor(controller, id){ super(); this.controller = controller; this.id = id; }
  eq(other){ return other.id === this.id; }
  toDOM(view){
    const node = document.createElement('div');
    const el   = document.createElement('edit-action');
    el.text    = this.controller.scrypt._findElementById(this.id).text;
    node.appendChild(el);

    el.addEventListener('cancel', () => {
     // 1) End the edit widget
     view.dispatch({ effects: endEdit.of(null) });

     // 2) Restore the cursor onto the same element
     const { start } = this.controller.elementPositions[this.id];
     const pos = view.state.doc.line(start + 1).from;
     view.dispatch({ selection: { anchor: pos } });

     // 3) Re-focus CM6
     setTimeout(() => view.focus(), 0);
    });

    el.addEventListener('save', e => {
      // 1. Persist JSON
      this.controller.scrypt.updateElement(this.id, { text: e.detail.text });

      // 2. Re-index controller & replace the whole doc
      this.controller.reindex();
      const newDoc = this.controller.text;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newDoc },
        effects: [
          endEdit.of(null),
          StateEffect.reconfigure.of(buildExtensions(this.controller))
        ]
      });

      // 3. Move cursor to the next element
      const ids       = this.controller.elementOrder();
      const idx       = ids.indexOf(this.id);
      const nextId    = ids[(idx + 1) % ids.length];
      const { start } = this.controller.elementPositions[nextId];
      const pos       = view.state.doc.line(start + 1).from;
      view.dispatch({ selection: { anchor: pos } });

      // 4. Refocus CM6
      setTimeout(() => view.focus(), 0);
    });

    // swallow Esc / Tab so CM doesn't treat them as normal keys
    // el.stopEvent = e => (e.key === 'Escape' || e.key === 'Tab');
    return node;
  }
}

/*
  *** Extensions ***
*/

/* CSS is here */
const myTheme = EditorView.baseTheme({
  ".cm-content":    { fontFamily: "var(--font-screenplay, \"Courier Prime, monospace\")", fontSize: "12pt", marginLeft: "1.3in", "marginRight": "1in" },
  ".cm-scroller":   { lineHeight: "1.2" },
  ".cm-line":       { padding: "0 2 0 0", borderLeft: "3px solid transparent" },
  ".cm-fp-title":   { fontWeight: "bold", textTransform: "uppercase", textAlign: "center", marginTop: "1in", fontSize: "16pt" },
  ".cm-right":      { textAlign: "right" },
  ".cm-left":       { textAlign: "left" },
  ".cm-center":     { textAlign: "center" },
  ".cm-char":       { width: "3.6in", margin: "0 auto", textAlign: "center", paddingBottom: ".5em", textTransform: "uppercase", fontWeight: "bold" },
  ".cm-paren":      { width: "3.6in", margin: "0 auto", textAlign: "center", paddingBottom: ".5em"},
  ".cm-dialogue":   { width: "3.6in", margin: "0 auto" },
  ".cm-transition": { textAlign: "right", textTransform: "uppercase" },
  ".cm-heading":    { textAlign: "left", textTransform: "uppercase", fontWeight: "bolder" },

  // ".cm-elt-selected":      { backgroundColor: "rgba(255, 255, 0, 0.1)" },
  ".cm-line-break::after": { content: '""', display: "block", borderBottom: "1px solid #ccc", margin: "1em 0" },
  ".cm-heading::before":   { content: "attr(data-scene)", position: "absolute", left: 0, width: "1in",
                             textAlign: "right", fontWeight: "bold" },
  /* Make each .cm-line fill the editor’s width when decorated */
  ".cm-elt-selected": { backgroundColor: "rgba(255, 200, 0, 0.1)", borderLeft: "3px solid #ffa600" },
  ".cm-elt-selected-dialogue":      { borderLeftColor: "#ffa600" }, /* gold */
  ".cm-elt-selected-action":        { borderLeftColor: "#00bfff" }, /* sky blue */
  ".cm-elt-selected-scene_heading": { borderLeftColor: "#32cd32" }, /* lime green */
  ".cm-elt-selected-transition":    { borderLeftColor: "#ff69b4" }, /* hot pink */
});

const focusable = EditorView.contentAttributes.of({ tabindex: "0" });

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
      if (meta?.type !== 'action') return false;
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


/*
  *** Create the View ***
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
