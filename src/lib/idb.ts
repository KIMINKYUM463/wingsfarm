/**
 * 브라우저 IndexedDB 공용 연결 — 보관함·상세페이지 프로젝트가 같은 DB를 쓴다.
 * 스토어를 추가할 때는 DB_VERSION을 올리고 STORES에 이름을 더한다.
 */

const DB_NAME = "wingsfarm-ai-archive";
const DB_VERSION = 2;
export const STORES = { archive: "items", detailProjects: "detailProjects", detailSummaries: "detailSummaries" } as const;
type StoreName = (typeof STORES)[keyof typeof STORES];
/** 스토어별 정렬용 시간 인덱스 */
const TIME_INDEX: Record<StoreName, string> = { items: "createdAt", detailProjects: "updatedAt", detailSummaries: "updatedAt" };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        db.createObjectStore(name, { keyPath: "id" }).createIndex(TIME_INDEX[name], TIME_INDEX[name]);
      }
    };
    req.onsuccess = () => {
      // 다른 탭이 새 버전으로 업그레이드하면 연결을 닫아 막지 않게 한다
      req.result.onversionchange = () => {
        req.result.close();
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** 여러 스토어를 한 트랜잭션으로 묶어 작업하고, 커밋되면 resolve. 쓰기 후 changedEvent를 window에 알린다 */
export async function withTx<T>(stores: StoreName[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => T, changedEvent?: string): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const value = run(tx);
    tx.oncomplete = () => {
      if (changedEvent) window.dispatchEvent(new Event(changedEvent));
      resolve(value);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const withStore = <T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => T, changedEvent?: string) =>
  withTx([store], mode, (tx) => run(tx.objectStore(store)), changedEvent);

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
