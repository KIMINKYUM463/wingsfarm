/**
 * useImageDrop.ts
 * 이미지 드래그 앤 드롭 교체 로직 훅
 *
 * ## 책임
 * - 패널에서 캔버스로 이미지 드래그 시 이미지 요소 감지
 * - 이미지 교체 또는 새 이미지 추가 처리
 *
 * ## 성능 최적화
 * - dragOver throttle (16ms = 60fps)
 * - 전역 dragend 이벤트로 클린업
 * - flatElements 대신 개별 요소 조회로 리렌더링 최소화
 */

import { useRef, useCallback, useEffect } from 'react';
import type Konva from 'konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useImageDropTargetStore } from '@/features/editor/store/useImageDropTargetStore';
import { isImageElement } from '@/features/editor/lib/element-finder';

/** dragOver 이벤트 throttle 간격 (60fps) */
const DRAG_OVER_THROTTLE_MS = 16;

/** 드롭 타겟에서 제외할 오버레이/배경 노드 이름 */
const IGNORED_NODE_NAMES = new Set([
  '_hover-overlay',
  '_frame-overlay',
  '_group-overlay',
  'frame-background',
]);

/** 요소 조회용 (구독 없이 직접 접근 - 리렌더링 방지) */
const getElementById = (id: string) => useCanvasDataStore.getState().flatElements.get(id);

interface UseImageDropOptions {
  frameId: string;
  stageRef: React.RefObject<Konva.Stage | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  layerOffsetX: number;
  layerOffsetY: number;
  scale: number;
  frameWidth: number;
  frameHeight: number;
}

export function useImageDrop({
  frameId,
  stageRef,
  containerRef,
  layerOffsetX,
  layerOffsetY,
  scale,
  frameWidth,
  frameHeight,
}: UseImageDropOptions) {
  const addImageToFrame = useElementStore((state) => state.addImageToFrame);
  const setAssetUrl = useCanvasDataStore((state) => state.setAssetUrl);
  const updateElement = useCanvasDataStore((state) => state.updateElement);
  const { setDropTarget, clearDropTarget } = useImageDropTargetStore();

  const lastDragOverTime = useRef(0);

  // 전역 dragend 이벤트로 드롭 타겟 정리
  useEffect(() => {
    const handleGlobalDragEnd = () => clearDropTarget();
    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, [clearDropTarget]);

  /**
   * 마우스 위치에서 이미지 요소 찾기
   * getIntersection 사용하여 정확한 히트 테스트
   */
  const findImageElementAtPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const stage = stageRef.current;
      const container = containerRef.current;
      if (!stage || !container) return null;

      const containerRect = container.getBoundingClientRect();
      const stageX = clientX - containerRect.left;
      const stageY = clientY - containerRect.top;

      // Konva 노드 찾기
      const node = stage.getIntersection({ x: stageX, y: stageY });
      if (!node) return null;

      // 오버레이/배경 요소는 무시 (이미지 타겟이 아님)
      if (IGNORED_NODE_NAMES.has(node.name())) {
        return null;
      }

      // 이미지 요소인지 확인 (store에서 직접 조회 - 리렌더링 방지)
      const nodeId = node.id();
      const element = getElementById(nodeId);
      if (element && isImageElement(element)) {
        return nodeId;
      }

      return null;
    },
    [stageRef, containerRef],
  );

  /**
   * 드롭 핸들러: 이미지 교체 또는 새 이미지 추가
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      clearDropTarget();

      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      try {
        const { assetId, imageUrl } = JSON.parse(jsonData);
        if (!assetId || !imageUrl) return;

        // 드롭 위치에 이미지 요소가 있으면 교체
        const targetImageId = findImageElementAtPoint(e.clientX, e.clientY);
        if (targetImageId) {
          // 동일 이미지면 스킵 (불필요한 업데이트 방지)
          const targetElement = getElementById(targetImageId);
          if (targetElement && 'assetId' in targetElement && targetElement.assetId === assetId) {
            return;
          }
          setAssetUrl(assetId, imageUrl);
          updateElement(targetImageId, { assetId });
          return;
        }

        // 프레임 내 상대 좌표 계산
        const containerRect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        const frameRelativeX = (mouseX - layerOffsetX) / scale;
        const frameRelativeY = (mouseY - layerOffsetY) / scale;

        // 프레임 영역 외부면 무시
        if (
          frameRelativeX < 0 ||
          frameRelativeX > frameWidth ||
          frameRelativeY < 0 ||
          frameRelativeY > frameHeight
        ) {
          return;
        }

        addImageToFrame(frameId, assetId, imageUrl, { x: frameRelativeX, y: frameRelativeY });
      } catch {
        // JSON 파싱 실패 시 무시
      }
    },
    [
      frameId,
      layerOffsetX,
      layerOffsetY,
      scale,
      frameWidth,
      frameHeight,
      addImageToFrame,
      findImageElementAtPoint,
      setAssetUrl,
      updateElement,
      clearDropTarget,
    ],
  );

  /**
   * 드래그오버 핸들러: 드롭 타겟 감지 (throttled)
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const now = Date.now();
      if (now - lastDragOverTime.current < DRAG_OVER_THROTTLE_MS) return;
      lastDragOverTime.current = now;

      const targetImageId = findImageElementAtPoint(e.clientX, e.clientY);
      if (targetImageId) {
        setDropTarget(targetImageId, frameId);
      } else {
        clearDropTarget();
      }
    },
    [findImageElementAtPoint, frameId, setDropTarget, clearDropTarget],
  );

  /**
   * 드래그리브 핸들러: 프레임 벗어날 때 클리어
   */
  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // 컨테이너 외부로 나갈 때만 처리
      const relatedTarget = e.relatedTarget as Node | null;
      if (!relatedTarget || !containerRef.current?.contains(relatedTarget)) {
        clearDropTarget();
      }
    },
    [containerRef, clearDropTarget],
  );

  return {
    handleDrop,
    handleDragOver,
    handleDragLeave,
  };
}
