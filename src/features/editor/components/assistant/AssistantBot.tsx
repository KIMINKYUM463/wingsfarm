'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import Icon from '@/shared/ui/Icon';
import Spinner from '@/shared/ui/Spinner/Spinner';
import { errorMessage } from '@/shared/lib/errorMessage';
import type { KonvaTextElement } from '@/shared/types/konva';
import type { SectionReviewResult } from '@/shared/types/sectionReview';
import { reviewSection } from '@/features/editor/api';
import { useCenteredFrameId } from '@/features/editor/hooks/useCenteredFrameId';
import { frameNameOf } from '@/features/editor/lib/chat-canvas';
import { findVisibleLeaves } from '@/features/editor/lib/element-finder';
import { blobToDataUrl, renderFrameJpeg } from '@/features/editor/lib/frameImage';
import { buildFixMessage, checkSection, splitFixes, type SectionNote } from '@/features/editor/lib/sectionCheck';
import { useAiChatStore, type ChatTurn } from '@/features/editor/store/useAiChatStore';
import { ChangeList, RevertButton, WarningBox } from '@/features/editor/components/chat/ChatResultParts';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useDraggableDock } from './useDraggableDock';

const ROBOT_SIZE = 56;
/** 처음 자리: 오른쪽 구성 목록(272px + 간격)을 가리지 않는 캔버스 오른쪽 아래 */
const DEFAULT_DOCK = { right: 296, bottom: 80 };
const POSITION_KEY = 'wf-assistant-position';
const TOUR_KEY = 'wf-assistant-tour-done';
/** AI 평가에 보내는 섹션 그림 배율 (860px → 약 520px, 용량을 줄이되 글자는 읽히게) */
const REVIEW_PIXEL_RATIO = 0.6;
/** 섹션이 바뀌면 잠깐 띄우는 한 줄 안내 시간 */
const HINT_MS = 4000;
/** 말풍선과 로봇 사이(mb-3) + 화면 가장자리 여유 */
const BUBBLE_GAP = 24;

const TOUR = [
  { title: '안녕하세요, AI 도우미예요', text: '상세페이지 만들기를 옆에서 도와드릴게요. 저는 마우스로 끌어서 아무 데나 옮길 수 있어요.' },
  { title: '고치는 법', text: '글자는 두 번 눌러 바로 고치고, 왼쪽 탭에서 템플릿·글자·사진·요소를 더할 수 있어요.' },
  { title: '같이 보면서 알려 드려요', text: '화면을 내리면 지금 보고 있는 섹션을 같이 보면서 잘된 점과 고칠 점을 알려 드려요.' },
  { title: '마무리', text: '다 만들면 위쪽 "미리보기"로 이어 붙여 확인하고 "다운로드"로 받으면 끝이에요.' },
];

type Review = { status: 'loading' } | { status: 'done'; result: SectionReviewResult } | { status: 'error'; error: string };

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

/**
 * 에디터 오른쪽 아래에 떠 있는 AI 도우미 로봇
 * - 처음 온 사람에게 사용법을 말풍선으로 안내한다
 * - 지금 보고 있는 섹션의 기본 점검(무료·즉시)과, 누르면 AI 평가(섹션 그림+문구)를 보여 준다
 * - 문구로 고칠 수 있는 점은 "한 번에 반영"(또는 "이것만 반영")으로 캔버스에 바로 고치고, 바뀐 내용을 정리해 보여 준다
 */
