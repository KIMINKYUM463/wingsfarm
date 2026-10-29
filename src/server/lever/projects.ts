import 'server-only';
import { generateNKeysBetween } from 'fractional-indexing';
import type { ProjectFrame } from '@/features/editor/types';
import type { Project } from '@/features/projects/types';
import type { KeywordGroup } from '@/features/detail-page/types';
import type { DraftPalette } from '@/shared/types/draft';
import type { HeroMotionInfo } from '@/shared/types/heroMotion';
import type { DesignStyleId } from '@/shared/lib/designStyles';
import { normalizePalette, recolorTree, type PaletteNode } from '@/shared/lib/palette';
import { resolveAssetUrls } from './assets';
import { findCategory } from './catalog/categories';
import { asNode, cloneWithNewIds, collectAssetIds, type FrameNode } from './frames/tree';
import { badRequest, notFound } from './http';
import { publicUrl, saveFile } from './storage';
import { listFiles, newId, nowIso, readJson, updateJson, writeJson } from './store';
import { instantiateTemplate, pickDraftTemplates, type TemplateRecord } from './templates/repo';

/** AI가 상품 정보로 정리한 컨텍스트 (문구·이미지 생성에 재사용) */
export interface ProductContext {
  summary: string;
  target: string;
  tone: string;
  sellingPoints: string[];
  keywords: string[];
}

export interface DraftLayout {
  draftId: string;
  sectionTypeIds: string[];
  palette: DraftPalette;
  /** 생성 당시 팔레트 (색상 탭 "초기화") */
  originalPalette?: DraftPalette;
  designStyle?: DesignStyleId;
}

export interface ProjectRecord {
  id: string;
  title: string;
  /** trashed: 휴지통 (복원 가능) · deleted: 영구 삭제 */
  status: 'active' | 'trashed' | 'deleted';
  productName: string;
  categoryId: string;
  description: string;
  generationJobId: string | null;
  thumbnailPath: string | null;
  thumbnailVersion?: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  productImagePaths: string[];
  context?: ProductContext;
  keywords?: KeywordGroup[];
  frames: ProjectFrame[];
  /** 초안으로 만든 페이지: 섹션 구성·색 팔레트 ("기존 페이지 활용하기"와 색상 탭에서 사용) */
  draftLayout?: DraftLayout;
  favorite?: boolean;
  /** 휴지통으로 옮긴 시각 */
  deletedAt?: string;
  /** 맨 위 움직이는 컷 */
  heroMotion?: HeroMotionRecord;
}

export type HeroMotionRecord = Omit<HeroMotionInfo, 'clipUrl'> & { clipPath: string | null; width: number; height: number };

/** 서버가 꺼져 작업이 끊기면 pending으로 남는다 → 일정 시간이 지나면 실패로 보여준다 */
const STALE_MOTION_MS = 10 * 60 * 1000;

export const isMotionRunning = (motion: HeroMotionRecord | undefined) =>
  motion?.status === 'pending' && Date.now() - Date.parse(motion.updatedAt) < STALE_MOTION_MS;

export const toHeroMotionInfo = (motion: HeroMotionRecord | undefined): HeroMotionInfo | null => {
  if (!motion) return null;
  const { clipPath, width: _w, height: _h, ...info } = motion;
  const stale = motion.status === 'pending' && !isMotionRunning(motion);
  return {
    ...info,
    status: stale ? 'failed' : motion.status,
    notice: stale ? '작업이 중간에 멈췄어요. 다시 만들어 주세요.' : motion.notice,
    clipUrl: clipPath ? publicUrl(clipPath) : null,
  };
};

const projectPath = (id: string) => `projects/${id}.json`;

async function readProject(id: string, allowTrashed: boolean) {
  const project = await readJson<ProjectRecord | null>(projectPath(id), null);
  const visible = project?.status === 'active' || (allowTrashed && project?.status === 'trashed');
  if (!project || !visible) throw notFound('프로젝트를 찾을 수 없습니다.');
  return project;
}

export const getProject = (id: string) => readProject(id, false);

/** 프로젝트 파일을 잠금 안에서 수정 (allowTrashed: 휴지통 복원·영구 삭제용) */
export async function updateProject(
  id: string,
  mutate: (project: ProjectRecord) => ProjectRecord | Promise<ProjectRecord>,
  { allowTrashed = false } = {},
) {
  await readProject(id, allowTrashed);
  return updateJson<ProjectRecord | null, ProjectRecord>(
    projectPath(id),
    null,
    async (current) => ({ ...(await mutate(current!)), updatedAt: nowIso() }),
    (next) => next!,
  );
}

export const saveNewProject = (project: ProjectRecord) => writeJson(projectPath(project.id), project);

