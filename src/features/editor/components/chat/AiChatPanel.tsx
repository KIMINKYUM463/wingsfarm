'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Icon from '@/shared/ui/Icon';
import { showToast } from '@/utils/toast';
import { errorMessage } from '@/shared/lib/errorMessage';
import { chatEditProject } from '@/features/editor/api';
import { useProjectDetail } from '@/features/editor/hooks/useProjectDetail';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAiChatStore, type ChatTurn } from '@/features/editor/store/useAiChatStore';
import { applyChatChanges, collectCanvasTexts, frameNameOf, revertChatChanges } from '@/features/editor/lib/chat-canvas';
import { useCenteredFrameId } from '@/features/editor/hooks/useCenteredFrameId';

/** 추천 칩 — 문구·구성 수정과 궁금한 것 */
const SUGGESTIONS = ['문구 더 짧게', '질문형 제목으로', '영어로 번역', '제목 가운데 정렬하고 크게', '수정 비용이 드나요?'];

/** 대기열 처리 — 한 번에 하나씩, 보낸 순서대로 */
function useChatRunner(projectId: string) {
  const turns = useAiChatStore((state) => state.turns);
  const updateTurn = useAiChatStore((state) => state.updateTurn);
  const running = turns.some((t) => t.status === 'running');
  const next = turns.find((t) => t.status === 'queued');

  useEffect(() => {
    if (running || !next) return;
    updateTurn(next.id, { status: 'running' });
    const history = turns
      .filter((t) => t.status === 'done' && t.result)
      .flatMap((t) => [
        { role: 'user' as const, text: t.message },
        { role: 'assistant' as const, text: t.result!.reply },
      ]);
    chatEditProject(projectId, { message: next.message, scopeFrameId: next.scopeFrameId, frames: collectCanvasTexts(), history })
      .then((result) => {
        applyChatChanges(result.changes);
        updateTurn(next.id, { status: 'done', result });
      })
      .catch((error) => updateTurn(next.id, { status: 'error', error: errorMessage(error) }));
  }, [running, next, turns, projectId, updateTurn]);
}

/**
 * AI 채팅 수정 패널 (에디터 오른쪽)
 * - "이 페이지 문구 더 짧게"처럼 말하면 AI가 캔버스 문구를 직접 고친다
 * - 범위 칩: 지금 보고 있는 페이지만 / ×로 해제하면 문서 전체
 * - 결과 카드: 바뀐 문구 보기 · 되돌리기 · 근거 없는 주장 경고 · 후속 제안
 */
export function AiChatPanel() {
  const { id: projectId } = useParams<{ id: string }>();
  const open = useAiChatStore((state) => state.open);
  const setOpen = useAiChatStore((state) => state.setOpen);
  const turns = useAiChatStore((state) => state.turns);
  const enqueue = useAiChatStore((state) => state.enqueue);
  const reset = useAiChatStore((state) => state.reset);
  const { data: project } = useProjectDetail(projectId);
  const frameCount = useCanvasDataStore((state) => state.frames.filter((f) => f.status === 'active').length);
  const centeredFrameId = useCenteredFrameId();
  const [wholeDocument, setWholeDocument] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useChatRunner(projectId);

  const scopeName = wholeDocument ? null : frameNameOf(centeredFrameId);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  if (!open) return null;

  const send = (message: string) => {
    const text = message.trim();
    if (!text) return;
    enqueue({ message: text, scopeFrameId: scopeName ? centeredFrameId : null, scopeName });
    setInput('');
  };

  return (
    <aside
      className="fixed z-45 flex w-95 flex-col overflow-hidden rounded-lg bg-white shadow-lg"
      style={{ right: 'var(--right-sidebar-gap)', top: 'calc(var(--header-h) + 1rem)', bottom: 'calc(var(--footer-h) + 1rem)' }}
      aria-label="AI 채팅 수정"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="p-bold">✦ AI로 수정</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50" onClick={reset}>
            + 새 대화
          </button>
          <button type="button" aria-label="닫기" className="btn-icon text-gray-400" onClick={() => setOpen(false)}>
            <Icon name="close" width={20} />
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div className="rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
          <p className="mb-1 font-semibold text-gray-900">입력한 정보</p>
          <p>상품명 · {project?.productName || '미입력'}</p>
          <p>카테고리 · {project?.categoryName || '미지정'}</p>
          <p>페이지 {frameCount}개 · 문구 수정은 무료예요</p>
          {project?.palette && (
            <div className="mt-2 flex h-3 w-24 overflow-hidden rounded">
              {Object.values(project.palette).map((color) => (
                <span key={color} className="flex-1" style={{ background: color }} />
              ))}
            </div>
          )}
        </div>
        {turns.length === 0 && (
          <p className="text-center text-xs leading-5 text-gray-400">
            &ldquo;이 페이지 문구 더 짧게&rdquo;처럼 말하면
            <br />
            AI가 캔버스를 바로 고쳐요.
          </p>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} onFollowUp={send} />
        ))}
      </div>

      <footer className="flex flex-col gap-2 border-t border-gray-100 p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-(--color-point) hover:text-(--color-point)" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          {scopeName ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-(--color-point)/10 px-2 py-1 text-(--color-point)">
              📄 {scopeName} 페이지에 적용돼요
              <button type="button" aria-label="범위 해제" className="ml-0.5 font-bold" onClick={() => setWholeDocument(true)}>
                ×
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-gray-600">
              문서 전체에 적용돼요
              <button type="button" className="font-semibold text-(--color-point)" onClick={() => setWholeDocument(false)}>
                현재 페이지로
              </button>
            </span>
          )}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            maxLength={500}
            placeholder="무엇을 바꿀까요? (Shift+Enter 줄바꿈)"
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-(--color-point) focus:outline-none"
          />
          <button type="submit" aria-label="보내기" className="btn-primary h-10 w-10 shrink-0 p-0" disabled={!input.trim()}>
            <Icon name="arrow_upward" width={20} />
          </button>
        </form>
      </footer>
    </aside>
  );
}

