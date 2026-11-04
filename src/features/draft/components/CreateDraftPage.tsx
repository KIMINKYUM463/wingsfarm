'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import ProjectsHeader from '@/shared/ui/Header/ProjectsHeader';
import { ROUTES } from '@/shared/constants/routes';
import { PRODUCT_CATEGORIES } from '@/shared/constants/productCategories';
import { emptyDraftInput, type DraftSummary } from '@/shared/types/draft';
import { draftApi } from '../api';
import { DRAFTS_KEY, errorMessage, useDraft } from '../hooks';
import DraftForm from './DraftForm';

const STATUS_LABEL: Record<DraftSummary['status'], string> = {
  editing: '작성 중',
  composing: '구성 고르는 중',
  choosing: '구성 선택',
  planning: '기획 중',
  plan_failed: '기획 실패',
  ready: '기획 완료',
  generating: '생성 중',
  generate_failed: '생성 실패',
  completed: '완료',
};

/** /detail-page/create — 입력 폼 (?draft=초안ID 이어서 작성, ?reuse=프로젝트ID 기존 페이지 활용) */
export default function CreateDraftPage() {
  const params = useSearchParams();
  const [draftParam] = useState(() => params.get('draft'));
  const [reuseParam] = useState(() => params.get('reuse'));
  const draft = useDraft(draftParam);
  const reuse = useQuery({
    queryKey: ['draft-reuse-sources', 'all'],
    queryFn: () => draftApi.reuseSources(),
    enabled: Boolean(reuseParam),
  });

  const loading = (draftParam && draft.isLoading) || (reuseParam && reuse.isLoading);
  const reuseSource = reuse.data?.projects.find((p) => p.id === reuseParam);
  const initialInput = draft.data?.input ?? {
    ...emptyDraftInput(),
    ...(reuseParam && { startMode: 'reuse' as const, reuseSourceProjectId: reuseParam, categoryId: reuseSource?.categoryId ?? '' }),
  };

  return (
    <>
      <ProjectsHeader />
      <div className="flex-1 bg-white">
        {!draftParam && <DraftList />}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : draftParam && draft.isError ? (
          <div className="py-20 text-center text-sm text-gray-500">초안을 찾을 수 없어요.</div>
        ) : (
          <DraftForm initialDraft={draft.data ?? null} initialInput={initialInput} />
        )}
      </div>
    </>
  );
}

/** 작성 중인 초안 목록 (이어서 작성·삭제) */
function DraftList() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: DRAFTS_KEY, queryFn: draftApi.list });
  const drafts = data?.drafts ?? [];
  if (!drafts.length) return null;

  const remove = async (id: string) => {
    if (!window.confirm('이 초안을 삭제할까요?')) return;
    try {
      await draftApi.remove(id);
      await queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8">
      <div className="mb-2 text-sm font-semibold text-gray-900">작성 중인 초안</div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {drafts.map((d) => {
          const href = d.status === 'editing' ? ROUTES.DRAFT_CREATE_FROM({ draft: d.id }) : ROUTES.DRAFT(d.id);
          return (
            <div key={d.id} className="group relative flex w-56 shrink-0 gap-2 rounded-xl border border-gray-100 p-2 hover:border-gray-300">
              {/* 이어서 작성은 새로 고침해 폼 상태를 초안 값으로 다시 채운다 */}
              <a href={href} className="flex min-w-0 flex-1 gap-2">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {d.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-gray-900">{d.productName || '이름 없는 상품'}</span>
                  <span className="text-xs text-gray-500">
                    {PRODUCT_CATEGORIES.find((c) => c.id === d.categoryId)?.name ?? '카테고리 미선택'} · {STATUS_LABEL[d.status]}
                  </span>
                  <span className="text-[11px] text-gray-400">{new Date(d.updatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
              </a>
              <button type="button" aria-label="초안 삭제" onClick={() => void remove(d.id)} className="absolute top-1 right-1 hidden text-xs text-gray-400 group-hover:block">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <Link href={ROUTES.PROJECTS} className="text-xs text-gray-400 underline">
        내 프로젝트로 돌아가기
      </Link>
    </div>
  );
}
