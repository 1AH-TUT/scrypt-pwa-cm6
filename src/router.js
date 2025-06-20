// src/router.js
import * as pages from "./pages/index.js";

const slot = document.getElementById("view-slot");

/**
 * Mounts a page into #page-slot.
 * @param {"splash"|"library"|"editor"} name
 */
export function mountPage(name) {
  console.debug("Mounting Page:", name);
  slot.innerHTML = "";

  let pageEl;
  switch (name) {
    case "editor":
      pageEl = pages.editor();
      break;

    case "library":
      pageEl = pages.library();
      break;

    default:
      pageEl = pages.splash();
      break;
  }

  slot.appendChild(pageEl);
}
