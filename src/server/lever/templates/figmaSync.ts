import 'server-only';
import pLimit from 'p-limit';
import { Converter } from '@/server/figma-to-konva/converters/Converter';
import { templateImagePath } from '../assets';
import { hasBakedTemplatePhotos } from '../frames/photoSlots';
import { walk, type FrameNode } from '../frames/tree';
import { ApiError, badRequest } from '../http';
import { getFigmaConfig, updateSettings } from '../settings';
import { loadFile, saveFile } from '../storage';
import { replaceFigmaTemplates, setBuiltinStatus, type SyncedTemplate } from './repo';

/**
 * Figma → 템플릿 동기화
 *
 * - 여러 파일을 우선순위대로 합치고, 이름·크기·구조가 같은 중복은 앞선 파일만 남긴다.
 * - 연출·사진·커버·에셋·풀페이지 복제본은 제외한다.
 */
const API = 'https://api.figma.com/v1';
const NODE_BATCH = 15;
/** Tier1(Dev) 약 10/분 → 배치 사이 대기 */
const BATCH_GAP_MS = 7_000;
const download = pLimit(4);

const SKIP_PAGE =
  /연출|스타일|mood|레퍼런스|참고\s*컷|이미지\s*모음|photo\s*ref|cover|changelog|에셋|배너|제안서|간판|로고|셀팜|교육|강의|^---+$/i;
const SKIP_SECTION = /^(0000|_|썸네일|컴포넌트|아이콘)/i;
const SKIP_FRAME_NAME = /^(image|no-?bg|사진|img)(\s|$)/i;
const SKIP_AI_IMAGE = /^ai\s*image/i;
const LOOSE_FRAME_NAME = /^Frame(\s|$|\d)/i;

export const isDetailTemplateSize = (width: number, height: number) =>
  width >= 700 && width <= 1100 && height >= 900;

interface SyncOptions {
  token?: string;
  fileKey?: string;
  /** 여러 파일 URL/키 (있으면 이 목록으로 병합 동기화) */
  fileKeys?: string[];
  /** true면 FIGMA_FILE_PLANS 전부 (우선순위·중복 제거) */
  syncAll?: boolean;
  /** true면 기존 figma 템플릿을 지우지 않고 합친 뒤 중복 제거 */
  merge?: boolean;
  hideBuiltin?: boolean;
}

interface FilePlan {
  key: string;
  label: string;
  /** 이 페이지만 */
  pageInclude?: RegExp;
  /** 이 섹션만 (있으면 섹션 밖 프레임은 안 가져옴) */
  sectionInclude?: RegExp;
  /** 추가 페이지 제외 */
  pageExclude?: RegExp;
}

/**
 * 가져올 파일 우선순위 (앞일수록 중복 시 남김)
 * 풀팩·교육·보너스 Designbase 복제는 계획에서 빼거나 페이지 필터로 제외
 */
export const FIGMA_FILE_PLANS: FilePlan[] = [
  {
    key: 'X9koUM7GpPQyjlaAxMy9WI',
    label: '윙스비즈 농수산물',
    pageInclude: /농수산물/,
    sectionInclude: /^(과일|수산물|농산물)$/,
  },
  {
    key: '1PrM7h1srg0KUimJOdfwuI',
    label: '윙스 섹션별',
    pageInclude: /^(섹션별 템플릿|기타모음)$/,
  },
  {
    key: 'gttLY8bg1xPx67KHokjzbY',
    label: '무한가치',
    pageExclude: /연출|개발자용/,
  },
  {
    key: 'qRgZMZUICCAmxd4B1v0ag1',
    label: 'Designbase TypeB',
    pageInclude: /템플릿/,
    pageExclude: /배너|에셋|cover|changelog|기타/i,
  },
  {
    key: 'h5NFoLWMVeKDimqohEectK',
    label: '래피드 섹션',
    pageInclude: /^상세페이지섹션$/,
  },
  // uKkE6159vGxm829y9qmnsH 풀팩 = 래피드/윙스 샘플과 동일 → 제외
];

