import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import type { KonvaElement, KonvaFrameElement, KonvaTextElement } from '@/shared/types/konva';
import type { ChatEditChange, ChatEditRequest, ChatTextAlign } from '@/shared/types/chatEdit';

/**
 * AI 채팅 ↔ 캔버스 연결
 * - 지금 캔버스의 문구(저장 전 수정 포함)를 모아 서버로 보낸다
 * - 받은 변경을 한 번의 실행 취소 단위로 적용하고, 결과 카드의 "되돌리기"로 원래대로 돌린다
 */

/** 디자이너 가이드 레이어 (에디터에서 숨김, 서버 frames/tree.ts와 같은 규칙) */
const isGuideNode = (el: KonvaElement) => el.name === 'prompt' || (el.name ?? '').includes('꺼주세요');

const toAlign = (align: KonvaTextElement['align'] | undefined): ChatTextAlign =>
  align === 'center' || align === 'right' ? align : 'left';

function collectTexts(element: KonvaElement, out: KonvaTextElement[]) {
  if (element.visible === false || isGuideNode(element)) return;
  if (element.type === 'text') {
    const text = element as KonvaTextElement;
    if (text.text?.trim()) out.push(text);
  }
  const children = (element as { children?: KonvaElement[] }).children;
  children?.forEach((child) => collectTexts(child, out));
}

const frameLabel = (frame: KonvaFrameElement) => frame.name || frame.part2 || '페이지';

/** 서버로 보낼 페이지별 문구 */
export function collectCanvasTexts(): ChatEditRequest['frames'] {
  return useCanvasDataStore
    .getState()
    .frames.filter((f) => f.status === 'active')
    .map((frame) => {
      const texts: KonvaTextElement[] = [];
      frame.children.forEach((child) => collectTexts(child, texts));
      return {
        frameId: frame.id,
        name: frameLabel(frame),
        texts: texts.map((t) => ({ id: t.id, text: t.text, fontSize: t.fontSize, align: toAlign(t.align) })),
      };
    });
}

export const frameNameOf = (frameId: string | null) => {
  const frame = frameId ? useCanvasDataStore.getState().getFrameById(frameId) : undefined;
  return frame ? frameLabel(frame) : null;
};

/** 변경 적용 (같은 tick의 updateElement는 실행 취소 1단계로 묶인다) */
export function applyChatChanges(changes: ChatEditChange[]) {
  const { flatElements, updateElement } = useCanvasDataStore.getState();
  let applied = 0;
  for (const change of changes) {
    if (flatElements.get(change.elementId)?.type !== 'text') continue;
    updateElement(change.elementId, change.after as Partial<KonvaElement>);
    applied += 1;
  }
  return applied;
}

/** 되돌리기 — 그 사이 직접 고친 문구는 건드리지 않는다. 그대로 둔 개수를 돌려준다 */
export function revertChatChanges(changes: ChatEditChange[]) {
  const { flatElements, updateElement } = useCanvasDataStore.getState();
  let skipped = 0;
  for (const change of changes) {
    const current = flatElements.get(change.elementId) as KonvaTextElement | undefined;
    const untouched =
      current?.type === 'text' &&
      (change.after.text === undefined || current.text === change.after.text) &&
      (change.after.fontSize === undefined || current.fontSize === change.after.fontSize) &&
      (change.after.align === undefined || current.align === change.after.align);
    if (!untouched) {
      skipped += 1;
      continue;
    }
    const restore = Object.fromEntries(
      (Object.keys(change.after) as (keyof ChatEditChange['before'])[]).map((key) => [key, change.before[key]]),
    );
    updateElement(change.elementId, restore as Partial<KonvaElement>);
  }
  return skipped;
}
