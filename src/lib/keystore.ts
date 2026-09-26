/**
 * Husker den avledede nøkkelen på denne enheten (valgfritt), slik at man
 * slipper å skrive familiepassordet hver gang. Nøkkelen lagres som et
 * ikke-eksporterbart CryptoKey-objekt i IndexedDB – selve nøkkelbytene
 * kan ikke leses ut av JavaScript, heller ikke av appen selv.
 */
const DB = 'mors-kalender-keys';
const STORE = 'keys';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveKey(id: string, key: CryptoKey): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(key, id));
  } catch {
    /* privat modus o.l. – da må passordet skrives inn hver gang */
  }
}

export async function loadKey(id: string): Promise<CryptoKey | null> {
  try {
    return ((await run('readonly', (s) => s.get(id))) as CryptoKey | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearKeys(): Promise<void> {
  try {
    await run('readwrite', (s) => s.clear());
  } catch {
    /* ignorer */
  }
}