export const sortFrames = (frames: ProjectFrame[]) =>
  [...frames].sort((a, b) => (a.frameOrder < b.frameOrder ? -1 : a.frameOrder > b.frameOrder ? 1 : 0));

/** 템플릿 → 프로젝트 프레임 행 (palette가 있으면 팔레트 역할이 달린 요소를 그 색으로 칠한다) */
export async function buildTemplateFrame(
  projectId: string,
  template: TemplateRecord,
  frameOrder: string,
  frameId: string = newId(),
  palette?: DraftPalette,
): Promise<ProjectFrame> {
  const data = await instantiateTemplate(template, frameId);
  const frameData = palette ? recolorTree(data.frameData as PaletteNode, palette) : data.frameData;
  const now = nowIso();
  return {
    id: frameId,
    projectId,
    figmaId: data.figmaId,
    templateId: data.templateId,
    part1: data.part1,
    part2: data.part2,
    hasTemplatePart: true,
    status: 'active',
    frameOrder,
    frameName: data.frameName,
    frameData: frameData as unknown as ProjectFrame['frameData'],
    width: data.width,
    height: data.height,
    createdAt: now,
    updatedAt: now,
  };
}

export const frameAssetUrls = (frames: ProjectFrame[]) =>
  resolveAssetUrls(collectAssetIds(frames.filter((f) => f.status === 'active').map((f) => asNode(f.frameData))));

/** POST /projects — 상품명·카테고리로 초안 프로젝트 생성 (구성별 템플릿 1개씩) */
export async function createProject(body: { productName?: string; categoryId?: string }) {
  const productName = body.productName?.trim();
  if (!productName) throw badRequest('상품명을 입력해주세요.');
  if (!findCategory(body.categoryId)) throw badRequest('카테고리를 선택해주세요.');

  const id = newId();
  const templates = await pickDraftTemplates(body.categoryId!);
  const orders = generateNKeysBetween(null, null, templates.length);
  const frames = await Promise.all(templates.map((t, i) => buildTemplateFrame(id, t, orders[i])));
  const now = nowIso();

  await saveNewProject({
    id,
    title: productName,
    status: 'active',
    productName,
    categoryId: body.categoryId!,
    description: '',
    generationJobId: null,
    thumbnailPath: null,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
    productImagePaths: [],
    frames,
  });
  return { id, status: 'active', message: '초안 프로젝트가 생성되었습니다.' };
}

const toProjectDto = (p: ProjectRecord): Project => ({
  id: p.id,
  title: p.title,
  status: p.status,
  productName: p.productName,
  categoryId: p.categoryId,
  description: p.description,
  generationJobId: p.generationJobId ?? '',
  thumbnailUrl: p.thumbnailPath ? `${publicUrl(p.thumbnailPath)}?v=${p.thumbnailVersion ?? 0}` : null,
  viewCount: p.viewCount,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  favorite: Boolean(p.favorite),
  deletedAt: p.deletedAt ?? null,
  reusable: Boolean(p.draftLayout),
});

export async function listProjectRecords(status: ProjectRecord['status'] = 'active') {
  const files = (await listFiles('projects')).filter((f) => f.endsWith('.json'));
  const records = await Promise.all(files.map((f) => readJson<ProjectRecord | null>(`projects/${f}`, null)));
  return records.filter((p): p is ProjectRecord => p?.status === status);
}

const SORT_FIELDS = { createdAt: 'createdAt', updatedAt: 'updatedAt', title: 'title' } as const;

/** GET /projects (검색·정렬·커서 페이지네이션 · filter=favorite|trash) */
export async function listProjects(query: URLSearchParams) {
  const search = query.get('search')?.trim().toLowerCase();
  const filter = query.get('filter');
  const sortBy = SORT_FIELDS[(query.get('sortBy') ?? 'updatedAt') as keyof typeof SORT_FIELDS] ?? 'updatedAt';
  const direction = query.get('sortOrder') === 'asc' ? 1 : -1;
  const limit = Math.min(Math.max(Number(query.get('limit')) || 20, 1), 50);
  const offset = Number(Buffer.from(query.get('cursor') ?? '', 'base64').toString() || 0);

  const projects = (await listProjectRecords(filter === 'trash' ? 'trashed' : 'active'))
    .filter((p) => filter !== 'favorite' || p.favorite)
    .filter((p) => !search || p.title.toLowerCase().includes(search) || p.productName.toLowerCase().includes(search))
    .sort((a, b) => direction * a[sortBy].localeCompare(b[sortBy], 'ko'));

  const page = projects.slice(offset, offset + limit);
  const next = offset + page.length;
  return {
    projects: page.map(toProjectDto),
    total: projects.length,
    ...(next < projects.length && { nextCursor: Buffer.from(String(next)).toString('base64') }),
  };
}

