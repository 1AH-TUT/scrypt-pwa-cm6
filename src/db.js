import { openDB } from 'idb';

const DB_NAME    = 'scrypts';
const STORE_NAME = 'scripts';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Create an objectStore with a keyPath if you want auto-incrementing IDs:
    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  }
});

// CRUD operations
export async function putScript(script) {
  // Expects `script` to be an object, e.g. { id?, title, elements, ... }
  const db = await dbPromise;
  return db.put(STORE_NAME, script);
}

export async function getAllScripts() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

export async function getScript(id) {
  const db = await dbPromise;
  return db.get(STORE_NAME, id);
}

export async function deleteScript(id) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, id);
}
