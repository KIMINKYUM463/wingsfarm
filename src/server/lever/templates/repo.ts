import 'server-only';
import type { TemplateListData } from '@/features/editor/types';
import {
  TEMPLATE_START_LENGTH_LABEL,
  part2sForLength,
  templateCountFor,
  type TemplateStartLength,
} from '@/shared/constants/templateStart';
import { CATEGORIES, findCategory } from '../catalog/categories';
import { renderFrameSvg } from '../frames/svgRender';
import { hasBakedTemplatePhotos } from '../frames/photoSlots';
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
import { withAgriClosing } from './agriClosing';
import { DRAFT_PART2_ORDER, normalizePart2, part2SortKeyOf } from './part2Taxonomy';

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
  /** 상품 사진 자리가 아닌 큰 사진이 박혀 있으면 초안·교체에 쓰지 않는다 */
  hasBakedPhotos?: boolean;
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
      hasBakedPhotos: hasBakedTemplatePhotos(frame),
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

async function withBakedPhotoFlags(templates: TemplateRecord[]) {
  return Promise.all(
    templates.map(async (template) => {
      if (template.hasBakedPhotos !== undefined) return template;
      const frame = await readJson<FrameNode | null>(framePath(template.id), null);
      return { ...template, hasBakedPhotos: frame ? hasBakedTemplatePhotos(frame) : false };
    }),
  );
}

/** 읽기 전용 (기본 템플릿을 심어야 할 때만 쓰기) */
export async function loadTemplates() {
  const index = await readJson<TemplateIndex>(INDEX, EMPTY_INDEX);
  if (index.builtinVersion === BUILTIN_VERSION && index.templates.every((t) => t.hasBakedPhotos !== undefined)) {
    return index.templates;
  }
  return updateIndex(
    async (current) => ({ ...current, templates: await withBakedPhotoFlags(current.templates) }),
    (current) => current.templates,
  );
}

export async function getTemplate(id: string) {
  const record = (await loadTemplates()).find((t) => t.id === id);
  if (!record) throw notFound('템플릿을 찾을 수 없습니다.');
  return record;
}

const isUsable = (template: TemplateRecord, categoryId?: string | null) =>
  template.status === 'active' &&
  !template.hasBakedPhotos &&
  !(categoryId && template.excludedCategoryIds.includes(categoryId));

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

const shuffled = <T,>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * 구성(part2)마다 고르되, 한 페이지 안에서는 같은 디자인 스타일을 우선한다
 * 긴·더 긴 구성은 templateCountFor만큼 서로 다른 템플릿을 같은 구성 자리에 이어 붙인다
 * (Figma 참고용 구성·전체 페이지는 초안에서 제외 — 짧은·긴은 DRAFT_PART2_ORDER, 더 긴은 EXTRA_DRAFT_PART2S)
 */
export function pickDraftTemplatesRandom(
  usable: TemplateRecord[],
  length: TemplateStartLength = 'short',
  preferredStyle?: string,
  categoryId?: string | null,
) {
  const styles = [...new Set(usable.map(styleGroupOf))];
  const group = preferredStyle && styles.includes(preferredStyle) ? preferredStyle : randomOf(styles);
  const picked = part2sForLength(length, DRAFT_PART2_ORDER).flatMap((part2) => {
    const candidates = usable.filter((t) => t.part2 === part2);
    if (!candidates.length) return [];
    const count = templateCountFor(part2, length);
    const sameStyle = candidates.filter((t) => styleGroupOf(t) === group);
    const others = candidates.filter((t) => styleGroupOf(t) !== group);
    return [...shuffled(sameStyle), ...shuffled(others)].slice(0, count);
  });
  return withAgriClosing(usable, picked, categoryId, group, styleGroupOf);
}

