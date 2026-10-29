import 'server-only';
import { generateNKeysBetween } from 'fractional-indexing';
import type { ProjectFrame } from '@/features/editor/types';
import type { Project } from '@/features/projects/types';
import type { KeywordGroup } from '@/features/detail-page/types';
import { resolveAssetUrls } from './assets';
import { findCategory } from './catalog/categories';
import { asNode, collectAssetIds, type FrameNode } from './frames/tree';
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

export interface ProjectRecord {
  id: string;
  title: string;
  status: 'active' | 'deleted';
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
}

const projectPath = (id: string) => `projects/${id}.json`;

export async function getProject(id: string) {
  const project = await readJson<ProjectRecord | null>(projectPath(id), null);
  if (!project || project.status === 'deleted') throw notFound('프로젝트를 찾을 수 없습니다.');
  return project;
}

/** 프로젝트 파일을 잠금 안에서 수정 */
export async function updateProject(id: string, mutate: (project: ProjectRecord) => ProjectRecord | Promise<ProjectRecord>) {
  await getProject(id);
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

/** 템플릿 → 프로젝트 프레임 행 */
export async function buildTemplateFrame(
  projectId: string,
  template: TemplateRecord,
  frameOrder: string,
  frameId: string = newId(),
): Promise<ProjectFrame> {
  const data = await instantiateTemplate(template, frameId);
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
    frameData: data.frameData as unknown as ProjectFrame['frameData'],
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
});

const SORT_FIELDS = { createdAt: 'createdAt', updatedAt: 'updatedAt', title: 'title' } as const;

/** GET /projects (검색·정렬·커서 페이지네이션) */
export async function listProjects(query: URLSearchParams) {
  const search = query.get('search')?.trim().toLowerCase();
  const sortBy = SORT_FIELDS[(query.get('sortBy') ?? 'updatedAt') as keyof typeof SORT_FIELDS] ?? 'updatedAt';
  const direction = query.get('sortOrder') === 'asc' ? 1 : -1;
  const limit = Math.min(Math.max(Number(query.get('limit')) || 20, 1), 50);
  const offset = Number(Buffer.from(query.get('cursor') ?? '', 'base64').toString() || 0);

  const files = (await listFiles('projects')).filter((f) => f.endsWith('.json'));
  const projects = (await Promise.all(files.map((f) => readJson<ProjectRecord | null>(`projects/${f}`, null))))
    .filter((p): p is ProjectRecord => p?.status === 'active')
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

/** GET /projects/{id} — 에디터 데이터 (최초 조회 여부 포함) */
export async function getProjectDetail(id: string) {
  const project = await updateProject(id, (p) => ({ ...p, viewCount: p.viewCount + 1 }));
  const frames = sortFrames(project.frames);
  return {
    ...toProjectDto(project),
    frames,
    viewCount: project.viewCount,
    isFirstView: project.viewCount === 1,
    assetUrls: await frameAssetUrls(frames),
    productName: project.productName,
    categoryName: findCategory(project.categoryId)?.name ?? '',
  };
}

export async function patchProject(id: string, body: Partial<Pick<ProjectRecord, 'title' | 'productName' | 'categoryId' | 'description'>>) {
  if (body.title !== undefined && !body.title.trim()) throw badRequest('프로젝트 제목을 입력해주세요.');
  const project = await updateProject(id, (p) => ({
    ...p,
    ...(body.title !== undefined && { title: body.title.trim().slice(0, 100) }),
    ...(body.productName != null && { productName: body.productName.slice(0, 100) }),
    ...(body.categoryId != null && { categoryId: body.categoryId }),
    ...(body.description != null && { description: body.description.slice(0, 1000) }),
  }));
  return toProjectDto(project);
}

export const deleteProject = (id: string) => updateProject(id, (p) => ({ ...p, status: 'deleted' }));

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
