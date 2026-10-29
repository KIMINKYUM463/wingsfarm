import { useCallback, useRef, useState, useEffect } from 'react';
import type Konva from 'konva';
import type { TransformerRef, ElementRefs } from '@/shared/types/konva-editor';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

/**
 * 회전 핸들 드래그 기능
 *
 * ## 기능
 * - 마우스/터치 드래그로 요소 회전
 * - 15도 단위 스냅 (Shift 키로 활성화)
 * - 실시간 각도 툴팁 (DOM 직접 관리)
 * - 다중 선택 요소 동시 회전
 * - ESC 키로 회전 취소
 */

interface RotationData {
  centerX: number; // Stage 좌표 (회전 각도 계산, RotatingSelectionBox용)
  centerY: number;
  localCenterX: number; // Layer 좌표 (요소 위치 업데이트용)
  localCenterY: number;
  startAngle: number;
  initialRotations: Map<string, number>;
  initialPositions: Map<string, { x: number; y: number }>; // 공통 중심 기준 상대 좌표 (Layer 좌표)
  originalTransforms: Map<string, { offsetX: number; offsetY: number; x: number; y: number }>;
  stageOffset: { left: number; top: number };
  stageScale: { x: number; y: number };
  initialBox: { x: number; y: number; width: number; height: number }; // 초기 bounding box (Stage 좌표)
}

const SNAP_ANGLE = 15;
const SNAP_TOLERANCE = 5;
const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'/%3E%3C/svg%3E") 12 12, auto`;

const snapAngle = (angle: number, snapEnabled: boolean): number => {
  if (!snapEnabled) return angle;
  const snapped = Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
  return Math.abs(angle - snapped) <= SNAP_TOLERANCE ? snapped : angle;
};

const getAngle = (centerX: number, centerY: number, pointX: number, pointY: number): number => {
  return (Math.atan2(pointY - centerY, pointX - centerX) * 180) / Math.PI;
};

const getNodeSize = (node: Konva.Node): { width: number; height: number } => {
  if (node.getClassName() === 'Group') {
    const textChild = (node as Konva.Group).findOne('Text') as Konva.Text;
    if (textChild) {
      return {
        width: textChild.width() * node.scaleX(),
        height: textChild.height() * node.scaleY(),
      };
    }
  }

  const width = node.width?.() ?? 0;
  const height = node.height?.() ?? 0;

  if (width > 0 && height > 0) {
    return { width: width * node.scaleX(), height: height * node.scaleY() };
  }

  const rect = node.getClientRect({ skipTransform: true });
  return { width: rect.width * node.scaleX(), height: rect.height * node.scaleY() };
};

const getTouchPosition = (e: TouchEvent): { clientX: number; clientY: number } | null => {
  const touch = e.touches[0] || e.changedTouches[0];
  return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
};

/**
 * 툴팁 DOM 생성
 */
