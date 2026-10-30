import Konva from 'konva';
import type { KonvaElement } from '@/shared/types/konva';
import { countUpText, poseAt, typedText } from './animation';

/** 사진·도형을 감싼 Group 이름 — 사진 위 AI 배지까지 함께 움직이게 */
export const ELEMENT_WRAP_NAME = '_element-wrap';

const animationTarget = (node: Konva.Node) => {
  const parent = node.getParent();
  return parent?.name() === ELEMENT_WRAP_NAME ? parent : node;
};

/**
 * 한 페이지의 움직임을 Konva 노드에 직접 적용·복원한다
 * - 저장 데이터(store)는 건드리지 않는다 — 미리보기·내보내기가 끝나면 restore로 원래대로
 * - 화면 갱신(draw)은 부르는 쪽이 한다
 */
export function createPageAnimator(layer: Konva.Layer, elements: KonvaElement[]) {
  const tracks = elements.flatMap((element) => {
    const node = element.animation ? layer.findOne(`#${element.id}`) : undefined;
    if (!node || !element.animation) return [];
    const target = animationTarget(node);
    const textNode = element.type === 'text' && target instanceof Konva.Group ? (target.findOne<Konva.Text>('Text') ?? null) : null;
    const box = target.getClientRect({ relativeTo: target.getParent() ?? undefined, skipShadow: true });
    return [
      {
        animation: element.animation,
        target,
        textNode,
        text: textNode?.text() ?? '',
        base: { x: target.x(), y: target.y(), opacity: target.opacity(), scaleX: target.scaleX(), scaleY: target.scaleY() },
        center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      },
    ];
  });

  /** t초 모습으로 (요소 가운데를 기준으로 확대·축소) */
  const apply = (t: number) => {
    for (const { animation, target, textNode, text, base, center } of tracks) {
      const pose = poseAt(animation, t);
      target.opacity(base.opacity * pose.opacity);
      target.scaleX(base.scaleX * pose.scale);
      target.scaleY(base.scaleY * pose.scale);
      target.x(center.x + (base.x - center.x) * pose.scale + pose.dx);
      target.y(center.y + (base.y - center.y) * pose.scale + pose.dy);
      if (textNode && animation.effect === 'typing') textNode.text(typedText(text, pose.reveal));
      if (textNode && animation.effect === 'countUp') textNode.text(countUpText(text, pose.reveal));
    }
  };

  const restore = () => {
    for (const { target, textNode, text, base } of tracks) {
      target.setAttrs(base);
      textNode?.text(text);
    }
  };

  return { apply, restore, count: tracks.length };
}
