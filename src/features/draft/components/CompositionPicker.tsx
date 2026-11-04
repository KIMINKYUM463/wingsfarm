'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { designStyleOption } from '@/shared/lib/designStyles';
import { ROUTES } from '@/shared/constants/routes';
import type { CompositionCandidate } from '@/shared/types/draft';
import { draftApi, type DraftDto, type PreviewNode } from '../api';
import { storageUrl, useDraftMutation } from '../hooks';
import { ComposeBuildingOverlay } from './ProgressDialog';
import SectionPreview, { type CutPreview } from './SectionPreview';
import { Modal } from './ui';

/**
 * 구성 후보 5안 — 섹션 목차 카드 + 클릭 시 레이아웃 미리보기 팝업 + 재조합
 */
export function CompositionPicker({ draft }: { draft: DraftDto }) {
  const candidates = draft.candidates ?? [];
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const select = useDraftMutation((candidateId: string) => draftApi.selectComposition(draft.id, candidateId));
  const reshuffle = useDraftMutation(() => draftApi.reshuffleCompositions(draft.id));
  const building = reshuffle.isPending;

  const productSrc = draft.input.productImagePaths[0]
    ? draft.imageUrls[draft.input.productImagePaths[0]] ?? storageUrl(draft.input.productImagePaths[0])
    : null;

  const cutImage = useMemo(() => {
    return (_cutId: string): CutPreview => (productSrc ? { src: productSrc } : 'ai');
  }, [productSrc]);

  if (draft.status === 'plan_failed' && !candidates.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16 text-center">
        {building && <ComposeBuildingOverlay productName={draft.input.productName} mode="compose" />}
        <p className="text-lg font-semibold text-gray-900">구성 후보를 만들지 못했어요</p>
        <p className="text-sm text-gray-500">{draft.errorMessage}</p>
        <div className="flex justify-center gap-2">
          <Link className="btn-outline text-sm" href={ROUTES.DRAFT_CREATE_FROM({ draft: draft.id })}>
            입력 수정하기
          </Link>
          <button type="button" className="btn-primary text-sm" disabled={building} onClick={() => reshuffle.mutate(undefined)}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];
  const previewCandidate = candidates.find((c) => c.id === previewId) ?? null;
  const previewFrames = (previewCandidate?.previewFrames ?? []) as PreviewNode[];

  function openPreview(candidate: CompositionCandidate) {
    setSelectedId(candidate.id);
    setPreviewId(candidate.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 pb-28">
      {building && <ComposeBuildingOverlay productName={draft.input.productName} mode="reshuffle" />}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">어떤 구성으로 만들까요?</h1>
        <p className="mt-1 text-sm text-gray-500">
          상품에 맞춰 AI가 고른 구성 5안이에요. 카드마다 색감 세트가 달라요 — 초록·남색·빨강이 한 페이지에 섞이지 않게 골랐어요.
          섹션 목록을 보고, 카드를 누르면 샘플 레이아웃 미리보기가 열려요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={c.id === selected?.id}
            onOpen={() => openPreview(c)}
          />
        ))}
      </div>

      <Modal
        open={!!previewCandidate}
        onClose={() => setPreviewId(null)}
        title={previewCandidate ? `미리보기 · ${previewCandidate.title}` : '미리보기'}
        width="max-w-md"
      >
        {previewCandidate && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>{previewCandidate.reason}</span>
              <span>{designStyleOption(previewCandidate.designStyle).name}</span>
            </div>
            <div className="flex gap-1.5">
              {(['main', 'point', 'bgLight', 'bgDark'] as const).map((role) => (
                <span
                  key={role}
                  className="h-5 w-5 rounded-full border border-black/5"
                  style={{ background: previewCandidate.palette[role] }}
                  title={role}
                />
              ))}
              <span className="ml-auto self-center text-[11px] text-gray-400">
                섹션 {previewCandidate.sectionTypeIds.length}개 ·{' '}
                {previewCandidate.lengthHint === 'extra' ? '더 긴 구성' : previewCandidate.lengthHint === 'long' ? '긴 구성' : '짧은 구성'}
              </span>
            </div>

            <div className="max-h-[55vh] overflow-y-auto rounded-xl bg-gray-100 p-4">
              {previewFrames.length ? (
                <div className="mx-auto w-[min(100%,280px)] overflow-hidden rounded-lg bg-white shadow-md">
                  {previewFrames.map((frame, i) => (
                    <div key={`${previewCandidate.id}-modal-${i}`} className="border-b border-gray-100 last:border-0">
                      <SectionPreview frame={frame} cutImage={cutImage} width={280} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto flex w-[min(100%,280px)] flex-col gap-1">
                  {previewCandidate.sectionNames.map((name, i) => (
                    <div
                      key={`${previewCandidate.id}-name-${i}`}
                      className="rounded-md bg-white px-3 py-2 text-xs text-gray-700 shadow-sm"
                    >
                      {i + 1}. {name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline text-sm" onClick={() => setPreviewId(null)}>
                닫기
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={select.isPending || building}
                onClick={() => {
                  setPreviewId(null);
                  select.mutate(previewCandidate.id);
                }}
              >
                {select.isPending ? '기획 시작 중…' : '이 구성으로 만들기'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={building || select.isPending}
            onClick={() => reshuffle.mutate(undefined)}
          >
            {building ? '구성 만드는 중…' : '다르게 재조합'}
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!selected || select.isPending || reshuffle.isPending}
            onClick={() => selected && select.mutate(selected.id)}
          >
            {select.isPending ? '기획 시작 중…' : '이 구성으로 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onOpen,
}: {
  candidate: CompositionCandidate;
  selected: boolean;
  onOpen: () => void;
}) {
  const style = designStyleOption(candidate.designStyle);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        'flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition',
        selected ? 'border-(--color-point) ring-2 ring-(--color-point)/30' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-bold text-gray-900">{candidate.title}</div>
          <div className="mt-0.5 text-xs text-gray-500">{candidate.reason}</div>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{style.name}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {(['main', 'point', 'bgLight', 'bgDark'] as const).map((role) => (
          <span key={role} className="h-5 w-5 rounded-full border border-black/5" style={{ background: candidate.palette[role] }} title={role} />
        ))}
        <span className="ml-1 text-[11px] text-gray-500">페이지 전체 동일 색감</span>
      </div>

      {/* 섹션 목차 — 어떤 섹션이 있는지 전부 표시 */}
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg bg-gray-50 p-2">
        {candidate.sectionNames.map((name, i) => (
          <div
            key={`${candidate.id}-${i}`}
            className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-[11px] text-gray-700 shadow-sm"
            style={{ minHeight: i === 0 ? 36 : 22 }}
          >
            <span className="w-4 shrink-0 text-center text-[10px] text-gray-400">{i + 1}</span>
            <span className="truncate">{name}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
        <span>
          섹션 {candidate.sectionTypeIds.length}개 · {candidate.lengthHint === 'extra' ? '더 긴 구성' : candidate.lengthHint === 'long' ? '긴 구성' : '짧은 구성'}
        </span>
        <span className="text-gray-500">미리보기 →</span>
      </div>
    </button>
  );
}
