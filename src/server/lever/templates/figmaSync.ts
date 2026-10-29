import 'server-only';
import pLimit from 'p-limit';
import { Converter } from '@/server/figma-to-konva/converters/Converter';
import { templateImagePath } from '../assets';
import { walk, type FrameNode } from '../frames/tree';
import { ApiError, badRequest } from '../http';
import { getFigmaConfig, updateSettings } from '../settings';
import { loadFile, saveFile } from '../storage';
import { replaceFigmaTemplates, setBuiltinStatus, type SyncedTemplate } from './repo';

/**
 * Figma → 템플릿 동기화
 *
 * ## Figma 파일 구성 규칙
 * - 페이지 = part1 (예: "설득"), 이름이 `_` 로 시작하는 페이지는 건너뜀
 * - 섹션(Section) = part2 (예: "2-3 핵심 포인트") → 섹션 안의 프레임들이 템플릿
 * - 섹션 밖 최상위 프레임은 이름의 `part2 / 템플릿명` 형식으로 part2를 지정 (없으면 페이지 이름)
 * - part2 앞의 숫자("2-3", "03.")로 정렬 순서를 정함
 * - 레이어 규칙: `_image` = 상품 사진 자리, `prompt`(숨김 텍스트) = 문구 가이드
 */
const API = 'https://api.figma.com/v1';
const NODE_BATCH = 20;
const download = pLimit(6);

interface SyncOptions {
  token?: string;
  fileKey?: string;
  hideBuiltin?: boolean;
}

/** 파일 URL(figma.com/design/KEY/...)도 받아준다 */
export const parseFileKey = (input: string) =>
  /figma\.com\/(?:file|design|proto)\/([\w-]+)/.exec(input)?.[1] ?? input.trim();

async function figmaGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': token }, cache: 'no-store' });
  if (res.ok) return (await res.json()) as T;
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

/** "2-3 핵심 포인트" → 203, "03. 문제 제기" → 300, 숫자 없으면 fallback */
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

/** 파일 구조에서 템플릿 프레임 목록 추출 */
function findTargets(document: FigmaNodeLite): TemplateTarget[] {
  const targets: TemplateTarget[] = [];
  let order = 0;
  const add = (node: FigmaNodeLite, part1: string, part2: string, name = node.name) => {
    order += 1;
    targets.push({ id: node.id, name, part1, part2, part2SortKey: parseSortKey(part2, 10_000 + order) });
  };

  for (const page of document.children ?? []) {
    if (page.type !== 'CANVAS' || isSkipped(page.name)) continue;
    for (const node of page.children ?? []) {
      if (isSkipped(node.name)) continue;
      if (node.type === 'SECTION') {
        for (const child of node.children ?? []) {
          if (FRAME_TYPES.has(child.type) && !isSkipped(child.name)) add(child, page.name, node.name.trim());
        }
      } else if (FRAME_TYPES.has(node.type)) {
        const [prefix, ...rest] = node.name.split('/');
        if (rest.length) add(node, page.name, prefix.trim(), rest.join('/').trim());
        else add(node, page.name, page.name);
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

/** 템플릿에 쓰인 이미지 채우기를 내려받아 저장 (이미 받은 이미지는 건너뜀) */
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
  for (const batch of chunk(ids, NODE_BATCH)) {
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
  if (!config.token || !config.fileKey) {
    throw badRequest('Figma 개인 액세스 토큰과 파일 키(또는 파일 URL)를 입력해주세요.');
  }
  const { token } = config;
  const fileKey = parseFileKey(config.fileKey);

  const structure = await figmaGet<{ document: FigmaNodeLite }>(token, `/files/${fileKey}?depth=3`);
  const targets = findTargets(structure.document);
  if (!targets.length) {
    throw badRequest('템플릿으로 쓸 프레임이 없습니다. 페이지 안에 섹션(=구성 이름)을 만들고 그 안에 프레임을 넣어주세요.');
  }

  const errors: string[] = [];
  const converter = new Converter();
  const converted = new Map<string, FrameNode>();
  for (const batch of chunk(targets, NODE_BATCH)) {
    const { nodes } = await figmaGet<{ nodes: Record<string, { document: unknown } | null> }>(
      token,
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(batch.map((t) => t.id).join(','))}&geometry=paths`,
    );
    for (const target of batch) {
      const document = nodes[target.id]?.document;
      if (!document) {
        errors.push(`${target.name}: 노드를 불러오지 못했습니다.`);
        continue;
      }
      try {
        converted.set(target.id, converter.convertTopLevelFrame(document) as unknown as FrameNode);
      } catch (err) {
        errors.push(`${target.name}: 변환 실패 (${(err as Error).message})`);
      }
    }
  }

  await downloadImageFills(token, fileKey, [...converted.values()], errors);
  const thumbnails = await renderThumbnails(token, fileKey, [...converted.keys()], errors);

  const synced: SyncedTemplate[] = targets
    .filter((t) => converted.has(t.id))
    .map((t) => ({
      figmaId: t.id,
      name: t.name,
      part1: t.part1,
      part2: t.part2,
      part2SortKey: t.part2SortKey,
      frame: converted.get(t.id)!,
      thumbnail: thumbnails.get(t.id),
    }));

  const syncedCount = await replaceFigmaTemplates(synced);
  if (options.hideBuiltin !== undefined) await setBuiltinStatus(options.hideBuiltin ? 'inactive' : 'active');

  return {
    message: `Figma 템플릿 ${syncedCount}개를 불러왔습니다.`,
    syncedCount,
    errors,
  };
}

export async function getFigmaStatus() {
  const config = await getFigmaConfig();
  return {
    hasToken: Boolean(config.token),
    fileKey: config.fileKey ?? '',
  };
}
