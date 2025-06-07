import * as pages from "./pages/index.js";

const slot = document.getElementById("page-slot");
export function mountPage(name, scriptObj) {
  console.log("Mounting Page:", name);
  slot.innerHTML = "";

  let make = pages['splash'];
  if (name === "editor") make = () => pages[name](scriptObj);
  else if (name === "library") make = pages[name];

  // call it and append its return value to 'page-slot'
  const pageEl = make();
  slot.appendChild(pageEl);
}
