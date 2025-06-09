import { createEditorView } from "../editor-view.js";
import { DocController } from "../doc-controller.js";

export default function makeEditorPage(scriptObj) {
  const wrapper = document.createElement("div");
  wrapper.className = "editor-page";

  // gutters
  wrapper.appendChild(document.createElement("div"));
  const centre = document.createElement("div");
  centre.className = "editor-centre";
  wrapper.appendChild(centre);
  wrapper.appendChild(document.createElement("div"));

  // buildEditor({ parent: centre, screenplay: scriptObj });
  const controller = new DocController(scriptObj);
  createEditorView({ parent: centre, controller });
  return wrapper;
}