function TurnView({ turn, onFollowUp }: { turn: ChatTurn; onFollowUp: (message: string) => void }) {
  const updateTurn = useAiChatStore((state) => state.updateTurn);
  const [showChanges, setShowChanges] = useState(false);
  const result = turn.result;
  const pages = result ? [...new Set(result.changes.map((c) => c.frameName))] : [];

  const revert = () => {
    if (!result) return;
    const skipped = revertChatChanges(result.changes);
    updateTurn(turn.id, { reverted: true });
    showToast.success(skipped ? `되돌렸어요. 직접 고친 문구 ${skipped}개는 그대로 뒀어요.` : '수정 전으로 되돌렸어요.');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="self-end rounded-2xl rounded-br-sm bg-gray-900 px-3 py-2 text-sm text-white">
        {turn.message}
        <p className="mt-0.5 text-[11px] text-white/60">{turn.scopeName ? `${turn.scopeName} 페이지` : '문서 전체'}</p>
      </div>

      {turn.status === 'queued' && <p className="text-xs text-gray-400">대기 중 · 앞의 요청이 끝나면 바로 처리해요</p>}
      {turn.status === 'running' && <p className="animate-pulse text-xs text-gray-500">✦ 생각 중… 문구를 고치고 있어요</p>}
      {turn.status === 'error' && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{turn.error}</p>}

      {result && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3">
          <p className="text-sm text-gray-800">{result.reply}</p>
          {result.changes.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500">
                  ✓ 문구 수정 · {result.changes.length}개 · {pages.join(', ')}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" className="font-semibold text-gray-600 hover:text-gray-900" onClick={() => setShowChanges(!showChanges)}>
                    {showChanges ? '접기' : '결과 보기'}
                  </button>
                  {turn.reverted ? (
                    <span className="text-gray-400">되돌림</span>
                  ) : (
                    <button type="button" className="font-semibold text-(--color-point)" onClick={revert}>
                      되돌리기
                    </button>
                  )}
                </span>
              </div>
              {showChanges && (
                <ul className="flex flex-col gap-1.5 text-xs">
                  {result.changes.map((c) => (
                    <li key={c.elementId} className="rounded-lg bg-gray-50 px-2 py-1.5">
                      <span className="text-gray-400 line-through">{c.before.text}</span>
                      <br />
                      <span className="text-gray-900">
                        {c.after.text ?? c.before.text}
                        {c.after.align && ` · ${c.after.align === 'center' ? '가운데' : c.after.align === 'right' ? '오른쪽' : '왼쪽'} 정렬`}
                        {c.after.fontSize && ` · ${c.before.fontSize}→${c.after.fontSize}px`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {result.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              <p className="font-semibold">사실 확인이 필요해요</p>
              {result.warnings.map((w) => (
                <p key={w}>· {w}</p>
              ))}
            </div>
          )}
          {result.followUps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.followUps.map((f) => (
                <button key={f} type="button" className="rounded-full bg-(--color-point)/10 px-2.5 py-1 text-xs text-(--color-point)" onClick={() => onFollowUp(f)}>
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
