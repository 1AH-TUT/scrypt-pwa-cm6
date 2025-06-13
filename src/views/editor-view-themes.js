// src/views/editor-view-themes.js

import { EditorView } from "@codemirror/view";

/**
 * myTheme — Custom screenplay editor theme for CodeMirror 6.
 * - Sets font, spacing, element coloring, etc.
 * - Used in editor-view.js as an extension.
 */
export const myTheme = EditorView.baseTheme({
  ".cm-content":    { fontFamily: "var(--font-screenplay, \"Courier Prime, monospace\")", fontSize: "12pt", marginLeft: "1.3in", marginRight: "1in" },
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

  ".cm-line-break::after": { content: '""', display: "block", borderBottom: "1px solid #ccc", margin: "1em 0" },
  ".cm-heading::before":   { content: "attr(data-scene)", position: "absolute", left: 0, width: "1in",
                             textAlign: "right", fontWeight: "bold" },
  ".cm-elt-selected": { backgroundColor: "rgba(255, 200, 0, 0.1)", borderLeft: "3px solid #ffa600" },
  ".cm-elt-selected-dialogue":      { borderLeftColor: "#ffa600" }, /* gold */
  ".cm-elt-selected-action":        { borderLeftColor: "#00bfff" }, /* sky blue */
  ".cm-elt-selected-scene_heading": { borderLeftColor: "#32cd32" }, /* lime green */
  ".cm-elt-selected-transition":    { borderLeftColor: "#ff69b4" }, /* hot pink */
});
