import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { ApiError } from './http';
import { getSecret } from './settings';
import { readBinary, writeData } from './store';

/**
 * 파일 저장소 (Supabase Storage 대체)
 *
 * - 파일은 `.data/detail-page/files/{path}` 에 저장
 * - 브라우저는 `/api/lever/storage/{path}` 로 읽고,
 *   서명된 `/api/lever/storage/upload/{path}?token=` 으로 PUT 업로드한다.
 */
export const API_PREFIX = '/api/lever';
const FILES_DIR = 'files';

const encodePath = (storagePath: string) =>
  storagePath.split('/').map(encodeURIComponent).join('/');

export const publicUrl = (storagePath: string) => `${API_PREFIX}/storage/${encodePath(storagePath)}`;

const sign = async (storagePath: string) =>
  createHmac('sha256', await getSecret()).update(storagePath).digest('hex');

export async function signedUploadUrl(storagePath: string) {
  const token = await sign(storagePath);
  return { token, signedUrl: `${API_PREFIX}/storage/upload/${encodePath(storagePath)}?token=${token}` };
}

export async function verifyUploadToken(storagePath: string, token: string | null) {
  if (!token) return false;
  const expected = Buffer.from(await sign(storagePath));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** storage path → `files/` 안의 경로 (`..` 로 settings.json 등 저장소 내부 파일에 닿지 못하게 막는다) */
const filePath = (storagePath: string) => {
  const normalized = path.posix.normalize(storagePath.replace(/\\/g, '/'));
  if (!normalized || normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
    throw new ApiError(400, '잘못된 파일 경로입니다.');
  }
  return path.posix.join(FILES_DIR, normalized);
};

export const saveFile = (storagePath: string, data: Buffer) => writeData(filePath(storagePath), data);

export const loadFile = (storagePath: string) => readBinary(filePath(storagePath));

/** `/api/lever/storage/...` URL 또는 storage path → storage path */
export const toStoragePath = (urlOrPath: string) => {
  const marker = `${API_PREFIX}/storage/`;
  const index = urlOrPath.indexOf(marker);
  const raw = index >= 0 ? urlOrPath.slice(index + marker.length) : urlOrPath;
  return decodeURIComponent(raw.split('?')[0]).replace(/^\/+/, '');
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
};

export const mimeFromPath = (storagePath: string) =>
  MIME_BY_EXT[path.extname(storagePath).slice(1).toLowerCase()] ?? 'application/octet-stream';

export const extFromMime = (mime: string) =>
  Object.entries(MIME_BY_EXT).find(([, value]) => value === mime)?.[0] ?? 'png';

/** 파일명에서 확장자만 안전하게 추출 */
export const safeExt = (fileName: string, contentType: string) => {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ? ext : extFromMime(contentType);
};
