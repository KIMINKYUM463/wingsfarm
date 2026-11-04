/**
 * 템플릿에 박힌 큰 사진을 판매자가 바꿀 자리로 바꿀지 판단한다.
 * 서버 전용 import 없음 — 단위 테스트 가능
 */

const PHOTO_SLOT_MIN = 140;

export type PhotoSlotNode = {
  type: string;
  name?: string;
  width?: number;
  height?: number;
  figmaImageRef?: string;
  assetId?: string;
  children?: PhotoSlotNode[];
};

const isImageSlot = (node: PhotoSlotNode) =>
  (node.name ?? '').includes('_image') && (node.type === 'rect' || node.type === 'path');

const isTemplatePhotoAsset = (assetId?: string) => typeof assetId === 'string' && assetId.startsWith('tpl-');

/** 템플릿에 박힌 큰 사진·빈 큰 이미지 칸 → 판매자가 바꿀 사진 자리 */
export function looksLikePhotoSlot(node: PhotoSlotNode): boolean {
  if (node.type !== 'rect' && node.type !== 'path') return false;
  if ((node.name ?? '').includes('_graphic')) return false;
  if (Number(node.width ?? 0) < PHOTO_SLOT_MIN || Number(node.height ?? 0) < PHOTO_SLOT_MIN) return false;
  if (isImageSlot(node)) return true;
  return Boolean(node.figmaImageRef || isTemplatePhotoAsset(node.assetId));
}

function markAsImageSlot(node: PhotoSlotNode) {
  const base = String(node.name ?? 'photo').replace(/\s+/g, '_') || 'photo';
  if (!base.includes('_image')) node.name = `${base}_image`;
}

/** 상품 사진 자리가 아닌 큰 사진이 템플릿에 박혀 있으면 그 템플릿은 쓰지 않는다 */
export function hasBakedTemplatePhotos(frame: PhotoSlotNode): boolean {
  const visit = (node: PhotoSlotNode): boolean => {
    const name = node.name ?? '';
    if (!name.includes('_image') && looksLikePhotoSlot(node)) return true;
    return ((node.children ?? []) as PhotoSlotNode[]).some(visit);
  };
  return visit(frame);
}

/**
 * 템플릿 샘플 사진을 비우고 `_image` 자리로 바꾼다.
 * 판매자·AI가 이미 넣은 사진(UUID assetId)은 지우지 않는다.
 * (에디터 조회마다 호출되므로 지우면 새로고침·재진입 시 사진이 전부 빈 자리가 된다)
 */
export function promotePhotoSlots<T extends PhotoSlotNode>(frame: T): T {
  const visit = (node: T) => {
    if (looksLikePhotoSlot(node)) {
      markAsImageSlot(node);
      delete node.figmaImageRef;
      // UUID 등 실제 업로드·AI 사진은 유지. 템플릿 샘플(tpl-*)·빈 칸만 비움
      if (!node.assetId || isTemplatePhotoAsset(node.assetId)) delete node.assetId;
    }
    for (const child of (node.children ?? []) as T[]) visit(child);
  };
  visit(frame);
  return frame;
}
