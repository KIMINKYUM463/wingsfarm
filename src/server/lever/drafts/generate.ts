import 'server-only';
import { generateNKeysBetween } from 'fractional-indexing';
import pLimit from 'p-limit';
import type { ProjectFrame } from '@/features/editor/types';
import { effectiveHeroMotion } from '@/shared/lib/draftMedia';
import type { DraftCut, DraftRecord, DraftSection } from '@/shared/types/draft';
import { createAssetFromBuffer } from '../assets';
import { asFrame, cloneWithNewIds, isImageSlot, walk, type FrameNode } from '../frames/tree';
import { closestAspectRatio, loadInlineImages, requireGemini, type GeminiClient } from '../gemini';
import { distinctFrom, productPhotoPrompt } from '../photoPrompt';
import { ApiError, badRequest } from '../http';
import { saveNewProject } from '../projects';
import { loadFile, mimeFromPath } from '../storage';
import { newId, nowIso } from '../store';
import { startHeroMotion } from '../media/heroMotion';
import { getDraft, heroCutOf, sectionFrames, updateDraft } from './repo';

/**
 * 초안 → 상세페이지 프로젝트 생성 Job
 *
 * - 카피는 초안에서 승인한 그대로 들어간다 (생성 단계에서 다시 쓰지 않음)
 * - "내 사진" 컷은 올린 사진을 그대로 배치 (AI 비용 없음)
 * - "AI 생성" 컷은 고른 참고 사진으로 Gemini가 연출 (실패하면 빈 자리)
 * - "빈 자리" 컷은 비워 둔다 (에디터에서 직접 넣기)
 * - 섹션 단위로 n/N 진행 상황을 기록 → 화면은 폴링으로 표시
 */
const sectionLimit = pLimit(2);
const imageLimit = pLimit(3);

interface GenerateContext {
  draft: DraftRecord;
  projectId: string;
  gemini: GeminiClient | null;
  ownAssets: Map<string, Promise<string | null>>;
  /** 레퍼런스 경로 → 사진 구도 설명 */
  referenceNotes: Map<string, Promise<string | null>>;
  failedCuts: number;
}

/** 같은 사진은 에셋 하나만 만든다 */
function ownPhotoAsset(ctx: GenerateContext, path: string | undefined) {
  if (!path) return Promise.resolve(null);
  if (!ctx.ownAssets.has(path)) {
    ctx.ownAssets.set(
      path,
      loadFile(path).then(async (data) => {
        if (!data) return null;
        const asset = await createAssetFromBuffer({
          projectId: ctx.projectId,
          data,
          contentType: mimeFromPath(path),
          fileName: path.split('/').pop() ?? 'photo',
          origin: 'upload',
          ready: true,
        });
        return asset.id;
      }),
    );
  }
  return ctx.ownAssets.get(path)!;
}

/**
 * 레퍼런스(상세페이지 캡처)는 이미지 모델에 넘기지 않는다 — 글씨·레이아웃까지 따라 그리기 때문.
 * 사진 부분의 구도만 글로 옮겨 쓴다 (같은 레퍼런스는 한 번만 읽는다).
 */
async function describeComposition(gemini: GeminiClient, path: string) {
  const images = await loadInlineImages([path], 1);
  if (!images.length) return null;
  const result = await gemini.generateJson<{ composition?: string }>(
    `Look only at the product photograph inside this reference image. Ignore every text, headline, badge, price, layout block and graphic.
Describe the photo composition in one English sentence: background, surface, camera angle, distance, lighting and props.
JSON: {"composition":"..."}`,
    images,
  );
  return String(result.composition ?? '').trim() || null;
}

function referenceComposition(ctx: GenerateContext, path: string) {
  if (!ctx.referenceNotes.has(path)) {
    ctx.referenceNotes.set(
      path,
      describeComposition(ctx.gemini!, path).catch((err) => {
        console.error('[lever] reference composition failed', path, err);
        return null;
      }),
    );
  }
  return ctx.referenceNotes.get(path)!;
}

