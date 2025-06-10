import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

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

// Intercept Enter at the DOM level
const interceptEnterPlugin = ViewPlugin.fromClass(
  class { },
  {
    eventHandlers: {
      keydown(event, view) {
        if (event.key === "Enter") {
          event.preventDefault();
          // TODO: fire “open edit widget” logic
          console.log("Enter intercepted!")
          return true; // claim the event
        }
        return false;
      }
    }
  }
);


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

export function createEditorView({ parent, controller }) {
  if (!controller) throw new Error("createEditorView: controller missing");

  const state = EditorState.create({
    doc: controller.text,
    extensions: [
      interceptEnterPlugin,
      screenplayLayout(controller),
      elementSelector(controller),
      elementHighlighter(controller),
      elementNavigator(controller),
      EditorView.editable.of(false),
      focusable,
      EditorView.lineWrapping,
      oneDark,
      myTheme
    ]
  });

  const view = new EditorView({ parent, state });
  // Make the outer editor node focusable & grab focus
  view.dom.tabIndex = 0;
  view.focus();
  return view
}
