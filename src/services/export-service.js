import { getScrypt }          from "../data-layer/db.js";
import { Scrypt }             from "../scrypt/scrypt.js";

// ---- public façade ----

export const hasNativeSaveDialog = 'showSaveFilePicker' in window;

export async function exportScript({ id, instance = null, format = "scrypt" }) {
  const data = instance ? instance.getJson()       // already loaded in editor
                         : await getScrypt(id);    // fetch straight from DB

  if (!data) throw new Error(`No script found for id ${id}`);

  const { blob, filename } = await exporters[format](data);
  triggerDownload(blob, filename);
}

// ---- format-specific exporters ----
const exporters = {
  async scrypt(data) {
    // Strip DB id for portability
    const { id, ...portable } = data;
    const name     = slug(portable.titlePage?.title) || "untitled";
    const json     = JSON.stringify(portable, null, 2);
    const blob     = new Blob([json], { type: "application/json" });
    return { blob, filename: `${name}.scrypt` };
  },

  async pdf(data) {
    // stub — will take a Scrypt instance later
    const scrypt   = (data instanceof Scrypt) ? data : new Scrypt(data);
    const blob     = await buildPdfBlob(scrypt);   // TODO
    const name     = slug(scrypt.titlePage?.title) || "script";
    return { blob, filename: `${name}.pdf` };
  }
};

// ---- shared helpers ----
function slug(str = "") {
  return str.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
}

async function triggerDownload(blob, filename) {
  if ('showSaveFilePicker' in window) {
    // Prompt user for a path
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'Scrypt screenplay',
        accept: { 'application/json': ['.scrypt'] }
      }]
    });

    // Stream the blob to disk
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;          // ← done – no auto-download
  }

  // Fallback for Safari / Firefox - use download
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'),
               { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

