/**
 * AI 결과 보관함 — 이미지(data URL)가 커서 localStorage(약 5MB) 대신 IndexedDB에 저장한다.
 * 브라우저 전용이며, 브라우저 데이터를 지우면 함께 사라진다.
 */

import { STORES, getAll, withStore } from "@/lib/idb";

export type ArchiveKind = "marketing" | "thumbnail" | "detail" | "tags" | "titles";

export const ARCHIVE_KIND_LABEL: Record<ArchiveKind, string> = {
  marketing: "마케팅",
  thumbnail: "썸네일",
  detail: "상세페이지",
  tags: "검색 태그",
  titles: "상품명",
};

export interface ArchiveItem {
  id: string;
  kind: ArchiveKind;
  /** 예: "블로그 글", "썸네일 6장" */
  title: string;
  product: string;
  createdAt: number;
  /** 복사용 전체 텍스트 */
  text: string;
  /** 이미지 키(장 번호 등) → data URL */
  images: Record<string, string>;
}

const MAX_ITEMS = 200;
export const ARCHIVE_CHANGED = "wingsfarm-archive-changed";

const write = (run: (store: IDBObjectStore) => void) => withStore(STORES.archive, "readwrite", run, ARCHIVE_CHANGED);

export async function listArchive(): Promise<ArchiveItem[]> {
  return (await getAll<ArchiveItem>(STORES.archive)).sort((a, b) => b.createdAt - a.createdAt);
}

/** 새 결과를 저장하고 id를 돌려준다. 오래된 항목은 MAX_ITEMS를 넘지 않게 정리 */
export async function saveArchive(item: Omit<ArchiveItem, "id" | "createdAt" | "images"> & { images?: Record<string, string> }) {
  const record: ArchiveItem = { ...item, id: crypto.randomUUID(), createdAt: Date.now(), images: item.images ?? {} };
  await write((store) => {
    store.put(record);
    const countReq = store.count();
    countReq.onsuccess = () => {
      let excess = countReq.result - MAX_ITEMS;
      if (excess <= 0) return;
      // createdAt 오름차순 = 오래된 것부터 삭제
      const cursorReq = store.index("createdAt").openKeyCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || excess <= 0) return;
        store.delete(cursor.primaryKey);
        excess -= 1;
        cursor.continue();
      };
    };
  });
  return record.id;
}

/** 나중에 생성된 이미지를 기존 항목에 추가 (같은 트랜잭션에서 읽고 써서 동시 저장에도 안전) */
export function patchArchiveImage(id: string, key: string | number, src: string) {
  return write((store) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as ArchiveItem | undefined;
      if (item) store.put({ ...item, images: { ...item.images, [key]: src } });
    };
  });
}

export const removeArchive = (id: string) => write((store) => void store.delete(id));
export const clearArchive = () => write((store) => void store.clear());

/** 저장 실패(용량 부족·사생활 모드 등)가 본 작업을 막지 않도록 조용히 처리 */
export async function trySaveArchive(item: Parameters<typeof saveArchive>[0]) {
  try {
    return await saveArchive(item);
  } catch (err) {
    console.warn("[archive] 저장 실패", err);
    return null;
  }
}

export async function tryPatchArchiveImage(id: string | null, key: string | number, src: string) {
  if (!id) return;
  try {
    await patchArchiveImage(id, key, src);
  } catch (err) {
    console.warn("[archive] 이미지 저장 실패", err);
  }
}