/** 에디터가 받는 프로젝트 상세 (조회·버전 복원이 함께 사용) */
export async function toProjectDetail(project: ProjectRecord) {
  const frames = sortFrames(project.frames);
  return {
    ...toProjectDto(project),
    frames,
    viewCount: project.viewCount,
    isFirstView: project.viewCount === 1,
    assetUrls: await frameAssetUrls(frames),
    productName: project.productName,
    categoryName: findCategory(project.categoryId)?.name ?? '',
    palette: project.draftLayout?.palette ?? null,
    originalPalette: project.draftLayout ? (project.draftLayout.originalPalette ?? project.draftLayout.palette) : null,
    heroMotion: toHeroMotionInfo(project.heroMotion),
  };
}

/** GET /projects/{id} — 에디터 데이터 (최초 조회 여부 포함) */
export async function getProjectDetail(id: string) {
  return toProjectDetail(await updateProject(id, (p) => ({ ...p, viewCount: p.viewCount + 1 })));
}

type ProjectPatch = Partial<Pick<ProjectRecord, 'title' | 'productName' | 'categoryId' | 'description' | 'favorite'>> & {
  palette?: Partial<DraftPalette>;
};

export async function patchProject(id: string, body: ProjectPatch) {
  if (body.title !== undefined && !body.title.trim()) throw badRequest('프로젝트 제목을 입력해주세요.');
  const project = await updateProject(id, (p) => {
    if (body.palette && !p.draftLayout) throw badRequest('AI 초안으로 만든 페이지에서만 색상을 바꿀 수 있어요.');
    return {
      ...p,
      ...(body.title !== undefined && { title: body.title.trim().slice(0, 100) }),
      ...(body.productName != null && { productName: body.productName.slice(0, 100) }),
      ...(body.categoryId != null && { categoryId: body.categoryId }),
      ...(body.description != null && { description: body.description.slice(0, 1000) }),
      ...(body.favorite !== undefined && { favorite: Boolean(body.favorite) }),
      ...(body.palette &&
        p.draftLayout && { draftLayout: { ...p.draftLayout, palette: normalizePalette(body.palette, p.draftLayout.palette) } }),
    };
  });
  return toProjectDto(project);
}

/** DELETE /projects/{id} — 휴지통으로 (permanent=true면 휴지통에서 영구 삭제) */
export async function deleteProject(id: string, permanent: boolean) {
  const project = await updateProject(
    id,
    (p) => (permanent ? { ...p, status: 'deleted' } : { ...p, status: 'trashed', deletedAt: nowIso() }),
    { allowTrashed: permanent },
  );
  return toProjectDto(project);
}

/** POST /projects/{id}/restore — 휴지통에서 꺼내기 */
export async function restoreProject(id: string) {
  const project = await updateProject(id, ({ deletedAt: _removed, ...p }) => ({ ...p, status: 'active' }), { allowTrashed: true });
  return toProjectDto(project);
}

/** POST /projects/{id}/duplicate — 사본 만들기 (프레임·요소 id는 새로 발급) */
export async function duplicateProject(id: string) {
  const source = await getProject(id);
  const now = nowIso();
  const copy: ProjectRecord = {
    ...source,
    id: newId(),
    title: `${source.title} (사본)`.slice(0, 100),
    generationJobId: null,
    viewCount: 0,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    frames: [],
    // 사본은 요소 id가 새로 발급돼 원본의 움직이는 컷과 연결되지 않는다
    heroMotion: undefined,
  };
  copy.frames = source.frames.map((frame) => {
    const frameId = newId();
    const frameData = frame.status === 'active' ? cloneWithNewIds(asNode(frame.frameData), frameId) : {};
    return { ...frame, id: frameId, projectId: copy.id, frameData: frameData as ProjectFrame['frameData'], createdAt: now, updatedAt: now };
  });
  await saveNewProject(copy);
  return toProjectDto(copy);
}

/** PUT /projects/{id}/thumbnail (multipart file) */
export async function saveThumbnail(id: string, req: Request) {
  const file = (await req.formData()).get('file');
  if (!(file instanceof Blob)) throw badRequest('썸네일 파일이 없습니다.');
  const path = `projects/${id}/thumbnail.webp`;
  await saveFile(path, Buffer.from(await file.arrayBuffer()));
  const project = await updateProject(id, (p) => ({ ...p, thumbnailPath: path, thumbnailVersion: Date.now() }));
  return { thumbnailUrl: toProjectDto(project).thumbnailUrl };
}

/** 이전 버전 호환: frames의 frameData를 서버 노드로 */
export const frameNodes = (frames: ProjectFrame[]): FrameNode[] =>
  frames.filter((f) => f.status === 'active').map((f) => asNode(f.frameData));
