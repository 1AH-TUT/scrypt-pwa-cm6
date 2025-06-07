const slot = document.getElementById("page-slot");

export function mountPage(name) {
  console.log("Mounting Page:", name);
  slot.innerHTML = "";            // clear
  switch (name) {
    case "editor":
      import("./pages/editor.js").then(({default: elm}) =>
        slot.appendChild(elm()));
      break;
    case "library":
      import("./pages/library.js").then(({default: elm}) =>
        slot.appendChild(elm()));
      break;
    default:
      import("./pages/splash.js").then(({default: elm}) =>
        slot.appendChild(elm()));
  }
}
