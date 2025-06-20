
const state_keys = {
    "currentScrypt": "script_current",
    "lastScrypt": "script_last_opened",
}

export function getCurrentScriptId() {
  // Use session if we have it
  let v = sessionStorage.getItem(state_keys.currentScrypt);
  if (v != null) return Number(v) || null;

  // Fallback to last opened
  v = localStorage.getItem(state_keys.lastScrypt);
  if (v != null) return Number(v) || null;

  return null;
}

export function setCurrentScriptId(id) {
  if (id == null) {
    sessionStorage.removeItem(state_keys.currentScrypt);
  } else {
    sessionStorage.setItem(state_keys.currentScrypt, String(id));
    localStorage.setItem(state_keys.lastScrypt,     String(id));
  }
}