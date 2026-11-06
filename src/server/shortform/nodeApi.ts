/**
 * 숏폼 웹형(Node) API — Vercel 등에서 Python 없이 bootstrap·상품·초안·렌더까지 처리한다.
 * 렌더는 사진만 모드(OpenAI TTS + ffmpeg-static). AI 장면·Remotion은 이후 확장.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chatEdit, cloneDraft, draftFields, hookVariants, lintTexts, postPack } from '@/server/shortform/copywriter';
import { enqueueWebJob } from '@/server/shortform/photoRender';
import { hasAiSceneProvider, replicateToken } from '@/server/shortform/aiScene';
import { geminiApiKey } from '@/server/shortform/geminiTts';
import {
  captureScenes,
  loadCapturedScenes,
  mergeCaptureIntoAnalysis,
} from '@/server/shortform/sceneCapture';
import {
  getJob,
  hideJob,
  listJobs,
  listWebProducts,
  readWebProduct,
  saveJob,
  upsertWebProduct,
  type SfJob,
} from '@/server/shortform/webStore';
import {
  addProductAsset,
  attachAssetsToProducts,
  listProductAssets,
  removeProductAsset,
} from '@/server/shortform/productAssets';
import { hasSerpApi, searchReferenceVideos } from '@/server/shortform/serpSearch';
import { hasCcSearch, importCcHitToProduct, searchCcMedia, type CcHit } from '@/server/shortform/ccMedia';

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

export function isShortformServerless(): boolean {
  return Boolean(process.env.VERCEL) || process.env.SHORTFORM_FORCE_NODE === '1';
}

function shortformRoot() {
  return path.join(process.cwd(), 'shortform');
}

function studioRoot() {
  return path.join(shortformRoot(), 'studio');
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function loadTemplates(): Record<string, Record<string, unknown>> {
  const templatesDir = path.join(shortformRoot(), 'templates');
  if (!existsSync(templatesDir)) return {};
  const entries = readdirSync(templatesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const id = name.replace(/\.json$/i, '');
      const data = readJsonFile<Record<string, unknown>>(path.join(templatesDir, name), {});
      return [id, { ...data, id }] as const;
    });
  entries.sort(([a], [b]) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return Object.fromEntries(entries);
}

/**
 * output/ 샘플 mp4는 gitignore라 배포에 없다.
 * 대신 해당 형식 레퍼런스 중 조회수 1위 썸네일을 미리보기로 붙인다.
 */
function attachTemplateSamples(
  templates: Record<string, Record<string, unknown>>,
  refs: Array<Record<string, unknown>>,
) {
  const best = new Map<string, Record<string, unknown>>();
  for (const r of refs) {
    const tpl = String(r.template ?? '');
    if (!tpl) continue;
    const prev = best.get(tpl);
    if (!prev || Number(r.views ?? 0) > Number(prev.views ?? 0)) best.set(tpl, r);
  }
  for (const [id, t] of Object.entries(templates)) {
    if (t.sample) continue;
    const ref = best.get(id);
    const rid = ref?.id ? String(ref.id) : '';
    if (rid) t.sample = `https://i.ytimg.com/vi/${rid}/hqdefault.jpg`;
  }
  return templates;
}

