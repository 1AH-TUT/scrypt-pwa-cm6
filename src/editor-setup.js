/*---------------------------------------------------------------------------
  Editor factory for the Scrypt PWA
  ---------------------------------------------------------------------------
  Usage:
    import { buildEditor } from "./editor-setup.js";
    const view = buildEditor({
      parent: containerElement,     // required
      screenplay: myJson            // optional; default sample script
    });
---------------------------------------------------------------------------*/

import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

import { screenplay as demoScript } from "./sample-script.js";
import { toPlainText } from "./scrypt/element-utils.js"


/*───────────────────────────────────────────────────────────────────────────*/
/* 1. Styles & layout helpers                                               */
/*─────────────────────────────────────────────────────────────────────────*/

const myTheme = EditorView.baseTheme({
  ".cm-content":    { fontFamily: "var(--font-screenplay, \"Courier Prime, monospace\")", fontSize: "12pt", marginLeft: "1.4in", "marginRight": "1in" },
  ".cm-scroller":   { lineHeight: "1.2" },
  ".cm-line":       { padding: "0" },
  ".cm-fp-title":   { fontWeight: "bold", textTransform: "uppercase", textAlign: "center", marginTop: "1in", fontSize: "16pt" },
  ".cm-right":      { textAlign: "right" },
  ".cm-left":       { textAlign: "left" },
  ".cm-center":     { textAlign: "center" },
  ".cm-paren":      { textAlign: "center", marginBottom: "0.75em" },
  ".cm-char":       { display: "inline-block", maxWidth: "100%", left: "50%",
                      transform: "translateX(-50%)", position: "relative",
                      textAlign: "center", marginBottom: ".6em",
                      textTransform: "uppercase", fontWeight: "bolder" },
  ".cm-dialogue":   { width: "3.6in", margin: "0 auto" },
  ".cm-transition": { textAlign: "right", textTransform: "uppercase" },
  ".cm-heading":    { textAlign: "left", textTransform: "uppercase",
                      fontWeight: "bolder" },
  ".cm-line-break::after": {
    content: '""',
    display: "block",
    borderBottom: "1px solid #ccc",
    margin: "1em 0",
  },
  // ".cm-heading::before": {
  //   content: '""',
  //   display: "block",
  //   borderBottom: "1px dotted #ccc",
  //   margin: "0.75em 0",
  // },
  ".cm-heading::before": {
    content: "attr(data-scene)",
    position: "absolute",
    left: 0,
    width: "1in",
    textAlign: "right",
    fontWeight: "bold"
  }
});

const pageMargins = EditorView.baseTheme({
  ".cm-scroller": { paddingLeft: "1in", paddingRight: "1in" }
});

const centerColumn = EditorView.baseTheme({
  ".cm-content": { maxWidth: "7.5in", margin: "0 auto" }
});

/*──────────────────────────────────────────────────────────────────────────*/
/* 2. Factory export                                                       */
/*────────────────────────────────────────────────────────────────────────*/

export function buildEditor({ parent, screenplay = demoScript } = {}) {
  if (!parent)
    throw new Error("buildEditor: { parent } element is required");

  const { text, lineMap } = toPlainText(screenplay);

  const screenplayLayout = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.build(view); }
    update(u) {
      if (u.docChanged || u.viewportChanged)
        this.decorations = this.build(u.view);
    }
    build(view) {
      const builder = new RangeSetBuilder();
      for (let { from } of view.viewportLineBlocks) {
        const lineNo = view.state.doc.lineAt(from).number - 1;
        const mapping = lineMap[lineNo];
        if (!mapping) continue;

        let cls;
        if (mapping.type === "dialogue") {
          cls = mapping.field === "character"     ? "cm-char"
              : mapping.field === "parenthetical" ? "cm-paren"
              : "cm-dialogue";
        } else if (mapping.type === "transition")    cls = "cm-transition";
          else if (mapping.type === "scene_heading") cls = "cm-heading";
          else if (mapping.type === "action")        cls = "cm-action";
          else if (mapping.type === "title")         cls = "cm-fp-title";
          else if (mapping.type === "source")        cls = "cm-center";
          else if (mapping.type === "byline")        cls = "cm-center";
          else if (mapping.type === "date")          cls = "cm-right";
          else if (mapping.type === "contact")       cls = "cm-left";
          else if (mapping.type === "page_break")    cls = "cm-line-break";
          else                                       cls = "cm-body";

        if (mapping.type === "scene_heading") {
          // e.g. mapping.number === 12
          builder.add(from, from, Decoration.line({ class: "cm-heading", attributes: { "data-scene": String(mapping.SceneNo) }}));
        } else {
          builder.add(from, from, Decoration.line({ class: cls }));
        }
      }
      return builder.finish();
    }
  }, { decorations: v => v.decorations });

  return new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        screenplayLayout,
        keymap.of(defaultKeymap),
        oneDark,
        EditorView.lineWrapping,
        EditorView.editable.of(false),  // make it read-only
        myTheme,
        centerColumn
      ]
    }),
    parent
  });
}