export const parseFileKey = (input: string) =>
  /figma\.com\/(?:file|design|proto)\/([\w-]+)/.exec(input)?.[1] ?? input.trim();

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function figmaGet<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': token }, cache: 'no-store' });
  if (res.ok) return (await res.json()) as T;
  if (res.status === 429 && attempt < 5) {
    const wait = Math.min(Number(res.headers.get('retry-after') ?? 30) * 1000, 60_000);
    await sleep(wait || 15_000);
    return figmaGet(token, path, attempt + 1);
  }
  const reason =
    res.status === 403
      ? 'Figma 토큰이 올바르지 않거나 이 파일에 접근 권한이 없습니다.'
      : res.status === 404
        ? 'Figma 파일을 찾을 수 없습니다. 파일 키(또는 URL)를 확인해주세요.'
        : res.status === 429
          ? 'Figma API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
          : `Figma API 오류 (${res.status})`;
  throw new ApiError(res.status === 429 ? 429 : 400, reason);
}

const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE']);
const isSkipped = (name: string) => name.trim().startsWith('_');

export function parseSortKey(part2: string, fallback: number) {
  const match = /^\s*(\d+)(?:\s*[-.]\s*(\d+))?/.exec(part2);
  return match ? Number(match[1]) * 100 + Number(match[2] ?? 0) : fallback;
}

interface FigmaNodeLite {
  id: string;
  name: string;
  type: string;
  children?: FigmaNodeLite[];
}

interface TemplateTarget {
  id: string;
  name: string;
  part1: string;
  part2: string;
  part2SortKey: number;
}

export function part2FromTemplateName(name: string, fallback: string) {
  const slash = name.split('/');
  if (slash.length > 1) return slash[0].trim() || fallback;
  const base = name.replace(/\s*\*+\s*$/, '').trim();
  const numbered = /^(.*?)(?:\s*[-_]?\s*\d+)\s*$/.exec(base);
  const group = (numbered?.[1] ?? base).trim();
  if (!group || LOOSE_FRAME_NAME.test(group) || group.length < 2) return fallback;
  return group;
}

export function isUsableTemplateName(name: string) {
  const n = name.trim();
  if (!n || isSkipped(n)) return false;
  if (SKIP_FRAME_NAME.test(n) || SKIP_AI_IMAGE.test(n) || LOOSE_FRAME_NAME.test(n)) return false;
  if (/^p\d+$/i.test(n)) return false; // 교육용 p1, p2…
  return true;
}

