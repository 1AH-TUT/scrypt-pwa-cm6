import { EditorController } from "../controllers/editor-controller.js";
import { createEditorView } from "../views/editor-view.js";
import { getCurrentScrypt } from "../state/current-scrypt.js";

export default function makeEditorPage() {
  const scrypt = getCurrentScrypt();
  if (!scrypt) throw new Error("No script loaded");

  const controller= new EditorController();

  /* layout wrapper with gutters */
  const wrapper   = document.createElement("div");
  wrapper.className = "editor-page";
  wrapper.appendChild(document.createElement("div"));
  const centre = document.createElement("div");
  centre.className = "editor-centre";
  wrapper.appendChild(centre);
  wrapper.appendChild(document.createElement("div"));

  createEditorView({ parent: centre, controller });

  return wrapper;
}
