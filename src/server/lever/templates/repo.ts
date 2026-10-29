import 'server-only';
import type { TemplateListData } from '@/features/editor/types';
import { CATEGORIES } from '../catalog/categories';
import { renderFrameSvg } from '../frames/svgRender';
import {
  cloneWithNewIds,
  countImageSlots,
  materializeTemplateImages,
  sanitizeTemplateFrame,
  type FrameNode,
} from '../frames/tree';
import { notFound } from '../http';
import { publicUrl, saveFile } from '../storage';
import { nowIso, readJson, removeData, withLock, writeJson } from '../store';
import { BUILTIN_VERSION, buildBuiltinTemplates } from './builtin';

export interface TemplateRecord {
  id: string;
  figmaId: string | null;
  name: string;
  part1: string;
  part2: string;
  part2SortKey: number;
  status: 'active' | 'inactive';
  source: 'builtin' | 'figma';
  thumbnailPath: string;
  imageCount: number;
  excludedCategoryIds: string[];
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateIndex {
  builtinVersion: number;
  templates: TemplateRecord[];
}

const INDEX = 'templates/index.json';
const framePath = (id: string) => `templates/frames/${id}.json`;
export const thumbnailPathOf = (id: string, ext: 'svg' | 'png') => `templates/thumbs/${id}.${ext}`;

const byOrder = (a: TemplateRecord, b: TemplateRecord) =>
  a.part2SortKey - b.part2SortKey || a.part2.localeCompare(b.part2) || a.name.localeCompare(b.name);

/** 템플릿 하나 저장 (프레임 JSON + 썸네일) */
async function writeTemplate(record: TemplateRecord, frame: FrameNode, thumbnail?: Buffer) {
  await writeJson(framePath(record.id), frame);
  await saveFile(record.thumbnailPath, thumbnail ?? Buffer.from(renderFrameSvg(frame)));
}

/** 기본 템플릿이 없거나 버전이 바뀌었으면 다시 심는다 (Figma 템플릿·카테고리 제외 설정은 유지) */
async function seedBuiltins(index: TemplateIndex): Promise<TemplateIndex> {
  const previous = new Map(index.templates.map((t) => [t.id, t]));
  const builtins: TemplateRecord[] = [];
  for (const seed of buildBuiltinTemplates()) {
    const id = `builtin-${seed.slug}`;
    const frame = sanitizeTemplateFrame(seed.frame);
    const record: TemplateRecord = {
      id,
      figmaId: null,
      name: seed.frame.name ?? seed.part2,
      part1: seed.part1,
      part2: seed.part2,
      part2SortKey: seed.part2SortKey,
      status: previous.get(id)?.status ?? 'active',
      source: 'builtin',
      thumbnailPath: thumbnailPathOf(id, 'svg'),
      imageCount: countImageSlots(frame),
      excludedCategoryIds: previous.get(id)?.excludedCategoryIds ?? [],
      width: Number(frame.width) || 860,
      height: Number(frame.height) || 1000,
      createdAt: previous.get(id)?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    await writeTemplate(record, frame);
    builtins.push(record);
  }
  return {
    builtinVersion: BUILTIN_VERSION,
    templates: [...builtins, ...index.templates.filter((t) => t.source !== 'builtin')],
  };
}

const EMPTY_INDEX: TemplateIndex = { builtinVersion: 0, templates: [] };

const updateIndex = <R>(mutate: (index: TemplateIndex) => Promise<TemplateIndex> | TemplateIndex, pick: (index: TemplateIndex) => R) =>
  withLock(INDEX, async () => {
    let index = await readJson<TemplateIndex>(INDEX, EMPTY_INDEX);
    if (index.builtinVersion !== BUILTIN_VERSION) index = await seedBuiltins(index);
    index = await mutate(index);
    await writeJson(INDEX, index);
    return pick(index);
  });

/** 읽기 전용 (기본 템플릿을 심어야 할 때만 쓰기) */
export async function loadTemplates() {
  const index = await readJson<TemplateIndex>(INDEX, EMPTY_INDEX);
  if (index.builtinVersion === BUILTIN_VERSION) return index.templates;
  return updateIndex((current) => current, (current) => current.templates);
}

export async function getTemplate(id: string) {
  const record = (await loadTemplates()).find((t) => t.id === id);
  if (!record) throw notFound('템플릿을 찾을 수 없습니다.');
  return record;
}

const isUsable = (template: TemplateRecord, categoryId?: string | null) =>
  template.status === 'active' && !(categoryId && template.excludedCategoryIds.includes(categoryId));

/** GET /templates (part2별 그룹) */
export async function listTemplateGroups(query: URLSearchParams): Promise<TemplateListData> {
  const categoryId = query.get('categoryId');
  const part2 = query.get('part2');
  const limit = Number(query.get('limitPerPart2')) || Infinity;

  const groups = new Map<string, TemplateRecord[]>();
  for (const template of (await loadTemplates()).filter((t) => isUsable(t, categoryId)).sort(byOrder)) {
    if (part2 && template.part2 !== part2) continue;
    groups.set(template.part2, [...(groups.get(template.part2) ?? []), template]);
  }

  return {
    groups: [...groups].map(([name, templates]) => ({
      part2: name,
      templates: templates.slice(0, part2 ? undefined : limit).map((t) => ({
        id: t.id,
        thumbnailUrl: publicUrl(t.thumbnailPath),
        previewUrl: publicUrl(t.thumbnailPath),
      })),
    })),
  };
}

const randomOf = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** part2 안에서 무작위 템플릿 (제외 목록이 전부면 제외 없이 다시 고름) */
export async function pickTemplate(part2: string, categoryId: string | null, excludeIds: string[] = []) {
  const candidates = (await loadTemplates()).filter((t) => t.part2 === part2 && isUsable(t, categoryId));
  if (!candidates.length) throw notFound(`'${part2}' 구성의 템플릿이 없습니다.`);
  const fresh = candidates.filter((t) => !excludeIds.includes(t.id));
  return randomOf(fresh.length ? fresh : candidates);
}

/** 초안 프로젝트 구성: part2마다 템플릿 1개씩, 정해진 순서대로 */
/** 디자인 스타일 템플릿(builtin-ds-{스타일}-…)은 스타일별로, 나머지는 기본 묶음으로 */
const styleGroupOf = (t: TemplateRecord) => /^builtin-ds-([a-z]+)-/.exec(t.id)?.[1] ?? 'classic';

/** 구성(part2)마다 하나씩 고르되, 한 페이지 안에서는 같은 디자인 스타일을 우선한다 */
export async function pickDraftTemplates(categoryId: string | null) {
  const usable = (await loadTemplates()).filter((t) => isUsable(t, categoryId)).sort(byOrder);
  const part2List = [...new Set(usable.map((t) => t.part2))];
  const group = randomOf([...new Set(usable.map(styleGroupOf))]);
  return part2List.map((part2) => {
    const candidates = usable.filter((t) => t.part2 === part2);
    const sameStyle = candidates.filter((t) => styleGroupOf(t) === group);
    return randomOf(sameStyle.length ? sameStyle : candidates);
  });
}

/** 템플릿 → 프로젝트 프레임 데이터 (새 id 발급 + 템플릿 이미지 연결) */
export async function instantiateTemplate(template: TemplateRecord, frameId: string) {
  const stored = await readJson<FrameNode | null>(framePath(template.id), null);
  if (!stored) throw notFound('템플릿 데이터가 없습니다. 템플릿 동기화를 다시 실행해주세요.');
  const frameData = materializeTemplateImages(cloneWithNewIds(stored, frameId));
  return {
    frameData,
    figmaId: template.figmaId,
    templateId: template.id,
    part1: template.part1,
    part2: template.part2,
    frameName: `${template.part1} - ${template.part2}`,
    width: template.width,
    height: template.height,
  };
}

// ===== 관리자 (템플릿 관리 화면) =====

export async function adminListTemplates(query: URLSearchParams) {
  const part2 = query.get('part2');
  const page = Math.max(Number(query.get('page')) || 1, 1);
  const pageSize = Math.max(Number(query.get('pageSize')) || 20, 1);
  const all = (await loadTemplates()).sort(byOrder);
  const filtered = part2 ? all.filter((t) => t.part2 === part2) : all;

  return {
    templates: filtered.slice((page - 1) * pageSize, page * pageSize).map((t) => ({
      id: t.id,
      figmaId: t.figmaId ?? undefined,
      name: t.name,
      part1: t.part1,
      part2: t.part2,
      part2SortKey: t.part2SortKey,
      status: t.status,
      thumbnailUrl: publicUrl(t.thumbnailPath),
      imageCount: t.imageCount,
      excludedCategoryIds: t.excludedCategoryIds,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    pagination: { page, pageSize, totalCount: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
    filters: { part2Options: [...new Set(all.map((t) => t.part2))] },
  };
}

export const adminCategories = () => ({
  categories: CATEGORIES.map((c, i) => ({ id: c.id, name: c.name, order: i + 1 })),
});

export function updateExcludedCategories(templateId: string, excludedCategoryIds: string[]) {
  const updatedAt = nowIso();
  return updateIndex(
    (index) => {
      if (!index.templates.some((t) => t.id === templateId)) throw notFound('템플릿을 찾을 수 없습니다.');
      return {
        ...index,
        templates: index.templates.map((t) => (t.id === templateId ? { ...t, excludedCategoryIds, updatedAt } : t)),
      };
    },
    () => ({ templateId, excludedCategoryIds, updatedAt }),
  );
}

export interface SyncedTemplate {
  figmaId: string;
  name: string;
  part1: string;
  part2: string;
  part2SortKey: number;
  frame: FrameNode;
  thumbnail?: Buffer;
}

/** Figma 동기화 결과 반영: figmaId 기준으로 갱신, 파일에서 사라진 템플릿은 삭제 */
export function replaceFigmaTemplates(synced: SyncedTemplate[]) {
  return updateIndex(
    async (index) => {
      const previous = new Map(index.templates.filter((t) => t.source === 'figma').map((t) => [t.figmaId, t]));
      const records: TemplateRecord[] = [];
      for (const item of synced) {
        const old = previous.get(item.figmaId);
        const id = old?.id ?? `figma-${item.figmaId.replace(/[^\w-]/g, '-')}`;
        const frame = sanitizeTemplateFrame(item.frame);
        const record: TemplateRecord = {
          id,
          figmaId: item.figmaId,
          name: item.name,
          part1: item.part1,
          part2: item.part2,
          part2SortKey: item.part2SortKey,
          status: old?.status ?? 'active',
          source: 'figma',
          thumbnailPath: thumbnailPathOf(id, item.thumbnail ? 'png' : 'svg'),
          imageCount: countImageSlots(frame),
          excludedCategoryIds: old?.excludedCategoryIds ?? [],
          width: Number(frame.width) || 860,
          height: Number(frame.height) || 1000,
          createdAt: old?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        };
        await writeTemplate(record, frame, item.thumbnail);
        records.push(record);
        previous.delete(item.figmaId);
      }
      for (const removed of previous.values()) await removeData(framePath(removed.id));
      return { ...index, templates: [...index.templates.filter((t) => t.source !== 'figma'), ...records] };
    },
    (index) => index.templates.filter((t) => t.source === 'figma').length,
  );
}

/** Figma 템플릿을 쓰는 동안 기본 템플릿을 끄거나 켠다 */
export function setBuiltinStatus(status: TemplateRecord['status']) {
  return updateIndex(
    (index) => ({
      ...index,
      templates: index.templates.map((t) => (t.source === 'builtin' ? { ...t, status } : t)),
    }),
    () => status,
  );
}
