import * as pages from "./pages/index.js";

const slot = document.getElementById("page-slot");
export function mountPage(name) {
  console.log("Mounting Page:", name);
  slot.innerHTML = "";

  // pick the factory, default to splash
  const makePage = pages[name] || pages.splash;

  // call it and append its return value to 'page-slot'
  const pageEl = makePage();
  slot.appendChild(pageEl);
}