const createTooltip = (): HTMLDivElement => {
  const tooltip = document.createElement('div');
  tooltip.id = 'rotation-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 9999;
    padding: 6px 12px;
    background: #111827;
    color: white;
    font-size: 14px;
    border-radius: 6px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `;
  return tooltip;
};

export const useRotateHandle = (
  transformerRef: TransformerRef,
  selectedIds: string[],
  elementRefs: ElementRefs,
) => {
  const updateElement = useElementStore((state) => state.updateElement);
  const setMultiSelectionRotating = useSelectionStore((state) => state.setMultiSelectionRotating);
  const [isRotating, setIsRotating] = useState(false);

  const rotationDataRef = useRef<RotationData | null>(null);
  const rafRef = useRef<number | null>(null);
  const isRotatingRef = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const eventListenersRef = useRef<{
    mouseMove?: (e: MouseEvent) => void;
    mouseUp?: () => void;
    touchMove?: (e: TouchEvent) => void;
    touchEnd?: () => void;
  }>({});

  selectedIdsRef.current = selectedIds;

  const cleanupEventListeners = useCallback(() => {
    const { mouseMove, mouseUp, touchMove, touchEnd } = eventListenersRef.current;
    if (mouseMove) document.removeEventListener('mousemove', mouseMove);
    if (mouseUp) document.removeEventListener('mouseup', mouseUp);
    if (touchMove) document.removeEventListener('touchmove', touchMove);
    if (touchEnd) {
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', touchEnd);
    }
    eventListenersRef.current = {};
  }, []);

  const cleanupTooltip = useCallback(() => {
    document.body.style.cursor = '';
    tooltipRef.current?.remove();
    tooltipRef.current = null;
  }, []);

  const updateTooltip = useCallback((clientX: number, clientY: number, angle: number) => {
    if (!tooltipRef.current) return;
    tooltipRef.current.style.left = `${clientX}px`;
    tooltipRef.current.style.top = `${clientY - 50}px`;
    tooltipRef.current.textContent = `${Math.round(angle)}°`;
  }, []);

  const resetRotationState = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    cleanupEventListeners();
    cleanupTooltip();
    rotationDataRef.current = null;
    isRotatingRef.current = false;
    setIsRotating(false);
    setMultiSelectionRotating(false);
  }, [cleanupEventListeners, cleanupTooltip, setMultiSelectionRotating]);

  const cancelRotation = useCallback(() => {
    const rotationData = rotationDataRef.current;
    if (!rotationData || !isRotatingRef.current) return;

    const { originalTransforms, initialRotations } = rotationData;

    selectedIdsRef.current.forEach((id) => {
      const node = elementRefs.current.get(id);
      const original = originalTransforms.get(id);
      const initialRotation = initialRotations.get(id);

      if (node && original && initialRotation !== undefined) {
        node.rotation(initialRotation);
        node.offsetX(original.offsetX);
        node.offsetY(original.offsetY);
        node.x(original.x);
        node.y(original.y);
      }
    });

    transformerRef.current?.forceUpdate();
    transformerRef.current?.getLayer()?.batchDraw();
    resetRotationState();
  }, [elementRefs, transformerRef, resetRotationState]);

  const finishRotation = useCallback(() => {
    const rotationData = rotationDataRef.current;
    if (!rotationData || !isRotatingRef.current) return;

    const { originalTransforms } = rotationData;

    selectedIdsRef.current.forEach((id) => {
      const node = elementRefs.current.get(id);
      const original = originalTransforms.get(id);

      if (node && original) {
        const finalRotation = node.rotation();
        const radians = (finalRotation * Math.PI) / 180;
        const { width, height } = getNodeSize(node);

        // offset 복원
        node.offsetX(original.offsetX);
        node.offsetY(original.offsetY);

        // 현재 위치는 요소 중심점이므로, offset을 복원하면서 x, y 조정
        const offsetFromCenterX = width / 2 - original.offsetX;
        const offsetFromCenterY = height / 2 - original.offsetY;
        const rotatedOffsetX = offsetFromCenterX * Math.cos(radians) - offsetFromCenterY * Math.sin(radians);
        const rotatedOffsetY = offsetFromCenterX * Math.sin(radians) + offsetFromCenterY * Math.cos(radians);

        node.x(node.x() - rotatedOffsetX);
        node.y(node.y() - rotatedOffsetY);

        updateElement(id, { rotation: finalRotation, x: node.x(), y: node.y() });
      }
    });

    const transformer = transformerRef.current;
    if (transformer) {
      transformer.forceUpdate();
      transformer.getLayer()?.batchDraw();
      transformer.fire('transformend');
    }

    resetRotationState();
  }, [elementRefs, updateElement, transformerRef, resetRotationState]);

  const processRotateMove = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const rotationData = rotationDataRef.current;
      if (!rotationData || rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        const {
          centerX,
          centerY,
          localCenterX,
          localCenterY,
          startAngle,
          initialRotations,
          initialPositions,
          stageOffset,
          stageScale,
        } = rotationData;

        const mouseStageX = (clientX - stageOffset.left) / stageScale.x;
        const mouseStageY = (clientY - stageOffset.top) / stageScale.y;
        const currentMouseAngle = getAngle(centerX, centerY, mouseStageX, mouseStageY);
        const angleDiff = snapAngle(currentMouseAngle - startAngle, shiftKey);
        const angleRad = (angleDiff * Math.PI) / 180;

        initialRotations.forEach((initialRotation, id) => {
          const node = elementRefs.current.get(id);
          if (!node) return;

          // 요소 회전 업데이트
          node.rotation(initialRotation + angleDiff);

          // 다중 선택 시 요소 위치도 공통 중심을 기준으로 회전 (Layer 좌표 사용)
          const initialPos = initialPositions.get(id);
          if (initialPos && selectedIdsRef.current.length > 1) {
            // 상대 좌표를 angleDiff만큼 회전
            const rotatedX = initialPos.x * Math.cos(angleRad) - initialPos.y * Math.sin(angleRad);
            const rotatedY = initialPos.x * Math.sin(angleRad) + initialPos.y * Math.cos(angleRad);

            // 새 위치 = 공통 중심 + 회전된 상대 좌표 (Layer 좌표)
            node.x(localCenterX + rotatedX);
            node.y(localCenterY + rotatedY);
          }
        });

        // 다중 선택 시 회전하는 박스 직접 업데이트 (React 리렌더 없음)
        if (selectedIdsRef.current.length > 1) {
          const { initialBox } = rotationData;
          const rotatingBoxNode = useSelectionStore.getState().rotatingBoxNode;
          if (rotatingBoxNode) {
            rotatingBoxNode.setAttrs({
              x: centerX,
              y: centerY,
              width: initialBox.width,
              height: initialBox.height,
              offsetX: initialBox.width / 2,
              offsetY: initialBox.height / 2,
              rotation: angleDiff,
            });
            rotatingBoxNode.getLayer()?.batchDraw();
          }
        }

        updateTooltip(clientX, clientY, angleDiff);
        rafRef.current = null;
      });
    },
    [elementRefs, updateTooltip, setMultiSelectionRotating],
  );

  const initRotation = useCallback(
    (clientX: number, clientY: number) => {
      const transformer = transformerRef.current;
      if (!transformer || selectedIds.length === 0) return false;

      const stage = transformer.getStage();
      if (!stage) return false;

      const containerRect = stage.container().getBoundingClientRect();
      const stageOffset = { left: containerRect.left + stage.x(), top: containerRect.top + stage.y() };
      const stageScale = { x: stage.scaleX(), y: stage.scaleY() };

      // 선택된 노드들의 실제 bounds 계산 (transformer.getClientRect()는 AABB라서 회전 시 확장됨)
      const nodes = transformer.nodes();
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      nodes.forEach((node) => {
        const nodeRect = node.getClientRect();
        minX = Math.min(minX, nodeRect.x);
        minY = Math.min(minY, nodeRect.y);
        maxX = Math.max(maxX, nodeRect.x + nodeRect.width);
        maxY = Math.max(maxY, nodeRect.y + nodeRect.height);
      });

      const boxWidth = maxX - minX;
      const boxHeight = maxY - minY;
      const centerX = minX + boxWidth / 2;
      const centerY = minY + boxHeight / 2;

      // Stage 좌표를 Layer 좌표로 변환 (요소 위치 업데이트용)
      const layer = transformer.getLayer();
      const layerInverseTransform = layer?.getAbsoluteTransform().copy().invert();
      const localCenter = layerInverseTransform?.point({ x: centerX, y: centerY }) || { x: centerX, y: centerY };
      const localCenterX = localCenter.x;
      const localCenterY = localCenter.y;

      const mouseStageX = (clientX - stageOffset.left) / stageScale.x;
      const mouseStageY = (clientY - stageOffset.top) / stageScale.y;
      const startAngle = getAngle(centerX, centerY, mouseStageX, mouseStageY);

      const initialRotations = new Map<string, number>();
      const initialPositions = new Map<string, { x: number; y: number }>();
      const originalTransforms = new Map<string, { offsetX: number; offsetY: number; x: number; y: number }>();

      selectedIds.forEach((id) => {
        const node = elementRefs.current.get(id);
        if (!node) return;

        originalTransforms.set(id, {
          offsetX: node.offsetX(),
          offsetY: node.offsetY(),
          x: node.x(),
          y: node.y(),
        });

        const currentRotation = node.rotation();
        initialRotations.set(id, currentRotation);

        // 요소의 시각적 중심 계산 (Layer 좌표)
        const { width, height } = getNodeSize(node);
        const radians = (currentRotation * Math.PI) / 180;
        const offsetFromOriginX = width / 2 - node.offsetX();
        const offsetFromOriginY = height / 2 - node.offsetY();
        const rotatedOffsetX = offsetFromOriginX * Math.cos(radians) - offsetFromOriginY * Math.sin(radians);
        const rotatedOffsetY = offsetFromOriginX * Math.sin(radians) + offsetFromOriginY * Math.cos(radians);

        // 요소의 시각적 중심 좌표 (공통 중심 기준 상대 좌표 - Layer 좌표)
        const elementCenterX = node.x() + rotatedOffsetX;
        const elementCenterY = node.y() + rotatedOffsetY;
        initialPositions.set(id, {
          x: elementCenterX - localCenterX,
          y: elementCenterY - localCenterY,
        });

        // offset을 중심으로 이동
        node.offsetX(width / 2);
        node.offsetY(height / 2);
        node.x(elementCenterX);
        node.y(elementCenterY);
      });

      rotationDataRef.current = {
        centerX,
        centerY,
        localCenterX,
        localCenterY,
        startAngle,
        initialRotations,
        initialPositions,
        originalTransforms,
        stageOffset,
        stageScale,
        initialBox: { x: minX, y: minY, width: boxWidth, height: boxHeight },
      };

      // 툴팁 및 커서 설정
      document.body.style.cursor = ROTATE_CURSOR;
      tooltipRef.current = createTooltip();
      tooltipRef.current.textContent = '0°';
      tooltipRef.current.style.left = `${clientX}px`;
      tooltipRef.current.style.top = `${clientY - 50}px`;
      document.body.appendChild(tooltipRef.current);

      isRotatingRef.current = true;
      setIsRotating(true);

      // 다중 선택 시 회전 상태 활성화 + 박스 초기화
      if (selectedIds.length > 1) {
        setMultiSelectionRotating(true);

        // RotatingSelectionBox 초기 위치/크기 설정
        const rotatingBoxNode = useSelectionStore.getState().rotatingBoxNode;
        if (rotatingBoxNode) {
          rotatingBoxNode.setAttrs({
            x: centerX,
            y: centerY,
            width: boxWidth,
            height: boxHeight,
            offsetX: boxWidth / 2,
            offsetY: boxHeight / 2,
            rotation: 0,
          });
          rotatingBoxNode.getLayer()?.batchDraw();
        }
      }

      return true;
    },
    [transformerRef, selectedIds, elementRefs, setMultiSelectionRotating],
  );

  const handleRotateStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!initRotation(e.clientX, e.clientY)) return;

      const mouseMoveHandler = (ev: MouseEvent) => processRotateMove(ev.clientX, ev.clientY, ev.shiftKey);
      const mouseUpHandler = () => finishRotation();

      eventListenersRef.current = { mouseMove: mouseMoveHandler, mouseUp: mouseUpHandler };
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    },
    [initRotation, processRotateMove, finishRotation],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const pos = getTouchPosition(e.nativeEvent);
      if (!pos || !initRotation(pos.clientX, pos.clientY)) return;

      const touchMoveHandler = (ev: TouchEvent) => {
        const touchPos = getTouchPosition(ev);
        if (touchPos) processRotateMove(touchPos.clientX, touchPos.clientY, false);
      };
      const touchEndHandler = () => finishRotation();

      eventListenersRef.current = { touchMove: touchMoveHandler, touchEnd: touchEndHandler };
      document.addEventListener('touchmove', touchMoveHandler, { passive: false });
      document.addEventListener('touchend', touchEndHandler);
      document.addEventListener('touchcancel', touchEndHandler);
    },
    [initRotation, processRotateMove, finishRotation],
  );

  useEscapeKey(cancelRotation, isRotating);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      cleanupEventListeners();
      cleanupTooltip();
    };
  }, [cleanupEventListeners, cleanupTooltip]);

  return { handleRotateStart, handleTouchStart, isRotating };
};