function imagePrompt(ctx: GenerateContext, cut: DraftCut, composition: string | null) {
  const { input, plan } = ctx.draft;
  const identity = plan?.analysis?.identity;
  const otherScenes = (plan?.sections ?? []).flatMap((s) => s.cuts).filter((c) => c.id !== cut.id && c.source === 'ai').map((c) => c.scene);
  return productPhotoPrompt(
    `Product name (Korean): ${input.productName}`,
    identity && `Product details: ${[identity.colorFinish, identity.material, identity.scale].filter(Boolean).join(', ')}`,
    `Scene (Korean): ${cut.scene}. Direction (Korean): ${cut.plan || cut.scene}`,
    composition && `Composition idea from a reference photo (reuse only the composition): ${composition}`,
    distinctFrom(otherScenes),
    cut.modelAllowed && input.model.enabled
      ? `A person may appear naturally${input.model.description ? `: ${input.model.description}` : ''}.`
      : 'No people and no hands in the image.',
  );
}

async function aiCutAsset(ctx: GenerateContext, section: DraftSection, cut: DraftCut, slot: FrameNode, sectionIndex: number) {
  const { input } = ctx.draft;
  const photoPaths = cut.photoIndexes.map((i) => input.productImagePaths[i]).filter(Boolean);
  const modelPaths = cut.modelAllowed && input.model.enabled ? input.model.imagePaths : [];
  const stylePath =
    section.referenceImagePath ??
    (input.referenceMode === 'my_product' && input.referenceImagePaths.length
      ? input.referenceImagePaths[sectionIndex % input.referenceImagePaths.length]
      : null);
  const [refs, composition] = await Promise.all([
    Promise.all([
      loadInlineImages(photoPaths.length ? photoPaths : input.productImagePaths.slice(0, 2), 3),
      loadInlineImages(modelPaths, 1),
    ]).then((groups) => groups.flat()),
    stylePath ? referenceComposition(ctx, stylePath) : null,
  ]);
  const image = await ctx.gemini!.generateImage(
    imagePrompt(ctx, cut, composition),
    refs,
    closestAspectRatio(Number(slot.width), Number(slot.height)),
  );
  const asset = await createAssetFromBuffer({
    projectId: ctx.projectId,
    data: image.data,
    contentType: image.mimeType,
    fileName: `ai-${cut.id}.${image.mimeType.split('/')[1] ?? 'png'}`,
    origin: 'ai_generation',
    ready: true,
  });
  return asset.id;
}

/** 빈 자리는 그대로 두고, AI 사진이 실패해도 올린 사진으로 바꾸지 않는다 (에디터에서 다시 만들기) */
async function fillSlot(ctx: GenerateContext, section: DraftSection, slot: FrameNode, sectionIndex: number) {
  const cut = section.cuts.find((c) => c.id === slot.cutId);
  if (!cut || cut.source === 'blank') return;
  const assetId =
    cut.source === 'own'
      ? await ownPhotoAsset(ctx, ctx.draft.input.productImagePaths[cut.photoIndexes[0] ?? 0])
      : await imageLimit(() => aiCutAsset(ctx, section, cut, slot, sectionIndex)).catch((err) => {
          console.error('[lever] cut image failed', cut.id, err);
          ctx.failedCuts += 1;
          return null;
        });
  if (assetId) slot.assetId = assetId;
}

async function buildFrame(ctx: GenerateContext, section: DraftSection, frame: FrameNode, index: number) {
  const frameId = newId();
  const node = cloneWithNewIds(frame, frameId);
  await Promise.all([...walk(node)].filter(isImageSlot).map((slot) => fillSlot(ctx, section, slot, index)));
  return { frameId, node };
}

