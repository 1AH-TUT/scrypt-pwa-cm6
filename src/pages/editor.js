import { buildEditor } from "../editor-setup.js";

export default function makeEditorPage() {
  const wrapper = document.createElement("div");
  wrapper.className = "editor-page";

  // gutters
  wrapper.appendChild(document.createElement("div"));
  const centre = document.createElement("div");
  centre.className = "editor-centre";
  wrapper.appendChild(centre);
  wrapper.appendChild(document.createElement("div"));

  buildEditor({ parent: centre });   // put CodeMirror into centre div
  return wrapper;
}
