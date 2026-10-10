export type StoredQuizAttempt = {
  id?: number;
  attempt_uuid?: string | null;
  module_id: number;
  score: number;
  passed: boolean;
  question_count: number;
  attempted_at: string;
  quiz_version: string;
  responses?: unknown[];
  reflection_prompt: string;
  reflection_answer: string;
  reflection_model: string;
  sync_pending?: boolean;
  [key: string]: unknown;
};

const DB_NAME = "cvhs-flight-school";
const DB_VERSION = 1;
const ATTEMPTS_STORE = "quiz_attempts";
const OWNER_INDEX = "owner";

function recordKey(owner: string, attempt: StoredQuizAttempt): string {
  const identity = attempt.attempt_uuid || `legacy-${attempt.id ?? "unknown"}-${attempt.module_id}-${attempt.attempted_at}`;
  return `${owner}:${identity}`;
}

function fallbackKey(owner: string) {
  return `cvhs-flight-school-quiz-attempts-${owner}-v3`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const store = db.createObjectStore(ATTEMPTS_STORE, { keyPath: "key" });
        store.createIndex(OWNER_INDEX, "owner", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB"));
  });
}

function fallbackRead(owner: string): StoredQuizAttempt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(fallbackKey(owner)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fallbackWrite(owner: string, attempts: StoredQuizAttempt[]) {
  try {
    localStorage.setItem(fallbackKey(owner), JSON.stringify(attempts));
  } catch {
    // If both IndexedDB and localStorage fail, cloud synchronization may still
    // succeed for authenticated users. Callers keep the attempt in React state.
  }
}

async function migrateFallback(owner: string, db: IDBDatabase): Promise<void> {
  const legacy = fallbackRead(owner);
  if (!legacy.length) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
    const store = tx.objectStore(ATTEMPTS_STORE);
    for (const attempt of legacy) {
      store.put({ key: recordKey(owner, attempt), owner, attempt });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Attempt migration failed"));
    tx.onabort = () => reject(tx.error || new Error("Attempt migration aborted"));
  });
  try { localStorage.removeItem(fallbackKey(owner)); } catch { /* ignore */ }
}

export async function getStoredAttempts<T extends StoredQuizAttempt = StoredQuizAttempt>(owner: string): Promise<T[]> {
  try {
    const db = await openDatabase();
    await migrateFallback(owner, db);
    const rows = await new Promise<Array<{ attempt: T }>>((resolve, reject) => {
      const tx = db.transaction(ATTEMPTS_STORE, "readonly");
      const index = tx.objectStore(ATTEMPTS_STORE).index(OWNER_INDEX);
      const request = index.getAll(IDBKeyRange.only(owner));
      request.onsuccess = () => resolve(request.result as Array<{ attempt: T }>);
      request.onerror = () => reject(request.error || new Error("Attempt read failed"));
    });
    db.close();
    return rows.map((row) => row.attempt).sort((a, b) => b.attempted_at.localeCompare(a.attempted_at));
  } catch {
    return fallbackRead(owner) as T[];
  }
}

export async function putStoredAttempt(owner: string, attempt: StoredQuizAttempt): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
      tx.objectStore(ATTEMPTS_STORE).put({ key: recordKey(owner, attempt), owner, attempt });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Attempt write failed"));
      tx.onabort = () => reject(tx.error || new Error("Attempt write aborted"));
    });
    db.close();
  } catch {
    const existing = fallbackRead(owner);
    const key = recordKey(owner, attempt);
    const merged = [attempt, ...existing.filter((item) => recordKey(owner, item) !== key)]
      .sort((a, b) => b.attempted_at.localeCompare(a.attempted_at));
    fallbackWrite(owner, merged);
  }
}

export async function putStoredAttempts(owner: string, attempts: StoredQuizAttempt[]): Promise<void> {
  if (!attempts.length) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ATTEMPTS_STORE, "readwrite");
      const store = tx.objectStore(ATTEMPTS_STORE);
      for (const attempt of attempts) {
        store.put({ key: recordKey(owner, attempt), owner, attempt });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Attempt batch write failed"));
      tx.onabort = () => reject(tx.error || new Error("Attempt batch write aborted"));
    });
    db.close();
  } catch {
    const existing = fallbackRead(owner);
    const mergedByKey = new Map<string, StoredQuizAttempt>();
    for (const attempt of [...existing, ...attempts]) mergedByKey.set(recordKey(owner, attempt), attempt);
    fallbackWrite(owner, [...mergedByKey.values()].sort((a, b) => b.attempted_at.localeCompare(a.attempted_at)));
  }
}
