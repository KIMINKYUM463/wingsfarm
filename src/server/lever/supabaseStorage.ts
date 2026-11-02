/**
 * Supabase Storage(비공개 버킷) REST 클라이언트 — 상세페이지 저장소의 배포용 백엔드.
 * Vercel 서버는 디스크에 쓸 수 없으므로 JSON·이미지를 전부 버킷 한 곳에 `.data/detail-page`와 같은 경로로 저장한다.
 * service_role 키를 쓰므로 반드시 서버에서만 import한다.
 */
export interface SupabaseConfig {
  url: string;
  key: string;
  bucket: string;
}

export const supabaseConfig = (): SupabaseConfig | null => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key, bucket: process.env.SUPABASE_BUCKET?.trim() || 'detail-page' } : null;
};

const LIST_PAGE = 1000;

const encodePath = (relPath: string) => relPath.split('/').filter(Boolean).map(encodeURIComponent).join('/');

const contentTypeOf = (relPath: string) => (relPath.endsWith('.json') ? 'application/json' : 'application/octet-stream');

/** Supabase는 없는 파일·버킷을 404 또는 400 + {"statusCode":"404"}로 알려준다 */
export const isMissing = (status: number, body: string) =>
  status === 404 || (status === 400 && /"statusCode"\s*:\s*"404"|not[ _]found/i.test(body));

export class SupabaseStorageError extends Error {
  constructor(action: string, status: number, body: string) {
    super(`Supabase Storage ${action} 실패 (${status}): ${body.slice(0, 200)}`);
  }
}

export function createSupabaseStorage(config: SupabaseConfig, fetchImpl: typeof fetch = fetch) {
  const base = `${config.url}/storage/v1`;
  const auth = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  const objectUrl = (relPath: string) => `${base}/object/${config.bucket}/${encodePath(relPath)}`;

  const call = (url: string, init: RequestInit = {}) =>
    fetchImpl(url, { ...init, cache: 'no-store', headers: { ...auth, ...init.headers } });

  const postJson = (url: string, body: unknown) =>
    call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const fail = async (action: string, res: Response): Promise<never> => {
    throw new SupabaseStorageError(action, res.status, await res.text().catch(() => ''));
  };

  let bucketReady: Promise<void> | null = null;
  /** 버킷이 없으면 비공개로 만든다 (이미 있으면 그대로) */
  const ensureBucket = () =>
    (bucketReady ??= (async () => {
      const res = await postJson(`${base}/bucket`, { id: config.bucket, name: config.bucket, public: false });
      if (res.ok || res.status === 409) return;
      const body = await res.text();
      if (/already exists|Duplicate/i.test(body)) return;
      bucketReady = null;
      throw new SupabaseStorageError('버킷 생성', res.status, body);
    })());

  async function read(relPath: string): Promise<Buffer | null> {
    const res = await call(`${base}/object/authenticated/${config.bucket}/${encodePath(relPath)}`);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text().catch(() => '');
    if (isMissing(res.status, body)) return null;
    throw new SupabaseStorageError('읽기', res.status, body);
  }

  async function write(relPath: string, data: string | Buffer) {
    const upload = () =>
      call(objectUrl(relPath), {
        method: 'POST',
        headers: { 'Content-Type': contentTypeOf(relPath), 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
        body: typeof data === 'string' ? data : new Uint8Array(data),
      });
    let res = await upload();
    if (!res.ok && isMissing(res.status, await res.clone().text())) {
      await ensureBucket();
      res = await upload();
    }
    if (!res.ok) await fail('저장', res);
  }

  async function remove(relPath: string) {
    const res = await call(`${base}/object/${config.bucket}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [relPath] }),
    });
    if (res.ok) return;
    const body = await res.text();
    if (!isMissing(res.status, body)) throw new SupabaseStorageError('삭제', res.status, body);
  }

  /** 폴더 바로 아래 파일 이름 목록 (하위 폴더 제외) */
  async function list(relDir: string): Promise<string[]> {
    const names: string[] = [];
    for (let offset = 0; ; offset += LIST_PAGE) {
      const res = await postJson(`${base}/object/list/${config.bucket}`, {
        prefix: relDir,
        limit: LIST_PAGE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (!res.ok) {
        if (isMissing(res.status, await res.clone().text())) return names;
        await fail('목록', res);
      }
      const page = (await res.json()) as { name: string; id: string | null }[];
      names.push(...page.filter((item) => item.id !== null).map((item) => item.name));
      if (page.length < LIST_PAGE) return names;
    }
  }

  /** 브라우저가 Vercel을 거치지 않고 Supabase로 바로 PUT 업로드하는 주소 (Vercel 요청 4.5MB 제한 회피) */
  async function signedUploadUrl(relPath: string) {
    const request = () => postJson(`${base}/object/upload/sign/${config.bucket}/${encodePath(relPath)}`, {});
    let res = await request();
    if (!res.ok && isMissing(res.status, await res.clone().text())) {
      await ensureBucket();
      res = await request();
    }
    if (!res.ok) await fail('업로드 주소 발급', res);
    const { url } = (await res.json()) as { url: string };
    const signedUrl = `${base}${url}`;
    return { token: new URL(signedUrl).searchParams.get('token') ?? '', signedUrl };
  }

  return { read, write, remove, list, signedUploadUrl };
}

export type SupabaseStorage = ReturnType<typeof createSupabaseStorage>;
