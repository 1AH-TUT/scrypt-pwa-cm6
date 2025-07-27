// src/views/editor-view-themes.js

import { EditorView } from "@codemirror/view";

/**
 * mainTheme — Custom screenplay editor theme for CodeMirror 6.
 * - Sets font, spacing, element coloring, etc.
 * - Used in editor-view.js as an extension.
 */
export const mainTheme = EditorView.baseTheme({
  ".cm-content": {
    fontFamily: "var(--font-screenplay, 'Courier Prime, monospace')", fontSize: "var(--font-size-screenplay, 12pt)",
    paddingLeft: "1.4in", paddingRight: "0.7in", margin: "0 auto", maxWidth: "8.5in",

  },
  ".cm-scroller": { lineHeight: "1.2", overflowY: "auto", width: "100%", height: "100%" },
  ".cm-line": { padding: "0 2 0 0", borderLeft: "3px solid transparent", position: "relative" },
  ".cm-fp-title": {
    fontWeight: "bold", textTransform: "uppercase", textDecoration: "underline", textAlign: "center",
    fontSize: "var(--font-size-screenplay-title, 16pt)"
  },
  ".cm-right": {textAlign: "right"},
  ".cm-left": {textAlign: "left"},
  ".cm-center": {textAlign: "center"},
  ".cm-char": {
    width: "3.6in",
    margin: "0 auto",
    textAlign: "center",
    paddingBottom: ".1em",
    textTransform: "uppercase",
    fontWeight: "bold"
  },
  ".cm-paren": {width: "3.6in", margin: "0 auto", textAlign: "center", paddingBottom: ".1em"},
  ".cm-dialogue": {width: "3.6in", margin: "0 auto"},
  ".cm-transition": {textAlign: "right", textTransform: "uppercase"},
  ".cm-heading": {textAlign: "left", textTransform: "uppercase", fontWeight: "bold"},

  ".cm-heading::before": {
    content: "attr(data-scene)", position: "absolute", left: "-1.4in", width: "1.2in",
    textAlign: "right", fontWeight: "bold"
  },
  ".cm-elt-selected": {
    backgroundColor: "var(--cm-editor-selected-bg, rgba(255, 200, 0, 0.1))",
    borderLeftColor: "var(--cm-editor-highlight-title-page, #ffa600)"
  },
  ".cm-elt-selected-dialogue": {borderLeftColor: "var(--cm-editor-highlight-dialogue, #ffa600)"},
  ".cm-elt-selected-action": {borderLeftColor: "var(--cm-editor-highlight-action, #00bfff)"},
  ".cm-elt-selected-scene_heading": {borderLeftColor: "var(--cm-editor-highlight-scene_heading, #32cd32)"},
  ".cm-elt-selected-transition": {borderLeftColor: "var(--cm-editor-highlight-transition, #ff69b4)"},
  ".cm-insert-bar": {
    display: "flex", gap: ".5rem", justifyContent: "center", alignItems: "stretch", width: "100%",
    margin: ".5rem 0", padding: ".25rem", background: "inherit", color: "inherit",
    fontSize: "smaller", boxSizing: "border-box"
  },
  ".cm-insert-bar button": {
    flex: "1 1 0", minWidth: 0, padding: ".5rem 1rem", background: "inherit", color: "inherit",
    border: "1px solid", borderRadius: "0.25em", cursor: "pointer", font: "inherit",
    transition: "background 0.2s, color 0.2s"
  },
  ".cm-insert-bar button:focus, .cm-insert-bar button:hover": {
    background: "var(--cm-insert-bar-btn-active-bg, #fffbe6)", color: "var(--cm-insert-bar-btn-active-fg, #000)"
  },
  ".cm-insert-btn-action:focus, .cm-insert-btn-action:hover": {
    outline: "2px solid var(--cm-editor-highlight-action, #00bfff)", borderColor: "var(--cm-editor-highlight-action, #00bfff)"
  },
  ".cm-insert-btn-dialogue:focus, .cm-insert-btn-dialogue:hover": {
    outline: "2px solid var(--cm-editor-highlight-dialogue, #ffa600)", borderColor: "var(--cm-editor-highlight-dialogue, #ffa600)"
  },
  ".cm-insert-btn-scene_heading:focus, .cm-insert-btn-scene_heading:hover": {
    outline: "2px solid var(--cm-editor-highlight-scene_heading, #32cd32)", borderColor: "var(--cm-editor-highlight-scene_heading, #32cd32)"
  },
  ".cm-insert-btn-transition:focus, .cm-insert-btn-transition:hover": {
    outline: "2px solid var(--cm-editor-highlight-transition, #ff69b4)", borderColor: "var(--cm-editor-highlight-transition, #ff69b4)"
  },
  "edit-title-input, edit-title-contact": {
    fontFamily: "var(--font-screenplay, 'Courier Prime', monospace)", fontSize: "var(--font-size-screenplay, 12pt)"
  },
  ".cm-title-label:hover::before,.cm-title-label.cm-elt-selected::before": {
    content: 'attr(data-label)', position: "absolute", left: "-1.4in", width: "1.3in", opacity: "0.9", textAlign: "right", fontSize: "smaller",
    fontStyle: "italic", fontWeight: "normal", textTransform: "none", pointerEvents: "none", whiteSpace: "nowrap", marginTop: "0.2em"
  },
  ".cm-line.cm-page-break": { position: "relative", lineHeight: "0", margin: "1rem 0", padding: "0", borderLeft: "none" },
  ".cm-line.cm-page-break::before": { content: '""', position: "absolute", height: "1rem", background: "var(--bg-page)",
    right: "-0.7in", left: "-1.4in"  // negate page padding
  },
  ".cm-line.cm-page-break::after": { content: 'attr(data-pg)', position: "absolute", top: "3rem", right: "0", opacity: "0.8" }
});
