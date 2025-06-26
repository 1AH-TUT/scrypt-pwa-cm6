let currentScrypt = null;
export function setCurrentScrypt(scrypt) {
  currentScrypt = scrypt;
  window.dispatchEvent(new CustomEvent("scrypt-changed"));
}
export function getCurrentScrypt() { return currentScrypt }

export function hasCurrentScrypt() { return currentScrypt !== null }
