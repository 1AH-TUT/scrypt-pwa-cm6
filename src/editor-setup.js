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

import { screenplay as demoScript, toPlainText } from "./sample-script.js";

/*───────────────────────────────────────────────────────────────────────────*/
/* 1. Styles & layout helpers                                               */
/*─────────────────────────────────────────────────────────────────────────*/

const myTheme = EditorView.baseTheme({
  ".cm-content": { fontFamily: "Courier Prime, monospace", fontSize: "12pt" },
  ".cm-scroller": { lineHeight: "1.2" },
  ".cm-char": { display: "inline-block", maxWidth: "100%", left: "50%",
                transform: "translateX(-50%)", position: "relative",
                textAlign: "center", marginBottom: ".6em",
                textTransform: "uppercase", fontWeight: "bolder" },
  ".cm-dialogue": { width: "4in", margin: "0 auto", textAlign: "center" },
  ".cm-transition": { textAlign: "right", textTransform: "uppercase",
                      fontWeight: "bolder" },
  ".cm-heading": { textAlign: "left", textTransform: "uppercase",
                   fontWeight: "bolder" }
});

const pageMargins = EditorView.baseTheme({
  ".cm-scroller": { paddingLeft: "1in", paddingRight: "1in" }
});

const centerColumn = EditorView.baseTheme({
  ".cm-content": { maxWidth: "7.5in", margin: "0 auto" }
});

/*──────────────────────────────────────────────────────────────────────────*/
/* 2. Factory export                                                       */
/*──────────────────────────────────────────────────────────── ───────────*/

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
          else                                       cls = "cm-body";

        builder.add(from, from, Decoration.line({ class: cls }));
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
        myTheme,
        centerColumn
      ]
    }),
    parent
  });
}
