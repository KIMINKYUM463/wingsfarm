'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import IconButton from '@/shared/ui/Button/IconButton';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { Modal } from '@/shared/ui/SimpleModal';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { queryKeys } from '@/shared/constants/queryKeys';
import { showToast } from '@/utils/toast';
import {
  createProjectVersion,
  deleteProjectVersion,
  getProjectVersions,
  restoreProjectVersion,
  type ProjectVersion,
} from '@/features/editor/api';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { loadProjectIntoCanvas } from '@/features/editor/hooks/useTemplateInitialization';

const versionsKey = (projectId: string) => [...queryKeys.EDITOR.all, 'versions', projectId] as const;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 저장 대기 중인 편집을 먼저 서버에 저장 (버전은 서버에 저장된 상태를 기준으로 남는다) */
const flushAutoSave = async () => {
  await useAutoSaveStore.getState().saveCallback?.();
};

/**
 * 버전 기록 — "저장한 시점으로 언제든 되돌릴 수 있어요"
 * - 지금 버전 저장(이름 지정) + 10분마다 남는 자동 백업 목록 → 복원
 * - 복원 직전 상태도 자동 백업으로 남아, 복원을 다시 되돌릴 수 있다
 */
export function VersionHistoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionTooltip content="버전 기록" direction="bottom">
        <IconButton icon="history" className="btn-editor p-2.25" onClick={() => setOpen(true)} aria-label="버전 기록" data-tour="editor-versions" />
      </ActionTooltip>
      <Modal open={open} onClose={() => setOpen(false)} title="버전 기록" width="max-w-lg">
        {open && <VersionHistoryBody onRestored={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function VersionHistoryBody({ onRestored }: { onRestored: () => void }) {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { openConfirm } = useDialog();
  const [label, setLabel] = useState('');

  const { data: versions, isLoading } = useQuery({
    queryKey: versionsKey(projectId),
    queryFn: () => getProjectVersions(projectId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: versionsKey(projectId) });

  const save = useMutation({
    mutationFn: async () => {
      await flushAutoSave();
      return createProjectVersion(projectId, label);
    },
    onSuccess: () => {
      setLabel('');
      showToast.success('지금 버전을 저장했어요.');
      refresh();
    },
  });

  const restore = useMutation({
    mutationFn: async (version: ProjectVersion) => {
      await flushAutoSave();
      return restoreProjectVersion(projectId, version.id);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.EDITOR.projectDetail(projectId), response);
      loadProjectIntoCanvas(response.data);
      showToast.success('선택한 버전으로 되돌렸어요. 복원 전 상태는 자동 백업에 남아 있어요.');
      refresh();
      onRestored();
    },
  });

  const remove = useMutation({
    mutationFn: (version: ProjectVersion) => deleteProjectVersion(projectId, version.id),
    onSuccess: refresh,
  });

  const confirmRestore = async (version: ProjectVersion) => {
    const confirmed = await openConfirm({
      title: '이 버전으로 되돌릴까요?',
      description: `${formatTime(version.createdAt)} · ${version.label}\n지금 상태는 자동 백업으로 남겨둘게요.`,
    });
    if (confirmed) restore.mutate(version);
  };

  const groups: { title: string; items: ProjectVersion[] }[] = [
    { title: '저장한 버전', items: versions?.filter((v) => v.kind === 'manual') ?? [] },
    { title: '자동 저장 백업', items: versions?.filter((v) => v.kind === 'auto') ?? [] },
  ];
  const busy = save.isPending || restore.isPending;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-500">저장한 시점으로 언제든 되돌릴 수 있어요. 편집하는 동안 10분마다 자동 백업도 남아요.</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder="버전 이름 (예: 1차 시안)"
          className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm focus:border-(--color-point) focus:outline-none"
        />
        <button type="submit" className="btn-primary h-10 px-4 text-sm" disabled={busy}>
          {save.isPending ? '저장 중…' : '지금 버전 저장'}
        </button>
      </form>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-gray-400">불러오는 중…</p>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-500">
              {group.title} <span className="font-normal">{group.items.length}개</span>
            </h3>
            {group.items.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-400">아직 없어요.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100">
                {group.items.map((version) => (
                  <li key={version.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{version.label}</p>
                      <p className="text-xs text-gray-400">
                        {formatTime(version.createdAt)} · 나 · 섹션 {version.frameCount}개 · {version.totalHeight.toLocaleString()}px
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline h-8 px-3 text-xs"
                      disabled={busy}
                      onClick={() => confirmRestore(version)}
                    >
                      복원
                    </button>
                    <button
                      type="button"
                      aria-label="버전 삭제"
                      className={clsx('btn-icon text-gray-300 hover:text-red-500', remove.isPending && 'opacity-50')}
                      disabled={busy || remove.isPending}
                      onClick={() => remove.mutate(version)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
