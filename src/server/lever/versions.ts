import 'server-only';
import { createHash } from 'node:crypto';
import type { ProjectFrame } from '@/features/editor/types';
import type { DraftPalette } from '@/shared/types/draft';
import { badRequest, notFound } from './http';
import { getProject, toProjectDetail, updateProject } from './projects';
import { newId, nowIso, readJson, removeData, withLock, writeJson } from './store';

/**
 * 버전 기록 — "저장한 시점으로 언제든 되돌릴 수 있어요"
 *
 * - manual: 사용자가 "지금 버전 저장"으로 남긴 버전 (이름 지정 가능)
 * - auto: 편집 저장 직전에 10분마다 남기는 자동 백업 (최근 30개만 보관)
 * - 복원하기 전에는 현재 상태를 자동 백업으로 남겨, 복원도 되돌릴 수 있다
 */
export type VersionKind = 'manual' | 'auto';

export interface VersionMeta {
  id: string;
  kind: VersionKind;
  label: string;
  createdAt: string;
  frameCount: number;
  totalHeight: number;
  hash: string;
}

interface VersionSnapshot {
  frames: ProjectFrame[];
  palette: DraftPalette | null;
}

const AUTO_INTERVAL_MS = 10 * 60 * 1000;
const MAX_AUTO_VERSIONS = 30;
const LABEL_MAX = 40;

const dir = (projectId: string) => `project-versions/${projectId}`;
const indexPath = (projectId: string) => `${dir(projectId)}/index.json`;
const snapshotPath = (projectId: string, versionId: string) => `${dir(projectId)}/${versionId}.json`;

const readIndex = (projectId: string) => readJson<VersionMeta[]>(indexPath(projectId), []);
const hashOf = (snapshot: VersionSnapshot) => createHash('sha1').update(JSON.stringify(snapshot)).digest('hex');

/** GET /projects/{id}/versions (최신순) */
export async function listVersions(projectId: string) {
  await getProject(projectId);
  return { versions: await readIndex(projectId) };
}

async function writeVersion(projectId: string, kind: VersionKind, label: string, { force = false } = {}) {
  const project = await getProject(projectId);
  const snapshot: VersionSnapshot = { frames: project.frames, palette: project.draftLayout?.palette ?? null };
  const hash = hashOf(snapshot);
  const index = await readIndex(projectId);

  if (!force && kind === 'auto') {
    const lastAuto = index.find((v) => v.kind === 'auto');
    if (lastAuto && Date.now() - Date.parse(lastAuto.createdAt) < AUTO_INTERVAL_MS) return null;
  }
  if (kind === 'auto' && index[0]?.hash === hash) return null;

  const active = project.frames.filter((f) => f.status === 'active');
  const meta: VersionMeta = {
    id: newId(),
    kind,
    label,
    createdAt: nowIso(),
    frameCount: active.length,
    totalHeight: active.reduce((sum, f) => sum + (f.height ?? 0), 0),
    hash,
  };
  await writeJson(snapshotPath(projectId, meta.id), snapshot);

  const autos = index.filter((v) => v.kind === 'auto');
  const pruned = kind === 'auto' ? autos.slice(MAX_AUTO_VERSIONS - 1) : [];
  await Promise.all(pruned.map((v) => removeData(snapshotPath(projectId, v.id))));
  const prunedIds = new Set(pruned.map((v) => v.id));
  await writeJson(indexPath(projectId), [meta, ...index.filter((v) => !prunedIds.has(v.id))]);
  return meta;
}

/** 같은 프로젝트의 버전 작업은 한 줄로 (자동 저장이 여러 섹션을 동시에 저장해도 백업은 1개) */
const lockVersions = <T>(projectId: string, task: () => Promise<T>) => withLock(`versions:${projectId}`, task);

/** POST /projects/{id}/versions — 지금 버전 저장 */
export async function createVersion(projectId: string, body: { label?: string }) {
  const label = String(body?.label ?? '').trim().slice(0, LABEL_MAX) || '저장한 버전';
  return lockVersions(projectId, async () => (await writeVersion(projectId, 'manual', label, { force: true }))!);
}

/** 편집 저장 직전 자동 백업 (실패해도 편집 저장은 계속) */
export async function autoBackup(projectId: string) {
  try {
    await lockVersions(projectId, () => writeVersion(projectId, 'auto', '자동 저장 백업'));
  } catch (err) {
    console.error('[lever] auto backup failed', projectId, err);
  }
}

/** POST /projects/{id}/versions/{versionId}/restore — 복원 후 에디터 데이터를 돌려준다 */
export async function restoreVersion(projectId: string, versionId: string) {
  return lockVersions(projectId, async () => {
    const meta = (await readIndex(projectId)).find((v) => v.id === versionId);
    const snapshot = meta && (await readJson<VersionSnapshot | null>(snapshotPath(projectId, versionId), null));
    if (!snapshot) throw notFound('버전을 찾을 수 없습니다.');

    await writeVersion(projectId, 'auto', '복원 전 자동 백업', { force: true });
    const project = await updateProject(projectId, (p) => ({
      ...p,
      frames: snapshot.frames,
      ...(p.draftLayout && snapshot.palette && { draftLayout: { ...p.draftLayout, palette: snapshot.palette } }),
    }));
    return toProjectDetail(project);
  });
}

/** DELETE /projects/{id}/versions/{versionId} */
export async function deleteVersion(projectId: string, versionId: string) {
  return lockVersions(projectId, async () => {
    const index = await readIndex(projectId);
    if (!index.some((v) => v.id === versionId)) throw badRequest('이미 삭제된 버전입니다.');
    await removeData(snapshotPath(projectId, versionId));
    await writeJson(indexPath(projectId), index.filter((v) => v.id !== versionId));
    return { id: versionId };
  });
}
