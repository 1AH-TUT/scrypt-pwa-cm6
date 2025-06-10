// src/router.js
import * as pages from "./pages/index.js";

const slot = document.getElementById("page-slot");

/**
 * Mounts one of your pages into #page-slot.
 * @param {"splash"|"library"|"editor"} name
 * @param {number=} payload  // for editor, the script ID
 */
export function mountPage(name) {
  console.log("Mounting Page:", name);
  slot.innerHTML = "";

  let pageEl;
  switch (name) {
    case "editor":
      pageEl = pages.editor();
      break;

    case "library":
      pageEl = pages.library();
      break;

    default:  // "splash" or anything else
      pageEl = pages.splash();
      break;
  }

  slot.appendChild(pageEl);
}
