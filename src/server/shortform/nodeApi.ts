/**
 * Vercel 등 Python 브릿지를 띄울 수 없는 환경용 읽기 전용 API.
 * bootstrap / products / jobs / analysis 조회만 처리하고,
 * 생성·렌더는 명확한 안내 메시지를 돌려준다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ORDER = [
  '고르는법',
  '보관경고',
  '손질법',
  '물량리빌',
  '비교',
  '짧은루프',
  '카드',
  '판매형',
  '깎기ASMR',
  '현장리포트',
];

const SCENES = [
  { id: 'ai:hook', label: '대표 컷 (반 가르기·요리)', cost: true },
  { id: 'ai:detail', label: '껍질·표면 클로즈업', cost: true },
  { id: 'ai:crave', label: '먹음직스러운 한 입', cost: true },
  { id: 'ai:hero', label: '상자·진열 전체 컷', cost: true },
  { id: 'ai:hold', label: '손에 들어 보이기', cost: true },
  { id: 'ai:pack', label: '박스에 담기', cost: true },
  { id: 'ai:store', label: '보관하는 모습', cost: true },
  { id: 'ai:prep', label: '손질·자르기', cost: true },
  { id: 'stock:origin', label: '산지 풍경 (무료 스톡)', cost: false },
  { id: 'photo:1', label: '올린 사진 그대로 (무료)', cost: false },
];

const VOICES = [
  '여성',
  '남성',
  'Gemini 여성 · 또렷한',
  'Gemini 여성 · 밝은',
  'Gemini 남성 · 활기찬',
  'Gemini 남성 · 차분한',
];

const MOODS = ['밝은', '경쾌한', '잔잔한', '시장활기', '없음'];

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Python 엔진이 필요한 쓰기·생성 메서드 */
const WRITE_METHODS = new Set([
  'product',
  'draft',
  'render',
  'analyze',
  'clone_draft',
  'chat',
  'post',
  'hooks',
  'plan',
  'plan_run',
  'jobs_hide',
  'lint',
  'reshoot',
]);

export function isShortformServerless(): boolean {
  return Boolean(process.env.VERCEL) || process.env.SHORTFORM_FORCE_NODE === '1';
}

function shortformRoot(): string {
  return path.join(process.cwd(), 'shortform');
}

function studioRoot(): string {
  return path.join(shortformRoot(), 'studio');
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function loadTemplates(): Record<string, Record<string, unknown>> {
  const templatesDir = path.join(shortformRoot(), 'templates');
  if (!existsSync(templatesDir)) return {};
  const entries = readdirSync(templatesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const id = name.replace(/\.json$/i, '');
      const data = readJson<Record<string, unknown>>(path.join(templatesDir, name), {});
      return [id, { ...data, id }] as const;
    });
  entries.sort(([a], [b]) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return Object.fromEntries(entries);
}

function loadReferences() {
  const raw = readJson<{
    collected?: string;
    hooks?: Record<string, { label?: string; formula?: string }>;
    items?: Array<Record<string, unknown>>;
  }>(path.join(studioRoot(), 'references.json'), {});

  const hooks = Object.fromEntries(
    Object.entries(raw.hooks ?? {}).map(([id, value]) => [
      id,
      { label: String(value.label ?? id), formula: String(value.formula ?? '') },
    ]),
  );

  const analysisDir = path.join(studioRoot(), 'data', 'analysis');
  const items = (raw.items ?? []).map((item) => {
    const id = String(item.id ?? '');
    return {
      ...item,
      source: item.source ?? 'curated',
      analyzed: id ? existsSync(path.join(analysisDir, `${id}.json`)) : false,
    };
  });

  // 사용자·자동 수집 레퍼런스(있으면 합침)
  for (const rel of ['user_refs.json', 'refs_auto.json'] as const) {
    const filePath = path.join(studioRoot(), 'data', rel);
    const extra = readJson<Array<Record<string, unknown>>>(filePath, []);
    const seen = new Set(items.map((r) => String(r.id)));
    for (const r of extra) {
      const id = String(r.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        ...r,
        source: rel === 'user_refs.json' ? 'user' : 'auto',
        analyzed: existsSync(path.join(analysisDir, `${id}.json`)),
      });
    }
  }

  return {
    collected: String(raw.collected ?? ''),
    hooks,
    items,
  };
}

