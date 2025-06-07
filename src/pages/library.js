// src/pages/library.js
import { putScript, getAllScripts, deleteScript } from "../db.js";

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
    const scripts = await getAllScripts();
    scripts.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s.title || `Script #${s.id}`;
      
      // Load button
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.onclick = () =>
        wrapper.dispatchEvent(new CustomEvent("load-script", {
          detail: s,
          bubbles: true,
          composed: true
        }));
      li.appendChild(loadBtn);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = async () => {
        await deleteScript(s.id);
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
      const json = JSON.parse(text);
      // TODO: validate `json` matches your screenplay schema
      // Hack: adjust format
      json['elements'] = normalizeElements(json['elements'])

      const key = await putScript(json);
      message.textContent = `Imported script with ID ${key}.`;
      message.style.color = "green";
      fileInput.value = "";  // reset
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

function normalizeElements(elements) {
  return elements.map(el => {
    const {
      type,
      transition,
      action,
      dialogue,
      heading,
      location,
      time,
      character,
      parenthetical,
      ...rest
    } = el;

    let text;
    switch (type) {
      case "transition":
        text = transition;
        break;

      case "action":
        text = action;
        break;

      case "dialogue":
        text = dialogue;
        break;

      case "scene_heading":
        // Clean up whitespace and assemble:
        const h = (heading   || "").trim();   // e.g. "EXT."
        const loc = (location || "").trim();  // e.g. "VENICE"
        const t   = (time     || "").trim();  // e.g. "NIGHT"
        // If heading already ends with a period, no extra dot
        const head = h.endsWith(".") ? h : h + ".";
        // Join with spaces and an em-dash
        text = [head, loc, t]
                 .filter(Boolean)
                 .join(" ")
                 .replace(/ ([^ ]+)$/, " — $1");
        break;

      default:
        text = "";
    }

    return {
      type,
      ...(character     && { character }),
      ...(parenthetical && { parenthetical }),
      text,
      ...rest
    };
  });
}
