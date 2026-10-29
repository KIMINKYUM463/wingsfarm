import { randomUUID } from 'node:crypto';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { templateAssetId } from '../assets';

/**
 * Konva 프레임 JSON을 다루는 서버 유틸
 * (클라이언트 타입은 rootId 등 런타임 주입 필드를 요구하므로 서버에서는 느슨한 노드 타입을 쓴다)
 */
export interface FrameNode {
  type: string;
  id: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  visible?: boolean;
  text?: string;
  assetId?: string;
  figmaImageRef?: string;
  children?: FrameNode[];
  [key: string]: unknown;
}

export const asNode = (frame: unknown) => frame as FrameNode;
export const asFrame = (node: FrameNode) => node as unknown as KonvaFrameElement;

export function* walk(node: FrameNode): Generator<FrameNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

/** 디자이너 가이드 레이어 (에디터에서 숨김) */
const isGuideNode = (node: FrameNode) =>
  node.name === 'prompt' || (node.name ?? '').includes('꺼주세요');

export const isPromptNode = (node: FrameNode) => node.type === 'text' && node.name === 'prompt';

/** 상품 사진 자리 (AI 이미지 생성 대상) */
export const isImageSlot = (node: FrameNode) =>
  (node.name ?? '').includes('_image') && (node.type === 'rect' || node.type === 'path');

/** 템플릿 저장 전 정리: 가이드 숨김 + 최상위 좌표 (0, 0) */
export function sanitizeTemplateFrame(frame: FrameNode): FrameNode {
  const clone = structuredClone(frame);
  for (const node of walk(clone)) {
    if (isGuideNode(node)) node.visible = false;
  }
  return { ...clone, type: 'frame', x: 0, y: 0 };
}

/** 모든 하위 요소 id를 새로 발급 (같은 템플릿을 여러 번 써도 id가 겹치지 않게) */
export function cloneWithNewIds(frame: FrameNode, frameId: string): FrameNode {
  const clone = structuredClone(frame);
  for (const node of walk(clone)) node.id = randomUUID();
  clone.id = frameId;
  return clone;
}

/**
 * 템플릿 이미지 참조(figmaImageRef) → assetId
 * - `_image` 자리의 샘플 사진은 비워 둔다 (상품 사진/AI 이미지로 채울 자리)
 */
export function materializeTemplateImages(frame: FrameNode) {
  for (const node of walk(frame)) {
    if (!node.figmaImageRef) continue;
    if (!isImageSlot(node)) node.assetId = templateAssetId(node.figmaImageRef);
    delete node.figmaImageRef;
  }
  return frame;
}

export const collectAssetIds = (frames: FrameNode[]) => {
  const ids = new Set<string>();
  for (const frame of frames) {
    for (const node of walk(frame)) if (node.assetId) ids.add(node.assetId);
  }
  return ids;
};

export const countImageSlots = (frame: FrameNode) => [...walk(frame)].filter(isImageSlot).length;

/** 숨김 처리된 prompt 텍스트 (디자이너가 남긴 문구 작성 가이드) */
export const collectPromptGuides = (frame: FrameNode) =>
  [...walk(frame)].filter(isPromptNode).map((n) => String(n.text ?? '').trim()).filter(Boolean);

export interface EditableText {
  id: string;
  text: string;
  fontSize: number;
}

/** AI가 다시 쓸 수 있는 텍스트 (보이는 텍스트만, 가이드 그룹 내부 제외) */
export function collectEditableTexts(frame: FrameNode): EditableText[] {
  const result: EditableText[] = [];
  const visit = (node: FrameNode) => {
    if (node.visible === false || isGuideNode(node)) return;
    if (node.type === 'text' && String(node.text ?? '').trim()) {
      result.push({ id: node.id, text: String(node.text), fontSize: Number(node.fontSize) || 16 });
    }
    node.children?.forEach(visit);
  };
  visit(frame);
  return result;
}

export function applyTexts(frame: FrameNode, texts: Record<string, string>) {
  for (const node of walk(frame)) {
    if (node.type === 'text' && typeof texts[node.id] === 'string' && texts[node.id].trim()) {
      node.text = texts[node.id];
    }
  }
  return frame;
}

export const findNode = (frame: FrameNode, id: string) => [...walk(frame)].find((n) => n.id === id);
