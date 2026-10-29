/**
 * 상세페이지 프로젝트 저장소 (IndexedDB).
 * 본문(사진 포함)은 무거워서, 목록 화면은 작은 표지만 담은 요약 스토어를 따로 읽는다.
 */

import type { DetailProject } from "@/lib/detailPage";
import { STORES, getAll, getOne, withTx } from "@/lib/idb";

export const DETAIL_CHANGED = "wingsfarm-detail-changed";
const MAX_PROJECTS = 30;
const BOTH = [STORES.detailProjects, STORES.detailSummaries];

export interface DetailSummary {
  id: string;
  name: string;
  product: string;
  sectionCount: number;
  updatedAt: number;
  /** 작은 JPEG 표지 (없으면 빈 문자열) */
  cover: string;
}

export const listDetailSummaries = async () =>
  (await getAll<DetailSummary>(STORES.detailSummaries)).sort((a, b) => b.updatedAt - a.updatedAt);

export const getDetailProject = (id: string) => getOne<DetailProject>(STORES.detailProjects, id);

/** 저장하고, MAX_PROJECTS를 넘으면 가장 오래 손대지 않은 프로젝트부터 지운다 */
export function saveDetailProject(project: DetailProject, cover: string) {
  const summary: DetailSummary = {
    id: project.id,
    name: project.name,
    product: project.product,
    sectionCount: project.sections.length,
    updatedAt: project.updatedAt,
    cover,
  };
  return withTx(
    BOTH,
    "readwrite",
    (tx) => {
      tx.objectStore(STORES.detailProjects).put(project);
      const summaries = tx.objectStore(STORES.detailSummaries);
      summaries.put(summary);
      const countReq = summaries.count();
      countReq.onsuccess = () => {
        let excess = countReq.result - MAX_PROJECTS;
        if (excess <= 0) return;
        const cursorReq = summaries.index("updatedAt").openKeyCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || excess <= 0) return;
          summaries.delete(cursor.primaryKey);
          tx.objectStore(STORES.detailProjects).delete(cursor.primaryKey);
          excess -= 1;
          cursor.continue();
        };
      };
    },
    DETAIL_CHANGED,
  );
}

export const removeDetailProject = (id: string) =>
  withTx(BOTH, "readwrite", (tx) => BOTH.forEach((name) => tx.objectStore(name).delete(id)), DETAIL_CHANGED);