export function AssistantBot() {
  const { id: projectId } = useParams<{ id: string }>();
  const [open, setOpen] = useState(() => !readFlag(TOUR_KEY));
  const [tourStep, setTourStep] = useState<number | null>(() => (readFlag(TOUR_KEY) ? null : 0));
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  /** 섹션별 마지막 "반영" 요청 id */
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [hint, setHint] = useState<string | null>(null);
  const hinted = useRef(new Set<string>());

  const { offset, handlers } = useDraggableDock(POSITION_KEY, ROBOT_SIZE, DEFAULT_DOCK, () => setOpen((v) => !v));

  const frameId = useCenteredFrameId();
  const frames = useCanvasDataStore((state) => state.frames);
  const activeFrames = frames.filter((f) => f.status === 'active');
  const index = activeFrames.findIndex((f) => f.id === frameId);
  const frame = index >= 0 ? activeFrames[index] : null;
  const name = frameNameOf(frameId) ?? '섹션';
  const notes = frame ? checkSection(frame.children) : [];
  const fixCount = notes.filter((n) => n.tone === 'fix').length;
  const review = frameId ? reviews[frameId] : undefined;
  const appliedTurnId = frameId ? applied[frameId] : undefined;
  const appliedTurn = useAiChatStore((state) => state.turns.find((t) => t.id === appliedTurnId));

  // 섹션이 바뀌면 고칠 점이 있을 때 한 번만 짧게 알려 준다 (말풍선이 닫혀 있을 때)
  useEffect(() => {
    if (open || !frameId || !fixCount || hinted.current.has(frameId)) return;
    hinted.current.add(frameId);
    setHint(`"${name}"에서 확인할 게 ${fixCount}개 있어요`);
    const timer = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [frameId, fixCount, open, name]);

  const finishTour = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setTourStep(null);
  };

  // 이 섹션의 고칠 점 = 기본 점검 + AI 평가 → AI가 고칠 것 / 직접 할 것
  const reviewTips = review?.status === 'done' ? review.result.improve.map((tip) => ({ text: tip.point, fixRequest: tip.fixRequest })) : [];
  const fixes = splitFixes([...notes.filter((n) => n.tone === 'fix'), ...reviewTips]);

  /** 고치기 요청을 AI 편집 도우미 대기열에 넣어 이 섹션에 바로 반영한다 (채팅 기록에도 남는다) */
  const applyFixes = (requests: string[]) => {
    if (!frameId || !requests.length) return;
    const turnId = useAiChatStore.getState().enqueue({ message: buildFixMessage(requests), scopeFrameId: frameId, scopeName: name });
    setApplied((prev) => ({ ...prev, [frameId]: turnId }));
  };

  const requestReview = async () => {
    if (!frame || !frameId) return;
    setReviews((prev) => ({ ...prev, [frameId]: { status: 'loading' } }));
    try {
      const blob = await renderFrameJpeg(frame, REVIEW_PIXEL_RATIO, 0.8);
      const texts = (findVisibleLeaves(frame.children, (e) => e.type === 'text') as KonvaTextElement[])
        .filter((t) => t.text?.trim())
        .map((t) => ({ text: t.text, fontSize: t.fontSize }));
      const result = await reviewSection(projectId, {
        name,
        index,
        total: activeFrames.length,
        texts,
        image: blob ? await blobToDataUrl(blob) : undefined,
      });
      setReviews((prev) => ({ ...prev, [frameId]: { status: 'done', result } }));
    } catch (error) {
      setReviews((prev) => ({ ...prev, [frameId]: { status: 'error', error: errorMessage(error) } }));
    }
  };

  // 말풍선은 위·아래 중 공간이 넓은 쪽으로 열고, 그 공간에 맞춰 높이를 줄인다
  const spaceAbove = window.innerHeight - offset.bottom - ROBOT_SIZE;
  const bubbleAbove = spaceAbove >= offset.bottom;
  const bubbleMaxHeight = Math.min(window.innerHeight * 0.6, (bubbleAbove ? spaceAbove : offset.bottom) - BUBBLE_GAP);
  const bubbleAlignRight = offset.right < window.innerWidth / 2;

  return (
    <div className="fixed z-[60]" style={{ right: offset.right, bottom: offset.bottom, width: ROBOT_SIZE, height: ROBOT_SIZE }}>
      {(open || hint) && (
        <div
          className={clsx(
            'absolute w-80 animate-rise-in rounded-2xl border border-gray-100 bg-white text-sm shadow-xl',
            bubbleAbove ? 'bottom-full mb-3' : 'top-full mt-3',
            bubbleAlignRight ? 'right-0' : 'left-0',
          )}
        >
          {open ? (
            <div className="flex flex-col" style={{ maxHeight: bubbleMaxHeight }}>
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">AI 도우미</p>
                  {tourStep === null && frame && (
                    <p className="truncate text-xs text-gray-500">
                      지금 보는 섹션 · {name} ({index + 1}/{activeFrames.length})
                    </p>
                  )}
                </div>
                <button type="button" aria-label="말풍선 닫기" className="btn-icon text-gray-400" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {tourStep !== null ? (
                  <TourCard step={tourStep} onNext={() => (tourStep < TOUR.length - 1 ? setTourStep(tourStep + 1) : finishTour())} onSkip={finishTour} />
                ) : !frame ? (
                  <p className="text-gray-500">섹션을 화면 가운데로 옮기면 같이 볼게요.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <section>
                      <p className="mb-1.5 text-xs font-semibold text-gray-500">기본 점검</p>
                      <NoteList notes={notes} onFix={(request) => applyFixes([request])} />
                    </section>

                    <section>
                      <p className="mb-1.5 text-xs font-semibold text-gray-500">AI 평가</p>
                      {!review || review.status === 'error' ? (
                        <>
                          {review?.status === 'error' && <p className="mb-2 text-xs text-red-500">{review.error}</p>}
                          <button type="button" className="btn-primary w-full text-sm" onClick={() => void requestReview()}>
                            ✦ 이 섹션 평가받기
                          </button>
                          <p className="mt-1 text-center text-[11px] text-gray-400">섹션 그림과 문구를 보고 등록한 AI 키로 한 번 평가해요</p>
                        </>
                      ) : review.status === 'loading' ? (
                        <p className="flex items-center gap-2 text-gray-500">
                          <Spinner size={16} /> 섹션을 살펴보는 중…
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-gray-800">{review.result.summary}</p>
                          <NoteList
                            notes={[
                              ...review.result.good.map((text) => ({ tone: 'good' as const, text })),
                              ...review.result.improve.map((tip) => ({ tone: 'fix' as const, text: tip.point, fixRequest: tip.fixRequest })),
                            ]}
                            onFix={(request) => applyFixes([request])}
                          />
                          <button type="button" className="self-start text-xs text-gray-400 underline" onClick={() => void requestReview()}>
                            고친 뒤 다시 평가받기
                          </button>
                        </div>
                      )}
                    </section>

                    <ApplySection turn={appliedTurn} autoCount={fixes.auto.length} manual={fixes.manual} onApply={() => applyFixes(fixes.auto)} />
                  </div>
                )}
              </div>

              {tourStep === null && (
                <button type="button" className="border-t border-gray-100 py-2 text-xs text-gray-400 hover:text-gray-600" onClick={() => setTourStep(0)}>
                  사용법 다시 보기
                </button>
              )}
            </div>
          ) : (
            <p className="px-4 py-2.5 text-gray-800">{hint}</p>
          )}
        </div>
      )}

      <button
        type="button"
        aria-label="AI 도우미"
        title="AI 도우미 (끌어서 옮길 수 있어요)"
        className="relative flex h-full w-full cursor-grab touch-none items-center justify-center rounded-full bg-(--color-point) text-white shadow-lg ring-4 ring-white active:cursor-grabbing"
        {...handlers}
      >
        <span className={clsx('flex', !open && 'animate-bob')}>
          <Icon name="smart_toy" width={30} fill />
        </span>
        {!open && fixCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold">
            {fixCount}
          </span>
        )}
      </button>
    </div>
  );
}

