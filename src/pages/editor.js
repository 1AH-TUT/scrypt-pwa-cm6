import { EditorController } from "../controllers/editor-controller.js";
import { createEditorView } from "../views/editor-view.js";
import { getCurrentScrypt } from "../state/current-scrypt.js";

export default function makeEditorPage() {
  const scrypt = getCurrentScrypt();
  if (!scrypt) throw new Error("No script loaded");

  const controller= new EditorController(scrypt);
  const wrapper   = document.createElement("div");
  wrapper.className = "editor-page";

  createEditorView({ parent: wrapper, controller });

  return wrapper;
}