function loadReferences() {
  const raw = readJsonFile<{
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
  const items: Array<Record<string, unknown>> = (raw.items ?? []).map((item) => {
    const id = String(item.id ?? '');
    return {
      ...item,
      source: item.source ?? 'curated',
      analyzed: id ? existsSync(path.join(analysisDir, `${id}.json`)) : false,
    };
  });

  for (const rel of ['user_refs.json', 'refs_auto.json'] as const) {
    const filePath = path.join(studioRoot(), 'data', rel);
    const extra = readJsonFile<Array<Record<string, unknown>>>(filePath, []);
    const seen = new Set(items.map((r) => String(r.id ?? '')));
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

  return { collected: String(raw.collected ?? ''), hooks, items };
}

function loadAnalysis(id: string) {
  const filePath = path.join(studioRoot(), 'data', 'analysis', `${id}.json`);
  if (!existsSync(filePath)) return null;
  return readJsonFile<Record<string, unknown>>(filePath, {});
}

/** 로컬 shortform/products 도 있으면 합친다(개발 편의). 배포는 웹 저장소만. */
function loadDiskProducts() {
  const productsDir = path.join(shortformRoot(), 'products');
  if (!existsSync(productsDir)) return [];
  const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  return readdirSync(productsDir)
    .map((name) => {
      const pdir = path.join(productsDir, name);
      try {
        if (!statSync(pdir).isDirectory()) return null;
        if (!existsSync(path.join(pdir, 'product.json'))) return null;
        const p = readJsonFile<Record<string, unknown>>(path.join(pdir, 'product.json'), {});
        const files = readdirSync(pdir).filter((n) => PHOTO_EXT.has(path.extname(n).toLowerCase()));
        return {
          folder: name,
          name: String(p.name ?? name),
          category: p.category,
          origin: p.origin,
          unit: p.unit,
          price: p.price,
          memo: p.memo,
          photo: files[0]
            ? `/media/products/${encodeURIComponent(name)}/${encodeURIComponent(files[0])}`
            : null,
          photos: files.length,
          cached: [] as string[],
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function mergedProducts() {
  const web = await listWebProducts();
  if (process.env.VERCEL) return web;
  const disk = loadDiskProducts().filter(
    (p): p is NonNullable<typeof p> => Boolean(p && p.folder),
  );
  const seen = new Set(web.map((p) => p.folder));
  return [...web, ...disk.filter((p) => !seen.has(p.folder))];
}

export type NodeApiResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; status?: number };

export async function handleShortformNode(
  method: string,
  params: Record<string, unknown> = {},
): Promise<NodeApiResult> {
  try {
    switch (method) {
      case 'ping':
        return { ok: true, result: { pong: true, engine: 'web' } };

      case 'bootstrap': {
        const refs = loadReferences();
        const products = await attachAssetsToProducts(await mergedProducts());
        return {
          ok: true,
          result: {
            templates: attachTemplateSamples(loadTemplates(), refs.items),
            references: refs.items,
            hooks: refs.hooks,
            collected: refs.collected,
            scenes: SCENES,
            products,
            moods: MOODS,
            voices: VOICES,
            keys: {
              fal: Boolean(process.env.FAL_KEY),
              replicate: Boolean(replicateToken()),
              openai: Boolean(process.env.OPENAI_API_KEY),
              pexels: Boolean(process.env.PEXELS_API_KEY),
              gemini: Boolean(geminiApiKey()),
              aiScene: hasAiSceneProvider(),
              serpapi: hasSerpApi(),
              youtubeCc: Boolean(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY),
              ccSearch: hasCcSearch(),
            },
            deployHost: Boolean(process.env.VERCEL),
            engine: 'web',
            notice: process.env.VERCEL
              ? hasAiSceneProvider()
                ? '웹 엔진 · Replicate/FAL로 AI 장면·사진만 모드를 쓸 수 있어요.'
                : '웹 엔진입니다. REPLICATE_API_TOKEN을 넣으면 AI 장면 모드가 켜져요. 사진만 모드는 바로 쓸 수 있어요.'
              : undefined,
          },
        };
      }

      case 'products':
        return { ok: true, result: await attachAssetsToProducts(await mergedProducts()) };

      case 'product': {
        const product = await upsertWebProduct(params);
        const assets = await listProductAssets(product.folder);
        return { ok: true, result: { ...product, assets } };
      }

      case 'product_upload': {
        const folder = String(params.product || params.folder || '');
        if (!(await readWebProduct(folder))) {
          return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        }
        const asset = await addProductAsset({
          folder,
          dataUrl: String(params.data || params.file || ''),
          name: params.name ? String(params.name) : undefined,
          shot: params.shot ? String(params.shot) : 'any',
        });
        const assets = await listProductAssets(folder);
        return { ok: true, result: { asset, assets } };
      }

      case 'product_assets': {
        const folder = String(params.product || params.folder || '');
        if (!folder) return { ok: false, error: '상품을 지정해 주세요', status: 400 };
        return { ok: true, result: { assets: await listProductAssets(folder) } };
      }

      case 'product_asset_delete': {
        const folder = String(params.product || params.folder || '');
        const id = String(params.id || '');
        if (!folder || !id) return { ok: false, error: '상품과 파일 id가 필요해요', status: 400 };
        await removeProductAsset(folder, id);
        return { ok: true, result: { assets: await listProductAssets(folder) } };
      }

      case 'ref_search': {
        if (!hasSerpApi()) {
          return {
            ok: false,
            error: 'SERPAPI_API_KEY를 .env.local에 넣고 서버를 다시 켜 주세요',
            status: 400,
          };
        }
        const productName = String(params.q || params.productName || params.name || '').trim();
        if (!productName) return { ok: false, error: '검색할 상품명을 넣어 주세요', status: 400 };
        const result = await searchReferenceVideos({
          productName,
          shot: params.shot ? String(params.shot) : undefined,
          extra: params.extra ? String(params.extra) : undefined,
        });
        return { ok: true, result };
      }

      case 'cc_search': {
        if (!hasCcSearch()) {
          return {
            ok: false,
            error:
              'CC 검색에는 YOUTUBE_API_KEY(또는 GOOGLE_API_KEY)와/또는 SERPAPI_API_KEY가 필요해요. .env.local에 넣고 서버를 다시 켜 주세요.',
            status: 400,
          };
        }
        const productName = String(params.q || params.productName || params.name || '').trim();
        if (!productName) return { ok: false, error: '검색할 상품명을 넣어 주세요', status: 400 };
        const result = await searchCcMedia({
          productName,
          shot: params.shot ? String(params.shot) : undefined,
        });
        return { ok: true, result };
      }

      case 'cc_import': {
        const folder = String(params.product || params.folder || '');
        if (!(await readWebProduct(folder))) {
          return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        }
        const hit = params.hit as CcHit | undefined;
        if (!hit?.link || !hit.kind) {
          return { ok: false, error: '가져올 CC 항목이 없어요', status: 400 };
        }
        const asset = await importCcHitToProduct({
          folder,
          hit,
          shot: params.shot ? String(params.shot) : 'any',
        });
        return { ok: true, result: { asset, assets: await listProductAssets(folder) } };
      }

      case 'jobs':
        return { ok: true, result: await listJobs() };

      case 'job': {
        const job = await getJob(String(params.id ?? ''));
        if (!job) return { ok: false, error: '없는 작업', status: 404 };
        return { ok: true, result: job };
      }

      case 'jobs_hide': {
        const id = String(params.job ?? '');
        const job = await getJob(id);
        if (!job) return { ok: false, error: '이미 목록에 없는 영상이에요', status: 400 };
        if (job.status !== 'done' && job.status !== 'error') {
          return { ok: false, error: '만드는 중인 영상은 뺄 수 없어요. 끝난 뒤에 빼 주세요', status: 400 };
        }
        await hideJob(id);
        return { ok: true, result: { ok: true } };
      }

      case 'analysis': {
        const analysis = loadAnalysis(String(params.id ?? ''));
        if (!analysis) return { ok: false, error: '아직 분석하지 않은 영상이에요', status: 404 };
        return { ok: true, result: analysis };
      }

      case 'draft': {
        const templates = loadTemplates();
        const tplId = String(params.template ?? '');
        const tpl = templates[tplId];
        if (!tpl) return { ok: false, error: '없는 템플릿이에요', status: 400 };
        const product =
          (await readWebProduct(String(params.product ?? ''))) ||
          loadDiskProducts().find((p) => p && p.folder === params.product);
        if (!product) return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        const refs = loadReferences();
        const ref = refs.items.find((r) => r.id === params.ref) ?? null;
        const { fields, via } = await draftFields(tplId, tpl, product as Record<string, unknown>, ref, refs.hooks);
        return { ok: true, result: { fields, via } };
      }

      case 'clone_draft': {
        const product = await readWebProduct(String(params.product ?? ''));
        if (!product) return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        const rid = String(params.ref ?? '');
        let analysis = loadAnalysis(rid);
        if (!analysis) {
          return {
            ok: false,
            error: '이 레퍼런스는 아직 분석하지 않았어요. 분석된 참고 영상을 골라 주세요.',
            status: 400,
          };
        }
        // 장면 캡처가 없으면 한 번 시도 (이미 있으면 캐시)
        if (!(analysis as { capture?: unknown }).capture) {
          try {
            const captured = await captureScenes(rid);
            analysis = mergeCaptureIntoAnalysis(analysis, captured);
            const analysisDir = path.join(studioRoot(), 'data', 'analysis');
            mkdirSync(analysisDir, { recursive: true });
            writeFileSync(
              path.join(analysisDir, `${rid}.json`),
              JSON.stringify(analysis, null, 1),
              'utf8',
            );
          } catch (e) {
            console.warn('[shortform] capture on clone_draft', e);
          }
        }
        const { fields, via } = await cloneDraft(analysis, product as unknown as Record<string, unknown>);
        return { ok: true, result: { fields, via, analysis } };
      }

      case 'render': {
        const templates = loadTemplates();
        const tplId = String(params.template ?? '');
        const tpl = templates[tplId];
        if (tplId === 'clone') {
          /* ok */
        } else if (!tpl || tpl.kind === '촬영') {
          return { ok: false, error: '이 템플릿은 직접 촬영해야 해요', status: 400 };
        }
        const folder = String(params.product ?? '');
        const product = await readWebProduct(folder);
        if (!product) return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };

        const stamp = new Date();
        const base = `${tplId}_${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}_${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}${String(stamp.getSeconds()).padStart(2, '0')}`;
        let id = base;
        let n = 1;
        while (await getJob(id)) {
          n += 1;
          id = `${base}_${n}`;
        }

        const job: SfJob = {
          id,
          product: folder,
          template: tplId,
          template_name: tplId === 'clone' ? '레퍼런스 복제' : String(tpl?.name ?? tplId),
          ref: params.ref ? String(params.ref) : null,
          mode: String(params.mode || 'photo'),
          fields: (params.fields as Record<string, unknown>) || {},
          status: 'queued',
          created: stamp.toISOString().slice(0, 16).replace('T', ' '),
          log: ['대기열에 넣었어요 (웹 엔진)'],
          result: null,
        };
        await saveJob(job);
        enqueueWebJob(id, templates);
        return { ok: true, result: job };
      }

      case 'chat': {
        const product = await readWebProduct(String(params.product ?? ''));
        if (!product) return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        const templates = loadTemplates();
        const tplId = String(params.template ?? '');
        const kind = tplId === 'clone' ? '레퍼런스 복제' : String(templates[tplId]?.name ?? tplId);
        const result = await chatEdit(
          kind,
          (params.fields as Record<string, unknown>) || {},
          String(params.message ?? ''),
          product as Record<string, unknown>,
          SCENES.map((s) => s.id),
        );
        return { ok: true, result };
      }

      case 'hooks': {
        const product = await readWebProduct(String(params.product ?? ''));
        if (!product) return { ok: false, error: '상품을 먼저 저장해 주세요', status: 400 };
        const hooks = await hookVariants(
          product as Record<string, unknown>,
          String(params.kind ?? ''),
          String(params.hook ?? ''),
          Array.isArray(params.rest) ? params.rest.map(String) : [],
        );
        return { ok: true, result: { hooks } };
      }

      case 'lint': {
        const product = params.product ? await readWebProduct(String(params.product)) : null;
        const texts = Array.isArray(params.texts) ? params.texts.map(String) : [];
        return { ok: true, result: { hits: lintTexts(texts, product as Record<string, unknown> | null) } };
      }

      case 'post': {
        const job = await getJob(String(params.job ?? ''));
        if (!job?.result) return { ok: false, error: '완성된 영상이 있어야 올릴 글을 쓸 수 있어요', status: 400 };
        const product = await readWebProduct(job.product);
        if (!product) return { ok: false, error: '상품을 찾을 수 없어요', status: 400 };
        const script = String((job.result as { script?: string }).script || '');
        const pack = await postPack(product as Record<string, unknown>, script, job.template_name);
        job.post = pack;
        await saveJob(job);
        return {
          ok: true,
          result: { post: pack, lint: lintTexts(Object.values(pack).flatMap((v) => (typeof v === 'object' && v ? Object.values(v as object).map(String) : [])), product as Record<string, unknown>) },
        };
      }

      case 'analyze': {
        const rid = String(params.id || params.url || '').trim();
        const m = rid.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)?([\w-]{11})/);
        const vid = m?.[1] || rid;
        if (!/^[\w-]{11}$/.test(vid)) {
          return { ok: false, error: '유튜브 쇼츠 주소나 영상 id를 넣어 주세요', status: 400 };
        }
        let analysis = loadAnalysis(vid);
        const force = Boolean(params.force);
        let captured = force ? null : loadCapturedScenes(vid);
        try {
          if (!captured || force) captured = await captureScenes(vid, force);
        } catch (e) {
          console.warn('[shortform] analyze capture', e);
          if (!analysis) {
            return {
              ok: false,
              error: e instanceof Error ? e.message : '장면 캡처에 실패했어요. yt-dlp·ffmpeg를 확인해 주세요.',
              status: 500,
            };
          }
        }
        if (captured?.length) {
          analysis = mergeCaptureIntoAnalysis(
            analysis || {
              summary: '장면 전환을 캡처해 구조를 잡았어요',
              layout: 'full',
              voice: 'narration',
              music: '밝은',
              pacing: '보통',
              caption: { style: 'keyword_highlight', color: 'yellow', size: 'big' },
              hook: { text: '', type: '' },
              title_lines: [],
              why: ['장면 전환 시점과 초수를 실측했어요'],
              copy_style: '',
              template: '기타',
              item: '',
              category: '',
              relevant: true,
              meta: { id: vid, title: '', length: 0, channel: '', views: 0, description: '' },
              scenes: [],
              via: 'scene_capture',
            },
            captured,
          );
          const analysisDir = path.join(studioRoot(), 'data', 'analysis');
          mkdirSync(analysisDir, { recursive: true });
          const body = { ...analysis };
          delete body.frames;
          writeFileSync(path.join(analysisDir, `${vid}.json`), JSON.stringify(body, null, 1), 'utf8');
          analysis.frames = captured.map((s) => `${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`);
        }
        if (!analysis) {
          return { ok: false, error: '분석을 만들지 못했어요', status: 500 };
        }
        // references 에 없으면 user_refs 에 추가
        try {
          const refs = loadReferences();
          if (!refs.items.some((r) => String(r.id) === vid)) {
            const userPath = path.join(studioRoot(), 'data', 'user_refs.json');
            const list = readJsonFile<Array<Record<string, unknown>>>(userPath, []);
            if (!list.some((r) => String(r.id) === vid)) {
              list.push({
                id: vid,
                title: String((analysis.meta as { title?: string } | undefined)?.title || vid),
                views: Number((analysis.meta as { views?: number } | undefined)?.views || 0),
                template: String(analysis.template || '기타'),
                hook: String((analysis.hook as { type?: string } | undefined)?.type || ''),
                item: String(analysis.item || ''),
                category: String(analysis.category || ''),
                source: 'user',
              });
              mkdirSync(path.dirname(userPath), { recursive: true });
              writeFileSync(userPath, JSON.stringify(list, null, 1), 'utf8');
            }
          }
        } catch {
          /* ignore */
        }
        return { ok: true, result: { analysis, id: vid } };
      }

      case 'plan':
      case 'plan_run':
      case 'reshoot':
        return {
          ok: false,
          error: `웹 엔진에서는 아직 '${method}'를 지원하지 않아요. 참고 영상 보기·초안·사진만 렌더는 사용할 수 있어요.`,
          status: 501,
        };

      default:
        return { ok: false, error: `없는 요청이에요: ${method}`, status: 404 };
    }
  } catch (err) {
    console.error('[shortform:web]', method, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : '숏폼 웹 엔진 오류',
      status: 500,
    };
  }
}
