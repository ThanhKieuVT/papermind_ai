/**
 * Minimal promise wrapper around IndexedDB. All data lives only in the current
 * browser profile; nothing is synchronized to a server.
 */
export const DB_NAME = "papermind";
export const DB_VERSION = 2;

export const STORES = {
  library: "library",
  documents: "documents",
  study: "study",
  photos: "photos",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.library)) {
        db.createObjectStore(STORES.library, { keyPath: "paper.id" });
      }
      if (!db.objectStoreNames.contains(STORES.documents)) {
        db.createObjectStore(STORES.documents, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.study)) {
        db.createObjectStore(STORES.study, { keyPath: "id" });
      }
      // v2: personal photo gallery
      if (!db.objectStoreNames.contains(STORES.photos)) {
        db.createObjectStore(STORES.photos, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab is upgrading/deleting the database: release our connection.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Failed to open the local database."));
    };
  });
  return dbPromise;
}

/** Closes and forgets the cached connection (used by tests and before deleting the database). */
export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending.catch(() => null))?.close();
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(store, mode);
  // Attach completion handlers before awaiting anything, so a fast commit is never missed.
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
  const [result] = await Promise.all([wrap(fn(tx.objectStore(store))), done]);
  return result;
}

export function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withStore(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return withStore(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  await withStore(store, "readwrite", (s) => s.put(value));
}

export async function dbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  await withStore(store, "readwrite", (s) => s.delete(key));
}

export async function dbClear(store: StoreName): Promise<void> {
  await withStore(store, "readwrite", (s) => s.clear());
}