async function runGenerate(draftId: string) {
  try {
    const draft = await getDraft(draftId);
    const plan = draft.plan!;
    const built = sectionFrames(plan, draft.input.categoryId);
    const needsAi = plan.sections.some((s) => s.cuts.some((c) => c.source === 'ai'));
    const ctx: GenerateContext = {
      draft,
      projectId: newId(),
      gemini: needsAi ? await requireGemini() : null,
      ownAssets: new Map(),
      referenceNotes: new Map(),
      failedCuts: 0,
    };

    let done = 0;
    const total = built.length;
    const orders = generateNKeysBetween(null, null, total);
    const now = nowIso();
    const frames: ProjectFrame[] = await Promise.all(
      built.map(({ section, type, frame }, i) =>
        sectionLimit(async () => {
          const { frameId, node } = await buildFrame(ctx, section, frame, i);
          done += 1;
          await updateDraft(draftId, (d) => ({
            ...d,
            generateProgress: { current: done, total, message: `상세페이지 만드는 중 ${done}/${total} 섹션` },
          }));
          return {
            id: frameId,
            projectId: ctx.projectId,
            figmaId: null,
            templateId: `section:${type.id}`,
            part1: type.group,
            part2: type.name,
            hasTemplatePart: true,
            status: 'active' as const,
            frameOrder: orders[i],
            frameName: type.name,
            frameData: asFrame(node),
            width: Number(node.width),
            height: Number(node.height),
            createdAt: now,
            updatedAt: now,
          };
        }),
      ),
    );

    const { input } = draft;
    await saveNewProject({
      id: ctx.projectId,
      title: input.productName,
      status: 'active',
      productName: input.productName,
      categoryId: input.categoryId,
      description: input.features.slice(0, 1000),
      generationJobId: null,
      thumbnailPath: null,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      companyName: input.brandName,
      productImagePaths: input.productImagePaths,
      context: {
        summary: [input.productName, plan.analysis?.identity.usage].filter(Boolean).join(' — '),
        target: '',
        tone: plan.paletteReason,
        sellingPoints: input.features.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8),
        keywords: [],
      },
      draftLayout: {
        draftId,
        sectionTypeIds: plan.sections.map((s) => s.typeId),
        palette: plan.palette,
        originalPalette: plan.palette,
        designStyle: plan.designStyle,
      },
      frames,
    });
    await updateDraft(draftId, (d) => ({
      ...d,
      status: 'completed',
      projectId: ctx.projectId,
      generateProgress: {
        current: total,
        total,
        message: ctx.failedCuts ? `완료 · AI 사진 ${ctx.failedCuts}장은 만들지 못해 빈 자리로 두었어요. 에디터에서 다시 만들 수 있어요` : '완료',
      },
    }));
    // 움직이는 컷은 페이지를 연 뒤에도 이어서 만든다 (AI 영상은 1~3분)
    const motion = effectiveHeroMotion(input.heroMotion, heroCutOf(built)?.source ?? null);
    if (motion !== 'off') await startHeroMotion(ctx.projectId, motion).catch((err) => console.error('[lever] hero motion not started', err));
  } catch (err) {
    console.error('[lever] draft generate failed', err);
    const message = err instanceof ApiError ? err.message : '상세페이지를 만들지 못했어요. 다시 시도해주세요.';
    await updateDraft(draftId, (d) => ({ ...d, status: 'generate_failed', errorMessage: message }));
  }
}

/** POST /drafts/{id}/generate */
export async function startGenerate(draftId: string) {
  const draft = await getDraft(draftId);
  if (!draft.plan?.sections.length) throw badRequest('기획 초안에 섹션이 없습니다.');
  if (draft.status === 'generating' || draft.status === 'planning') throw badRequest('이미 진행 중인 작업이 있습니다.');
  if (draft.plan.sections.some((s) => s.cuts.some((c) => c.source === 'ai'))) await requireGemini();
  const updated = await updateDraft(draftId, (d) => ({
    ...d,
    status: 'generating',
    errorMessage: null,
    generateProgress: { current: 0, total: d.plan!.sections.length, message: '첫 섹션을 준비하고 있어요' },
  }));
  void runGenerate(draftId);
  return updated;
}