/** 이름·크기로 보는 중복 키 (파일 달라도 같은 템플릿이면 같음) */
export function templateDedupeKey(item: { name: string; part2: string; frame: FrameNode }) {
  const name = item.name
    .replace(/\s*\*+\s*$/, '')
    .replace(/\s*\d+\s*$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const part2 = item.part2.replace(/\s+/g, '').toLowerCase();
  const w = Math.round((Number(item.frame.width) || 0) / 20) * 20;
  const h = Math.round((Number(item.frame.height) || 0) / 50) * 50;
  let texts = 0;
  let images = 0;
  for (const n of walk(item.frame)) {
    if (n.type === 'text' && n.text?.trim()) texts += 1;
    if (n.type === 'image' || n.figmaImageRef || n.name === '_image') images += 1;
  }
  return `${part2}|${name}|${w}x${h}|t${texts}|i${images}`;
}

export function findTargets(document: FigmaNodeLite, plan?: Pick<FilePlan, 'pageInclude' | 'pageExclude' | 'sectionInclude'>): TemplateTarget[] {
  const targets: TemplateTarget[] = [];
  const seen = new Set<string>();
  let order = 0;

  const add = (node: FigmaNodeLite, part1: string, part2: string, name = node.name) => {
    if (!isUsableTemplateName(name) || seen.has(node.id)) return;
    seen.add(node.id);
    order += 1;
    const part2Name = part2.trim() || part1;
    targets.push({
      id: node.id,
      name: name.trim(),
      part1,
      part2: part2Name,
      part2SortKey: parseSortKey(part2Name, 10_000 + order),
    });
  };

  /** allowed=true 이면 sectionInclude를 이미 통과한 하위 섹션 (중첩 섹션까지 들어감) */
  const walkSection = (section: FigmaNodeLite, pageName: string, part2: string, allowed = false) => {
    if (SKIP_SECTION.test(section.name.trim())) return;
    const ok = allowed || !plan?.sectionInclude || plan.sectionInclude.test(section.name.trim());
    if (!ok) return;
    for (const child of section.children ?? []) {
      if (isSkipped(child.name)) continue;
      if (child.type === 'SECTION') walkSection(child, pageName, child.name.trim() || part2, true);
      else if (FRAME_TYPES.has(child.type)) add(child, pageName, part2, child.name);
    }
  };

  for (const page of document.children ?? []) {
    if (page.type !== 'CANVAS' || isSkipped(page.name) || SKIP_PAGE.test(page.name)) continue;
    if (plan?.pageInclude && !plan.pageInclude.test(page.name.trim())) continue;
    if (plan?.pageExclude && plan.pageExclude.test(page.name)) continue;

    for (const node of page.children ?? []) {
      if (isSkipped(node.name)) continue;
      if (node.type === 'SECTION') {
        walkSection(node, page.name, node.name.trim());
      } else if (!plan?.sectionInclude && FRAME_TYPES.has(node.type) && isUsableTemplateName(node.name)) {
        const [prefix, ...rest] = node.name.split('/');
        if (rest.length) add(node, page.name, prefix.trim(), rest.join('/').trim());
        else add(node, page.name, part2FromTemplateName(node.name, page.name));
      }
    }
  }
  return targets;
}

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function fetchBuffer(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadImageFills(token: string, fileKey: string, frames: FrameNode[], errors: string[]) {
  const refs = new Set<string>();
  for (const frame of frames) for (const node of walk(frame)) if (node.figmaImageRef) refs.add(node.figmaImageRef);
  const missing: string[] = [];
  for (const ref of refs) if (!(await loadFile(templateImagePath(ref)))) missing.push(ref);
  if (!missing.length) return;

  const { meta } = await figmaGet<{ meta: { images: Record<string, string> } }>(token, `/files/${fileKey}/images`);
  await Promise.all(
    missing.map((ref) =>
      download(async () => {
        const url = meta.images[ref];
        if (!url) return errors.push(`이미지 ${ref}의 URL을 받지 못했습니다.`);
        try {
          await saveFile(templateImagePath(ref), await fetchBuffer(url));
        } catch (err) {
          errors.push(`이미지 ${ref}: ${(err as Error).message}`);
        }
      }),
    ),
  );
}

async function renderThumbnails(token: string, fileKey: string, ids: string[], errors: string[]) {
  const thumbnails = new Map<string, Buffer>();
  for (const [i, batch] of chunk(ids, NODE_BATCH).entries()) {
    if (i) await sleep(BATCH_GAP_MS);
    const { images } = await figmaGet<{ images: Record<string, string | null> }>(
      token,
      `/images/${fileKey}?ids=${encodeURIComponent(batch.join(','))}&format=png&scale=0.5`,
    );
    await Promise.all(
      batch.map((id) =>
        download(async () => {
          if (!images[id]) return;
          try {
            thumbnails.set(id, await fetchBuffer(images[id]!));
          } catch (err) {
            errors.push(`썸네일 ${id}: ${(err as Error).message}`);
          }
        }),
      ),
    );
  }
  return thumbnails;
}

async function syncOneFile(
  token: string,
  plan: FilePlan,
  errors: string[],
  options: { skipThumbnails?: boolean } = {},
): Promise<{ label: string; items: SyncedTemplate[]; skippedDupHint: number }> {
  const fileKey = plan.key;
  const structure = await figmaGet<{ document: FigmaNodeLite; name?: string }>(token, `/files/${fileKey}?depth=4`);
  const targets = findTargets(structure.document, plan);
  if (!targets.length) {
    errors.push(`${plan.label}: 가져올 상세 프레임이 없습니다.`);
    return { label: plan.label, items: [], skippedDupHint: 0 };
  }

  const converter = new Converter();
  const converted = new Map<string, FrameNode>();
  for (const [i, batch] of chunk(targets, NODE_BATCH).entries()) {
    if (i) await sleep(BATCH_GAP_MS);
    const { nodes } = await figmaGet<{ nodes: Record<string, { document: unknown } | null> }>(
      token,
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(batch.map((t) => t.id).join(','))}&geometry=paths`,
    );
    for (const target of batch) {
      const document = nodes[target.id]?.document;
      if (!document) {
        errors.push(`${plan.label}/${target.name}: 노드를 불러오지 못했습니다.`);
        continue;
      }
      try {
        const frame = converter.convertTopLevelFrame(document) as unknown as FrameNode;
        const width = Number(frame.width) || 0;
        const height = Number(frame.height) || 0;
        if (!isDetailTemplateSize(width, height)) continue;
        if (hasBakedTemplatePhotos(frame)) continue;
        converted.set(target.id, frame);
      } catch (err) {
        errors.push(`${plan.label}/${target.name}: 변환 실패 (${(err as Error).message})`);
      }
    }
  }

  const frames = [...converted.values()];
  if (frames.length) {
    await downloadImageFills(token, fileKey, frames, errors);
  }
  // 썸네일은 API 한도를 많이 쓰므로 대량 동기화에선 생략 가능(에디터는 프레임으로 동작)
  const thumbnails =
    frames.length && !options.skipThumbnails
      ? await renderThumbnails(token, fileKey, [...converted.keys()], errors)
      : new Map<string, Buffer>();

  const items: SyncedTemplate[] = targets
    .filter((t) => converted.has(t.id))
    .map((t) => ({
      // 파일마다 노드 id가 겹칠 수 있어 파일키를 붙인다
      figmaId: `${fileKey}/${t.id}`,
      name: t.name,
      part1: `${plan.label} · ${t.part1}`,
      part2: t.part2,
      part2SortKey: t.part2SortKey,
      frame: converted.get(t.id)!,
      thumbnail: thumbnails.get(t.id),
    }));

  return { label: plan.label, items, skippedDupHint: targets.length - items.length };
}

function dedupeTemplates(items: SyncedTemplate[]) {
  const kept: SyncedTemplate[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const item of items) {
    const key = templateDedupeKey(item);
    if (seen.has(key)) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    kept.push(item);
  }
  return { kept, dropped };
}

function resolvePlans(options: SyncOptions, fallbackFileKey?: string): FilePlan[] {
  if (options.syncAll) return FIGMA_FILE_PLANS;
  if (options.fileKeys?.length) {
    const keys = options.fileKeys.map(parseFileKey);
    return keys.map((key) => FIGMA_FILE_PLANS.find((p) => p.key === key) ?? { key, label: key.slice(0, 8) });
  }
  const single = options.fileKey || fallbackFileKey;
  if (single) {
    const key = parseFileKey(single);
    return [FIGMA_FILE_PLANS.find((p) => p.key === key) ?? { key, label: key.slice(0, 8) }];
  }
  return FIGMA_FILE_PLANS;
}

export async function syncFigmaTemplates(options: SyncOptions = {}) {
  if (options.token || options.fileKey) {
    await updateSettings((s) => ({
      ...s,
      figma: {
        token: options.token || s.figma?.token,
        fileKey: options.fileKey ? parseFileKey(options.fileKey) : s.figma?.fileKey,
      },
    }));
  }
  const config = await getFigmaConfig();
  if (!config.token) throw badRequest('Figma 개인 액세스 토큰을 입력해주세요.');

  const plans = resolvePlans(options, config.fileKey);
  if (!plans.length) throw badRequest('동기화할 Figma 파일이 없습니다.');

  const errors: string[] = [];
  let accepted: SyncedTemplate[] = [];
  const perFile: { label: string; count: number; saved: number }[] = [];
  let dropped = 0;
  const multi = plans.length > 1 || Boolean(options.syncAll);

  for (const [index, plan] of plans.entries()) {
    if (index) await sleep(BATCH_GAP_MS);
    const { label, items } = await syncOneFile(config.token!, plan, errors, {
      skipThumbnails: multi,
    });
    const { kept, dropped: d } = dedupeTemplates([...accepted, ...items]);
    dropped += d;
    const newly = items.filter((item) => kept.some((k) => k.figmaId === item.figmaId));
    accepted = kept;
    // 파일마다 누적본 전체 저장 → 긴 동기화 중 끊겨도 앞 파일은 남음
    await replaceFigmaTemplates(accepted, { replaceAll: true });
    perFile.push({ label, count: items.length, saved: newly.length });
  }

  if (options.hideBuiltin !== undefined) await setBuiltinStatus(options.hideBuiltin ? 'inactive' : 'active');

  const syncedCount = accepted.length;
  const summary = perFile.map((f) => `${f.label} ${f.saved}/${f.count}`).join(', ');
  return {
    message: `상세 템플릿 ${syncedCount}개 저장 (파일별 채택/후보: ${summary} · 중복 제거 ${dropped}개)`,
    syncedCount,
    droppedDuplicates: dropped,
    perFile,
    errors,
  };
}

export async function getFigmaStatus() {
  const config = await getFigmaConfig();
  return {
    hasToken: Boolean(config.token),
    fileKey: config.fileKey ?? '',
    plannedFiles: FIGMA_FILE_PLANS.map((p) => ({ key: p.key, label: p.label })),
  };
}