/** 구성별 후보 요약 (AI 프롬프트용, 너무 길지 않게 자름) */
function candidateSummaries(usable: TemplateRecord[], part2: string, limit = 14) {
  const pool = shuffled(usable.filter((t) => t.part2 === part2));
  const builtin = pool.filter((t) => t.source === 'builtin').slice(0, 5);
  const figma = pool.filter((t) => t.source === 'figma').slice(0, 9);
  const mixed = [...builtin, ...figma];
  const rest = pool.filter((t) => !mixed.includes(t));
  return [...mixed, ...rest].slice(0, limit).map((t) => ({
    id: t.id,
    name: t.name.slice(0, 48),
    source: t.source,
    style: styleGroupOf(t),
  }));
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('template pick timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * 상품명·카테고리에 어울리는 템플릿을 AI가 고른다. 실패 시 스타일 통일 랜덤으로 폴백.
 */
export async function pickDraftTemplates(
  categoryId: string | null,
  length: TemplateStartLength = 'short',
  productName = '',
) {
  const usable = (await loadTemplates()).filter((t) => isUsable(t, categoryId)).sort(byOrder);
  const byId = new Map(usable.map((t) => [t.id, t]));
  const part2s = part2sForLength(length, DRAFT_PART2_ORDER);
  const needed = part2s.map((part2) => ({
    part2,
    count: templateCountFor(part2, length),
    options: candidateSummaries(usable, part2),
  })).filter((row) => row.options.length > 0);

  if (!productName.trim() || !needed.length) {
    return pickDraftTemplatesRandom(usable, length, undefined, categoryId);
  }

  try {
    const { requireGemini } = await import('../gemini');
    const gemini = await requireGemini();
    const categoryName = findCategory(categoryId)?.name ?? categoryId ?? '';
    const result = await withTimeout(
      gemini.generateJson<{ preferredStyle?: string; picks?: { part2?: string; templateIds?: string[] }[] }>(
        `너는 한국 이커머스 상세페이지 디자이너다. 상품에 어울리는 템플릿을 구성(part2)마다 골라라.

[상품] ${productName.slice(0, 80)}
[카테고리] ${categoryName}
[길이] ${TEMPLATE_START_LENGTH_LABEL[length]}

[구성별 후보] (이 목록의 id만 사용)
${needed
  .map(
    (row) =>
      `## ${row.part2} (정확히 ${row.count}개)
${row.options.map((o) => `- ${o.id} | ${o.name} | ${o.source} | style:${o.style}`).join('\n')}`,
  )
  .join('\n\n')}

규칙:
- 각 part2마다 templateIds를 정확히 필요한 개수만큼, 후보에 있는 id만.
- 페이지 전체 톤이 맞도록 preferredStyle(style 값 중 하나)을 정하고, 가능하면 그 style 템플릿을 우선.
- 농수산·식품이면 내추럴·산지 느낌(classic/natural 계열 이름·figma)을, 선물·고급이면 premium 느낌을 선호.
- 같은 템플릿 id를 두 번 쓰지 말 것.
JSON: {"preferredStyle":"classic","picks":[{"part2":"메인 비주얼","templateIds":["..."]},{"part2":"문제 제기","templateIds":["..."]}]}`,
      ),
      12_000,
    );

    const preferredStyle = typeof result.preferredStyle === 'string' ? result.preferredStyle : undefined;
    const picked: TemplateRecord[] = [];
    const used = new Set<string>();
    for (const row of needed) {
      const aiRow = (result.picks ?? []).find((p) => p.part2 === row.part2);
      const ids = Array.isArray(aiRow?.templateIds) ? aiRow!.templateIds!.map(String) : [];
      for (const id of ids) {
        if (picked.filter((p) => p.part2 === row.part2).length >= row.count) break;
        const t = byId.get(id);
        if (!t || used.has(t.id) || t.part2 !== row.part2) continue;
        used.add(t.id);
        picked.push(t);
      }
      // 부족분은 같은 스타일 우선으로 채움
      const pool = shuffled(usable.filter((t) => t.part2 === row.part2 && !used.has(t.id)));
      const same = preferredStyle ? pool.filter((t) => styleGroupOf(t) === preferredStyle) : pool;
      for (const t of [...same, ...pool.filter((x) => !same.includes(x))]) {
        if (picked.filter((p) => p.part2 === row.part2).length >= row.count) break;
        used.add(t.id);
        picked.push(t);
      }
    }

    const ordered = part2s.flatMap((part2) => picked.filter((t) => t.part2 === part2));
    if (ordered.length >= Math.min(5, needed.length)) {
      return withAgriClosing(usable, ordered, categoryId, preferredStyle, styleGroupOf);
    }
  } catch (err) {
    console.warn('[lever] pickDraftTemplates AI fallback', err instanceof Error ? err.message : err);
  }

  return pickDraftTemplatesRandom(usable, length, undefined, categoryId);
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
      hasBakedPhotos: Boolean(t.hasBakedPhotos),
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

/**
 * Figma 동기화 결과 반영
 * - replaceAll true(기본): figma 템플릿을 synced로 통째 교체
 * - replaceAll false: synced만 upsert, 다른 figma 템플릿은 유지
 */
export function replaceFigmaTemplates(synced: SyncedTemplate[], options: { replaceAll?: boolean } = {}) {
  const replaceAll = options.replaceAll !== false;
  return updateIndex(
    async (index) => {
      const previous = new Map(index.templates.filter((t) => t.source === 'figma').map((t) => [t.figmaId!, t]));
      const records: TemplateRecord[] = [];
      for (const item of synced) {
        const frame = sanitizeTemplateFrame(item.frame);
        if (hasBakedTemplatePhotos(frame)) continue;
        const old = previous.get(item.figmaId);
        const id = old?.id ?? `figma-${item.figmaId.replace(/[^\w-]/g, '-')}`;
        const width = Number(frame.width) || 860;
        const height = Number(frame.height) || 1000;
        const part2 = normalizePart2({ part2: item.part2, name: item.name, height });
        const record: TemplateRecord = {
          id,
          figmaId: item.figmaId,
          name: item.name,
          part1: item.part1,
          part2,
          part2SortKey: part2SortKeyOf(part2),
          status: old?.status ?? 'active',
          source: 'figma',
          thumbnailPath: thumbnailPathOf(id, item.thumbnail ? 'png' : 'svg'),
          imageCount: countImageSlots(frame),
          hasBakedPhotos: false,
          excludedCategoryIds: old?.excludedCategoryIds ?? [],
          width,
          height,
          createdAt: old?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        };
        await writeTemplate(record, frame, item.thumbnail);
        records.push(record);
        previous.delete(item.figmaId);
      }
      if (replaceAll) {
        for (const removed of previous.values()) await removeData(framePath(removed.id));
        return { ...index, templates: [...index.templates.filter((t) => t.source !== 'figma'), ...records] };
      }
      const upsertIds = new Set(records.map((r) => r.figmaId!));
      return {
        ...index,
        templates: [...index.templates.filter((t) => t.source !== 'figma' || !upsertIds.has(t.figmaId!)), ...records],
      };
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