function productInfo(folder: string, pdir: string) {
  const p = readJson<Record<string, unknown>>(path.join(pdir, 'product.json'), {});
  let photos = 0;
  let photo: string | null = null;
  try {
    const files = readdirSync(pdir).filter((name) => PHOTO_EXT.has(path.extname(name).toLowerCase()));
    photos = files.length;
    if (files[0]) {
      photo = `/media/products/${encodeURIComponent(folder)}/${encodeURIComponent(files[0])}`;
    }
  } catch {
    /* ignore */
  }
  const keep = ['name', 'category', 'en_name', 'look', 'origin', 'price', 'original_price', 'unit', 'memo', 'real_photo'] as const;
  const out: Record<string, unknown> = { folder, photos, photo, cached: [] as string[] };
  for (const k of keep) {
    const v = p[k] ?? (k === 'name' ? folder : undefined);
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function loadProducts() {
  const productsDir = path.join(shortformRoot(), 'products');
  if (!existsSync(productsDir)) return [];
  return readdirSync(productsDir)
    .map((name) => {
      const pdir = path.join(productsDir, name);
      try {
        if (!statSync(pdir).isDirectory()) return null;
        if (!existsSync(path.join(pdir, 'product.json'))) return null;
        return { name, pdir, mtime: statSync(path.join(pdir, 'product.json')).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((x): x is { name: string; pdir: string; mtime: number } => Boolean(x))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ name, pdir }) => productInfo(name, pdir));
}

function loadAnalysis(id: string) {
  const filePath = path.join(studioRoot(), 'data', 'analysis', `${id}.json`);
  if (!existsSync(filePath)) return null;
  return readJson<Record<string, unknown>>(filePath, {});
}

function writeBlocked(method: string) {
  return {
    ok: false as const,
    error:
      `배포 서버에서는 '${method}'를 실행할 수 없습니다. ` +
      '숏폼 영상 생성·렌더는 로컬(`npm run shortform` 또는 `npm run dev`)에서 Python 엔진과 함께 사용하세요.',
    status: 503,
  };
}

export type NodeApiResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; status?: number };

export async function handleShortformNode(
  method: string,
  params: Record<string, unknown> = {},
): Promise<NodeApiResult> {
  if (WRITE_METHODS.has(method)) {
    return writeBlocked(method);
  }

  switch (method) {
    case 'bootstrap': {
      const refs = loadReferences();
      return {
        ok: true,
        result: {
          templates: loadTemplates(),
          references: refs.items,
          hooks: refs.hooks,
          collected: refs.collected,
          scenes: SCENES,
          products: loadProducts(),
          moods: MOODS,
          voices: VOICES,
          keys: {
            fal: Boolean(process.env.FAL_KEY),
            replicate: Boolean(process.env.REPLICATE_API_TOKEN),
            openai: Boolean(process.env.OPENAI_API_KEY),
            pexels: Boolean(process.env.PEXELS_API_KEY),
            gemini: Boolean(process.env.GEMINI_API_KEY),
          },
          deployHost: true,
          readOnly: true,
          notice:
            '배포 환경에서는 참고 영상·템플릿 조회만 가능합니다. 영상 생성·렌더는 로컬에서 실행하세요.',
        },
      };
    }
    case 'products':
      return { ok: true, result: loadProducts() };
    case 'jobs':
      return { ok: true, result: [] };
    case 'job':
      return { ok: false, error: '없는 작업', status: 404 };
    case 'analysis': {
      const id = String(params.id ?? '');
      const analysis = id ? loadAnalysis(id) : null;
      if (!analysis) return { ok: false, error: '아직 해부하지 않은 영상이에요', status: 404 };
      return { ok: true, result: analysis };
    }
    case 'ping':
      return { ok: true, result: { pong: true, deployHost: true } };
    default:
      return {
        ok: false,
        error: `배포 환경에서 지원하지 않는 요청입니다: ${method}`,
        status: 503,
      };
  }
}
