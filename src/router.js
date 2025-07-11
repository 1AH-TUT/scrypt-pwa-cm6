// src/router.js
import * as pages from "./pages/index.js";

const slot = document.getElementById("view-slot");

/**
 * Mounts a page into #page-slot.
 * @param {"splash"|"workspace"|"editor"} name
 */
export function mountPage(name) {
  console.debug("Mounting Page:", name);
  slot.innerHTML = "";

  let pageEl;
  switch (name) {
    case "new":
      pageEl = pages.newScrypt();
      break;

    case "editor":
      pageEl = pages.editor();
      break;

    case "workspace":
      pageEl = pages.workspace();
      break;

    default:
      pageEl = pages.splash();
      break;
  }

  window.dispatchEvent(new CustomEvent("page-changed", { detail: name }));
  slot.appendChild(pageEl);
}
