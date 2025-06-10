// src/pages/library.js
import { validateScrypt } from '../data-layer/validator.js';
import { saveScrypt, deleteScrypt, getAllScryptMetas } from "../data-layer/db.js";

export default function makeLibraryPage() {
  const wrapper = document.createElement("div");
  wrapper.className = "library-page";
  
  // Title
  const title = document.createElement("h2");
  title.textContent = "📚 Library";
  wrapper.appendChild(title);

  // File input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".scrypt,application/json";
  wrapper.appendChild(fileInput);

  // Placeholder for validation/errors
  const message = document.createElement("div");
  message.className = "library-message";
  wrapper.appendChild(message);

  // Container for the list
  const list = document.createElement("ul");
  list.className = "library-list";
  wrapper.appendChild(list);

  // Render the current scripts in DB
  async function refreshList() {
    list.innerHTML = "";
    const scripts = await getAllScryptMetas();
    scripts.forEach(s => {
      const li = document.createElement("li");
      li.textContent = (s.titlePage?.title ?? `Script #${s.id}`);
      
      // Load button
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.onclick = () =>
        wrapper.dispatchEvent(new CustomEvent('open-scrypt', {
          detail: { id: s.id, view: 'editor' },
          bubbles: true, composed: true
        }));
      li.appendChild(loadBtn);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = async () => {
        await deleteScrypt(s.id);
        refreshList();
      };
      li.appendChild(delBtn);

      list.appendChild(li);
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
