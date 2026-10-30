'use client';

import { showToast } from '@/utils/toast';
import type { ChatEditChange } from '@/shared/types/chatEdit';
import { revertChatChanges } from '@/features/editor/lib/chat-canvas';
import { useAiChatStore, type ChatTurn } from '@/features/editor/store/useAiChatStore';

/** AI 채팅 결과 표시 조각 — 채팅 패널과 AI 도우미 말풍선이 함께 쓴다 */

const ALIGN_LABEL = { left: '왼쪽', center: '가운데', right: '오른쪽' } as const;

/** 바뀐 문구 (전 → 후) */
export function ChangeList({ changes }: { changes: ChatEditChange[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-xs">
      {changes.map((c) => (
        <li key={c.elementId} className="rounded-lg bg-gray-50 px-2 py-1.5">
          <span className="text-gray-400 line-through">{c.before.text}</span>
          <br />
          <span className="text-gray-900">
            {c.after.text ?? c.before.text}
            {c.after.align && ` · ${ALIGN_LABEL[c.after.align]} 정렬`}
            {c.after.fontSize && ` · ${c.before.fontSize}→${c.after.fontSize}px`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 입력 자료에 없던 주장이 새로 생겼을 때 경고 */
export function WarningBox({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
      <p className="font-semibold">사실 확인이 필요해요</p>
      {warnings.map((w) => (
        <p key={w}>· {w}</p>
      ))}
    </div>
  );
}

/** 요청 하나를 수정 전으로 되돌린다 (그 사이 직접 고친 문구는 그대로 둔다) */
export function revertTurn(turn: ChatTurn) {
  if (!turn.result) return;
  const skipped = revertChatChanges(turn.result.changes);
  useAiChatStore.getState().updateTurn(turn.id, { reverted: true });
  showToast.success(skipped ? `되돌렸어요. 직접 고친 문구 ${skipped}개는 그대로 뒀어요.` : '수정 전으로 되돌렸어요.');
}

export function RevertButton({ turn }: { turn: ChatTurn }) {
  return turn.reverted ? (
    <span className="text-gray-400">되돌림</span>
  ) : (
    <button type="button" className="font-semibold text-(--color-point)" onClick={() => revertTurn(turn)}>
      되돌리기
    </button>
  );
}