function TourCard({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const last = step === TOUR.length - 1;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-semibold text-gray-900">{TOUR[step].title}</p>
        <p className="mt-1 leading-6 text-gray-600">{TOUR[step].text}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {step + 1} / {TOUR.length}
        </span>
        <div className="flex gap-2">
          {!last && (
            <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={onSkip}>
              건너뛰기
            </button>
          )}
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={onNext}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 고칠 점 한 번에 반영 → 정리된 결과(바뀐 문구 전·후, 되돌리기, 사실 확인 경고, 직접 할 일) */
function ApplySection({ turn, autoCount, manual, onApply }: { turn?: ChatTurn; autoCount: number; manual: string[]; onApply: () => void }) {
  if (!turn && !autoCount && !manual.length) return null;
  const busy = turn?.status === 'queued' || turn?.status === 'running';
  const result = turn?.status === 'done' && !turn.reverted ? turn.result : undefined;

  return (
    <section className="rounded-xl bg-(--color-point)/5 p-3">
      <p className="mb-1.5 text-xs font-semibold text-gray-500">반영하기</p>
      {busy ? (
        <p className="flex items-center gap-2 text-gray-600">
          <Spinner size={16} /> 고칠 점을 상세페이지에 반영하는 중…
        </p>
      ) : result && turn ? (
        <div className="flex flex-col gap-2">
          <p className="text-gray-800">{result.reply}</p>
          {result.changes.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">✓ 바뀐 문구 {result.changes.length}개</span>
                <RevertButton turn={turn} />
              </div>
              <ChangeList changes={result.changes} />
            </>
          )}
          <WarningBox warnings={result.warnings} />
          {autoCount > 0 && (
            <button type="button" className="self-start text-xs font-semibold text-(--color-point)" onClick={onApply}>
              남은 고칠 점 {autoCount}개 다시 반영 →
            </button>
          )}
        </div>
      ) : (
        <>
          {turn?.status === 'error' && <p className="mb-2 text-xs text-red-500">{turn.error}</p>}
          {turn?.reverted && <p className="mb-2 text-xs text-gray-400">반영한 내용을 되돌렸어요.</p>}
          {autoCount > 0 ? (
            <>
              <button type="button" className="btn-primary w-full text-sm" onClick={onApply}>
                ✦ 고칠 점 {autoCount}개 한 번에 반영
              </button>
              <p className="mt-1 text-center text-[11px] text-gray-400">문구·글자 크기·정렬을 바로 고쳐요 · 되돌리기 가능</p>
            </>
          ) : (
            <p className="text-xs text-gray-500">AI가 문구로 고칠 점은 없어요.</p>
          )}
        </>
      )}
      {manual.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-gray-500">직접 해 주세요</p>
          <ul className="list-disc pl-4 text-xs leading-5 text-gray-600">
            {manual.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function NoteList({ notes, onFix }: { notes: SectionNote[]; onFix: (fixRequest: string) => void }) {
  if (!notes.length) return <p className="text-gray-500">따로 짚을 게 없어요.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {notes.map((note) => (
        <li key={`${note.tone}-${note.text}`} className="flex gap-2">
          <Icon
            name={note.tone === 'good' ? 'check_circle' : 'error'}
            width={18}
            fill
            className={clsx('mt-0.5 shrink-0', note.tone === 'good' ? 'text-emerald-500' : 'text-amber-500')}
          />
          <div className="min-w-0 flex-1">
            <p className="leading-5 text-gray-700">{note.text}</p>
            {note.fixRequest && (
              <button type="button" className="mt-0.5 text-xs font-semibold text-(--color-point)" onClick={() => onFix(note.fixRequest!)}>
                이것만 반영 →
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
