import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, ViewPlugin, Decoration, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

import {screenplay, toPlainText} from "./sample-script.js";

/*--- 1. build flat text + map ----------------------------------*/
const {text, lineMap} = toPlainText(screenplay);

/*--- 2. plugin after the map exists ----------------------------*/
const screenplayLayout = ViewPlugin.fromClass(class {
  constructor(view){ this.decorations = this.build(view); }
  update(u){ if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }

  build(view){
    const builder = new RangeSetBuilder();
    for (let {from} of view.viewportLineBlocks){
      const lineNo  = view.state.doc.lineAt(from).number - 1;
      const mapping = lineMap[lineNo];
      if (!mapping) continue;

      let cls;
      console.log(mapping)
      if (mapping.type === "dialogue") {
        cls = mapping.field === "character"     ? "cm-char"
            : mapping.field === "parenthetical" ? "cm-paren"
            : "cm-dialogue";
      } else if (mapping.type === "transition") {
        cls = "cm-transition";
      } else if (mapping.type === "scene_heading") {
        cls = "cm-heading";
      } else if (mapping.type === "action") {
        cls = "cm-action";
      } else {
        cls = "cm-body";
      }

      builder.add(from, from, Decoration.line({class: cls}));
    }
    return builder.finish();
  }
},{
  decorations: v => v.decorations
});

/*--- 3. themes -----------------------------------*/
const myTheme = EditorView.baseTheme({
  ".cm-content": {fontFamily:"Courier Prime, monospace", fontSize:"12pt"},
  ".cm-scroller": {lineHeight:"1.2"},
  ".cm-char": {
                display: "inline-block",
                maxWidth:    "100%",
                left: "50%", 
                transform: "translateX(-50%)",
                position: "relative",
                textAlign:   "center",
                marginBottom: ".6em",
                textTransform: "uppercase"
              },
  ".cm-dialogue": {
                width: "4in", marginLeft: "auto", marginRight: "auto", textAlign: "center"
              },
  ".cm-transition": {textAlign: "right", textTransform: "uppercase"},
  ".cm-heading": {textAlign: "left", textTransform: "uppercase"},
  ":host": {background:"#111", color:"#eee"}
});

const pageMargins = EditorView.baseTheme({
  /* margin inside the editable area (affects text & gutters) */
  ".cm-scroller": {
    paddingLeft:  "1in",   /* 1-inch margins – tweak as you like */
    paddingRight: "1in"
  }
});

const centerColumn = EditorView.baseTheme({
  ".cm-content": {
    maxWidth: "7.5in",      /* typical screenplay width */
    margin:   "0 auto"      /* auto side-margins = centered */
  }
});

/*--- 4. spin up the editor ------------------------------------*/
new EditorView({
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
  parent: document.getElementById("editor")
});
