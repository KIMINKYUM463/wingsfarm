import 'server-only';
import type { Asset, AssetOrigin, AssetStatus } from '@/features/assets/types';
import type { AssetFileInfo } from '@/features/detail-page/types';
import { markAiAssetUrl } from '@/shared/lib/aiImageLabel';
import { graphicUrl, isGraphicAssetId } from './catalog/graphics';
import { badRequest, notFound } from './http';
import { publicUrl, safeExt, saveFile, signedUploadUrl } from './storage';
import { newId, nowIso, readJson, updateJson } from './store';

const FILE = 'assets.json';

export interface AssetRecord {
  id: string;
  projectId: string | null;
  status: AssetStatus;
  origin: AssetOrigin;
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  path: string;
  createdAt: string;
}

/** 템플릿(Figma) 이미지는 asset 목록에 넣지 않고 ID 규칙으로 URL을 만든다 */
const TEMPLATE_ASSET_PREFIX = 'tpl-';
export const templateImagePath = (imageRef: string) => `templates/images/${imageRef}.png`;
export const templateAssetId = (imageRef: string) => `${TEMPLATE_ASSET_PREFIX}${imageRef}`;

const readAll = () => readJson<AssetRecord[]>(FILE, []);
const updateAll = <R>(mutate: (assets: AssetRecord[]) => AssetRecord[], pick: (assets: AssetRecord[]) => R) =>
  updateJson(FILE, [] as AssetRecord[], mutate, pick);

const assetUrl = (record: Pick<AssetRecord, 'path' | 'origin'>) =>
  record.origin === 'ai_generation' ? markAiAssetUrl(publicUrl(record.path)) : publicUrl(record.path);

const toAsset = (record: AssetRecord): Asset => {
  const url = assetUrl(record);
  return {
    id: record.id,
    status: record.status,
    isPrivate: false,
    createdAt: record.createdAt,
    fileName: record.fileName,
    origin: record.origin,
    isAiImage: record.origin === 'ai_generation',
    fileSizeBytes: record.fileSizeBytes,
    width: record.width,
    height: record.height,
    signedUrl: url,
    thumbnailUrl: url,
  };
};

/** 업로드 예약: pending 상태 asset + 서명된 업로드 URL */
export async function reserveUploads(projectId: string, files: AssetFileInfo[]) {
  if (!files?.length) throw badRequest('업로드할 파일이 없습니다.');
  const records: AssetRecord[] = files.map((file) => {
    const id = newId();
    return {
      id,
      projectId,
      status: 'pending',
      origin: 'upload',
      fileName: file.fileName,
      contentType: file.contentType,
      fileSizeBytes: file.fileSizeBytes,
      width: file.width,
      height: file.height,
      path: `assets/${id}.${safeExt(file.fileName, file.contentType)}`,
      createdAt: nowIso(),
    };
  });
  await updateAll((assets) => [...assets, ...records], () => null);

  const urls = await Promise.all(
    records.map(async (record, index) => ({
      assetId: record.id,
      fileKey: files[index].fileKey,
      path: record.path,
      ...(await signedUploadUrl(record.path)),
    })),
  );
  return { urls };
}

/** 지정한 asset들을 ready로 바꾸고 id → URL 맵 반환 */
export async function markReady(assetIds: string[]) {
  const ids = new Set(assetIds);
  return updateAll(
    (assets) => assets.map((a) => (ids.has(a.id) && a.status === 'pending' ? { ...a, status: 'ready' } : a)),
    (assets) =>
      Object.fromEntries(assets.filter((a) => ids.has(a.id)).map((a) => [a.id, assetUrl(a)])),
  );
}

/** 서버에서 만든 이미지(AI 생성 등)를 asset으로 저장 */
export async function createAssetFromBuffer(input: {
  id?: string;
  projectId: string | null;
  data: Buffer;
  contentType: string;
  fileName: string;
  origin: AssetOrigin;
  ready: boolean;
  width?: number;
  height?: number;
}) {
  const id = input.id ?? newId();
  const record: AssetRecord = {
    id,
    projectId: input.projectId,
    status: input.ready ? 'ready' : 'pending',
    origin: input.origin,
    fileName: input.fileName,
    contentType: input.contentType,
    fileSizeBytes: input.data.length,
    width: input.width,
    height: input.height,
    path: `assets/${id}.${safeExt(input.fileName, input.contentType)}`,
    createdAt: nowIso(),
  };
  await saveFile(record.path, input.data);
  await updateAll((assets) => [...assets, record], () => null);
  return { ...record, url: assetUrl(record) };
}

const DEFAULT_LIMIT = 50;

export async function listAssets(query: URLSearchParams) {
  const status = query.get('status');
  const search = query.get('search')?.trim().toLowerCase();
  const limit = Math.min(Number(query.get('limit')) || DEFAULT_LIMIT, 100);
  const offset = Number(Buffer.from(query.get('cursor') ?? '', 'base64').toString() || 0);

  const filtered = (await readAll())
    .filter((a) => (status ? a.status === status : a.status !== 'archived'))
    .filter((a) => !search || a.fileName.toLowerCase().includes(search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const page = filtered.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    assets: page.map(toAsset),
    total: filtered.length,
    nextCursor: nextOffset < filtered.length ? Buffer.from(String(nextOffset)).toString('base64') : null,
  };
}

export async function getAsset(assetId: string) {
  const record = (await readAll()).find((a) => a.id === assetId);
  if (!record) throw notFound('이미지를 찾을 수 없습니다.');
  return toAsset(record);
}

export async function archiveAssets(assetIds: string[]) {
  if (!assetIds?.length) throw badRequest('삭제할 자산을 선택해주세요');
  const ids = new Set(assetIds);
  const deletedCount = (await readAll()).filter((a) => ids.has(a.id) && a.status !== 'archived').length;
  await updateAll(
    (assets) => assets.map((a) => (ids.has(a.id) ? { ...a, status: 'archived' as const } : a)),
    () => null,
  );
  return { deletedCount };
}

export async function findAssetRecord(assetId: string) {
  return (await readAll()).find((a) => a.id === assetId) ?? null;
}

/** assetId 목록 → URL 맵 (업로드·AI 이미지, 템플릿 이미지, 그래픽 요소 모두 처리) */
export async function resolveAssetUrls(assetIds: Iterable<string>) {
  const records = new Map((await readAll()).map((a) => [a.id, a]));
  const urls: Record<string, string> = {};
  for (const id of assetIds) {
    if (id.startsWith(TEMPLATE_ASSET_PREFIX)) {
      urls[id] = publicUrl(templateImagePath(id.slice(TEMPLATE_ASSET_PREFIX.length)));
    } else if (isGraphicAssetId(id)) {
      urls[id] = graphicUrl(id);
    } else {
      const record = records.get(id);
      if (record) urls[id] = assetUrl(record);
    }
  }
  return urls;
}
