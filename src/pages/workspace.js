// src/pages/workspace.js
import { validateScrypt } from '../data-layer/validator.js';
import { saveScrypt, deleteScrypt, getAllScryptMetas } from "../data-layer/db.js";
import { exportScript, hasNativeSaveDialog } from "../services/export-service.js";


export default function makeWorkspacePage() {
  const wrapper = document.createElement("div");
  wrapper.className = "workspace-page";
  
  // Title
  const title = document.createElement("h2");
  title.textContent = "🗂 Workspace";
  wrapper.appendChild(title);

  // Local-storage notice
  const notice = document.createElement("p");
  notice.className = "workspace-notice";
  notice.innerHTML = `
   <strong>Note:</strong> Everything in this workspace is saved locally in your browser and will remain available even after closing the app or restarting your device.<br/>
   Scrypts stored here won’t be available on other devices or browsers, and clearing site data will remove them.<br/>
   Use <b>Export / Download</b> to create backup or portable copies.<br/>
  `;
  wrapper.appendChild(notice);

  const section1 = document.createElement("h3");
  section1.textContent = "Import Scrypt file";
  wrapper.appendChild(section1);

  // File input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".scrypt";
  wrapper.appendChild(fileInput);

  // Placeholder for validation/errors
  const message = document.createElement("div");
  message.className = "workspace-message";
  wrapper.appendChild(message);

  // Container for the list
  const section2 = document.createElement("h3");
  section2.textContent = "Local Scrypts";
  wrapper.appendChild(section2);

  const list = document.createElement("div");
  list.className = "workspace-grid";
  wrapper.appendChild(list);

  // Render the current scripts in DB
  async function refreshList() {
    list.replaceChildren();
    const scripts = await getAllScryptMetas();
    scripts.forEach(s => {
      // const li = document.createElement("li");
      // li.textContent = (s.titlePage?.title ?? `Script #${s.id}`);
      // One row
      const row = document.createElement("div");
      row.className = "workspace-row";

      // Title / fallback
      const title = document.createElement("span");
      title.textContent = s.titlePage?.title ?? `Script #${s.id}`;
      row.appendChild(title);

      // Load button
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Open";
      loadBtn.onclick = () =>
        wrapper.dispatchEvent(new CustomEvent('open-scrypt', {
          detail: { id: s.id, view: 'editor' },
          bubbles: true, composed: true
        }));
      row.appendChild(loadBtn);

      // Export button
      const expBtn = document.createElement("button");
      expBtn.textContent = hasNativeSaveDialog ? "Export" : "Download";
      expBtn.onclick = () => exportScript({ id: s.id, format: "scrypt" });
      row.appendChild(expBtn);


      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "Remove";
      delBtn.onclick = async () => {
        await deleteScrypt(s.id);
        refreshList();
      };
      row.appendChild(delBtn);

      list.appendChild(row);
    });
  }

   // Handle file selection
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);

      const { ok, errors } = await validateScrypt(obj);
      if (!ok) {
        const msg = errors.map(e => `${e.instancePath} ${e.message}`).join('; ');
        throw new Error(`Invalid screenplay JSON: ${msg}`);
      }

      delete obj.id;
      const id = await saveScrypt(obj);

      message.textContent = `Imported script with ID ${id}.`;
      message.style.color = "green";
      fileInput.value = "";
      await refreshList();
    } catch (err) {
      console.error(err);
      message.textContent = `Error importing file: ${err.message}`;
      message.style.color = "red";
    }
  });

  // Initial population
  refreshList();

  return wrapper;
}
