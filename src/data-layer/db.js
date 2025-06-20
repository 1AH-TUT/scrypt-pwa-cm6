import { openDB } from 'idb';

const DB_NAME       = 'scrypts';
const DB_VERSION   = 2;
const META_STORE    = 'scripts_meta';
const DATA_STORE    = 'scripts_data';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(DATA_STORE)) {
      db.createObjectStore(DATA_STORE, { keyPath: 'id' });
    }
  }
});

/**
 * Get all scrypts’ meta + titlePage info for listing.
 * Returns array: { id, titlePage, metaData }
 */
export async function getAllScryptMetas() {
  const db = await dbPromise;
  return db.getAll(META_STORE);
}

/**
 * Get the full scrypt by id: { id, titlePage, metaData, data }
 */
export async function getScrypt(id) {
  const db = await dbPromise;
  const meta = await db.get(META_STORE, id);
  const data = await db.get(DATA_STORE, id);
  if (!meta) return null;
  return {
    id: meta.id,
    titlePage: meta.titlePage,
    metaData: meta.metaData,
    data: (data && data.data) || { scenes: [] }
  };
}

/**
 * Save a full scrypt: { id?, titlePage, metaData, data }
 * Returns id (number)
 */
export async function saveScrypt(scrypt) {
  const db = await dbPromise;
  // Assign id for updates, let auto-increment handle new records
  const meta = {
    titlePage: scrypt.titlePage,
    metaData: scrypt.metaData
  };
  if (typeof scrypt.id === "number" && Number.isFinite(scrypt.id)) {
    meta.id = scrypt.id;
  }
  // Store meta (creates id if new)
  const key = await db.put(META_STORE, meta);

  // Ensure scrypt.id for new entries
  scrypt.id = key;

  // Update the data
  await db.put(DATA_STORE, { id: key, data: scrypt.data });

  console.debug("Saved Scrypt id:", key)
  return key;
}

/**
 * Delete a scrypt and all its data by id.
 */
export async function deleteScrypt(id) {
  const db = await dbPromise;
  await db.delete(META_STORE, id);
  await db.delete(DATA_STORE, id);
}
