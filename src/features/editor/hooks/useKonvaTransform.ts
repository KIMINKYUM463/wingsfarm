/**
 * useKonvaTransform.ts
 * Konva Transformer를 통한 요소 변형 기능 (크기 조절, 회전)
 *
 * ## 책임
 * - Transformer 종료 시 요소 크기/회전 업데이트
 * - 요소 타입별 변형 처리 (Text, Path, 일반 요소)
 * - Scale을 width/height로 변환하여 저장
 *
 * ## 사용 예시
 * ```tsx
 * const { handleTransformEnd } = useKonvaTransform();
 *
 * <Rect
 *   onTransformEnd={handleTransformEnd}
 * />
 * ```
 */

import { useCallback, useRef } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useSnapStore } from '@/features/editor/store/useSnapStore';
import { recordHistoryIfNeeded } from '@/features/editor/store/useCanvasDataStore';
import {
  getLineGuideStops,
  getObjectSnappingEdges,
  getMultiSelectionSnappingEdges,
  getGuides,
  filterEdgesByAnchor,
} from '@/features/editor/utils/snapUtils';
import { getFrameSizeFromLayer } from '@/features/editor/lib/konva-layer-utils';

/**
 * Konva 요소 변형 기능을 제공하는 훅
 *
 * @returns {Object} Transform 이벤트 핸들러
 */
export const useKonvaTransform = () => {
  const updateElement = useElementStore((state) => state.updateElement);

  // 스냅 관련
  const setGuides = useSnapStore((state) => state.setGuides);
  const clearGuides = useSnapStore((state) => state.clearGuides);
  const isSnapEnabled = useSnapStore((state) => state.isSnapEnabled);
  const setResizeSnapCache = useSnapStore((state) => state.setResizeSnapCache);
  const rafRef = useRef<number | null>(null);

  /**
   * 프레임 정보 가져오기 (DOM 속성에서)
   */
  const getFrameInfo = useCallback((stage: Konva.Stage) => {
    const container = stage.container();
    const frameContainer = container.closest('[data-frame-id]') as HTMLElement | null;

    if (!frameContainer) return null;

    return {
      frameId: frameContainer.dataset.frameId || '',
    };
  }, []);

  /**
   * Transform 시작
   * - 변형 전 상태를 히스토리에 저장 (undo 지원)
   */
  const handleTransformStart = useCallback(() => {
    recordHistoryIfNeeded();
  }, []);

  /**
   * Transform 중 (리사이즈/회전)
   * - 스냅 가이드라인 표시
   */
  const handleTransform = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 스냅 비활성화 시 스킵
      if (!isSnapEnabled) return;

      const target = e.target;
      const stage = target.getStage();
      const layer = target.getLayer();

      if (!stage || !layer) return;

      // 프레임 정보 가져오기
      const frameInfo = getFrameInfo(stage);
      if (!frameInfo) return;

      // Transformer에 연결된 노드들 (name으로 명시적 검색)
      const transformer = stage.findOne('._selection-ui') as Konva.Transformer | undefined;
      const nodes = transformer?.nodes() || [];
      const transformerNodes = nodes.length > 0 ? nodes : [target];

      // 이전 RAF 취소
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        // clip-group에서 프레임 크기 가져오기
        const frameSizeResult = getFrameSizeFromLayer(layer, stage);
        if (!frameSizeResult) {
          rafRef.current = null;
          return;
        }

        const { frameWidth, frameHeight, clipGroup } = frameSizeResult;

        // Active anchor 확인 (드래그 중인 핸들)
        const activeAnchor = transformer?.getActiveAnchor() || null;

        // 회전 중이면 스냅 안 함
        if (activeAnchor === 'rotater') {
          clearGuides();
          rafRef.current = null;
          return;
        }

        // 리사이즈 스냅용 캐시 확인 - 캐시 있으면 재사용, 없으면 새로 계산
        let currentCache = useSnapStore.getState().resizeSnapCache;
        if (!currentCache) {
          // 스냅 대상 좌표 수집 (자신과 선택된 노드들 제외) - 최초 1회만 계산
          const lineGuideStops = getLineGuideStops(
            layer,
            transformerNodes,
            frameWidth,
            frameHeight,
          );
          currentCache = {
            lineGuideStops,
            layerOffsetX: layer.offsetX(),
            layerOffsetY: layer.offsetY(),
            scale: layer.scaleX(),
          };
          setResizeSnapCache(currentCache);
        }

        // 현재 객체의 스냅 포인트 계산 (변형된 바운딩 박스 기준, target: 변형 중인 노드)
        const allEdges =
          transformerNodes.length > 1
            ? getMultiSelectionSnappingEdges(transformerNodes, clipGroup, target)
            : getObjectSnappingEdges(target, clipGroup);

        // Active anchor 기반으로 드래그 중인 edge만 필터링
        const itemBounds = filterEdgesByAnchor(allEdges, activeAnchor);

        // 스냅 가이드라인 찾기 (캐시된 lineGuideStops 사용)
        const guides = getGuides(currentCache.lineGuideStops, itemBounds);

        if (guides.length > 0) {
          // 가이드라인 상태 업데이트 (렌더링용만, 위치 스냅 없음)
          setGuides(guides, frameInfo.frameId);
        } else {
          // 스냅 범위 밖이면 가이드라인 제거
          clearGuides();
        }

        rafRef.current = null;
      });
    },
    [isSnapEnabled, getFrameInfo, setGuides, clearGuides, setResizeSnapCache],
  );

  /**
   * Transform 종료
   *
   * 요소 타입에 따라 다른 변형 처리:
   * - Group: 변형 무시
   * - Path: scale 유지 (width/height 없음)
   * - Text: fontSize scale 적용, width만 변경
   * - 기타: width/height로 변환
   */
  const handleTransformEnd = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // RAF 정리
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // 가이드라인 및 리사이즈 스냅 캐시 정리
      clearGuides();
      setResizeSnapCache(null);

      const id = e.target.id();
      const node = e.target;
      const nodeType = node.getClassName();

      // Group 처리
      if (nodeType === 'Group') {
        // 논리적 컨테이너 (data-group 또는 data-frame)인 경우 먼저 체크 - findOne('Text')보다 우선
        if (node.hasName('data-group') || node.hasName('data-frame')) {
          updateElement(id, {
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          });

          // scale 리셋
          node.scaleX(1);
          node.scaleY(1);
          return;
        }

        // Text 자식이 있는 Group (KonvaText)
        const textChild = (node as Konva.Group).findOne('Text') as Konva.Text;
        if (textChild) {
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          const newWidth = Math.max(30, textChild.width() * scaleX);
          const currentFontSize = textChild.fontSize();
          const newFontSize = Math.max(8, currentFontSize * scaleY);

          // Group scale 리셋
          node.scaleX(1);
          node.scaleY(1);

          // Text 속성 업데이트
          textChild.width(newWidth);
          textChild.fontSize(newFontSize);
          textChild.height(undefined as unknown as number);

          const newHeight = textChild.height();

          updateElement(id, {
            x: node.x(),
            y: node.y(),
            width: newWidth,
            height: newHeight,
            fontSize: newFontSize,
            rotation: node.rotation(),
          });
          return;
        }

        // UI 래퍼 Group은 무시
        return;
      }

      // Path는 width/height가 없으므로 scale 그대로 유지
      if (nodeType === 'Path') {
        updateElement(id, {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
        return;
      }

      // Line/Arrow: scale을 points에 bake
      if (nodeType === 'Line' || nodeType === 'Arrow') {
        const lineNode = node as Konva.Line | Konva.Arrow;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const points = lineNode.points();

        // scale을 points에 적용
        const newPoints = points.map((coord, i) =>
          i % 2 === 0 ? coord * scaleX : coord * scaleY,
        );

        node.scaleX(1);
        node.scaleY(1);

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          points: newPoints,
          rotation: node.rotation(),
        });
        return;
      }

      // Circle: scale을 radius로 bake (keepRatio=true이므로 scaleX만 사용)
      if (nodeType === 'Circle') {
        const circleNode = node as Konva.Circle;
        const scale = node.scaleX(); // keepRatio=true이므로 scaleX === scaleY
        const newRadius = Math.max(5, circleNode.radius() * scale);

        node.scaleX(1);
        node.scaleY(1);

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          radius: newRadius,
          rotation: node.rotation(),
        });
        return;
      }

      // Ellipse: scale을 radiusX/radiusY로 bake
      if (nodeType === 'Ellipse') {
        const ellipseNode = node as Konva.Ellipse;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newRadiusX = Math.max(5, ellipseNode.radiusX() * scaleX);
        const newRadiusY = Math.max(5, ellipseNode.radiusY() * scaleY);

        node.scaleX(1);
        node.scaleY(1);

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          radiusX: newRadiusX,
          radiusY: newRadiusY,
          rotation: node.rotation(),
        });
        return;
      }

      // Star: scale을 innerRadius/outerRadius로 bake (keepRatio=true이므로 scaleX만 사용)
      if (nodeType === 'Star') {
        const starNode = node as Konva.Star;
        const scale = node.scaleX(); // keepRatio=true이므로 scaleX === scaleY
        const newInnerRadius = Math.max(5, starNode.innerRadius() * scale);
        const newOuterRadius = Math.max(5, starNode.outerRadius() * scale);

        node.scaleX(1);
        node.scaleY(1);

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          innerRadius: newInnerRadius,
          outerRadius: newOuterRadius,
          rotation: node.rotation(),
        });
        return;
      }

      // RegularPolygon: scale을 radius로 bake (keepRatio=true이므로 scaleX만 사용)
      if (nodeType === 'RegularPolygon') {
        const polygonNode = node as Konva.RegularPolygon;
        const scale = node.scaleX(); // keepRatio=true이므로 scaleX === scaleY
        const newRadius = Math.max(5, polygonNode.radius() * scale);

        node.scaleX(1);
        node.scaleY(1);

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          radius: newRadius,
          rotation: node.rotation(),
        });
        return;
      }

      // Text는 fontSize에 scale 적용
      if (nodeType === 'Text') {
        const textNode = node as Konva.Text;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        const newWidth = Math.max(30, node.width() * scaleX);
        const currentFontSize = textNode.fontSize();
        const newFontSize = Math.max(8, currentFontSize * scaleY);

        // Konva 노드의 scale을 1로 리셋하고 width 적용
        node.scaleX(1);
        node.scaleY(1);
        textNode.width(newWidth);
        textNode.fontSize(newFontSize);

        // height를 undefined로 설정하여 Konva가 자동 계산하도록 함
        textNode.height(undefined as unknown as number);

        // width 변경 후 자동 계산된 height 가져오기 (텍스트 wrap 반영)
        const newHeight = textNode.height();

        updateElement(id, {
          x: node.x(),
          y: node.y(),
          width: newWidth,
          height: newHeight,
          fontSize: newFontSize,
          rotation: node.rotation(),
        });
        return;
      }

      // 다른 모든 요소들은 width/height로 변환
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      const newWidth = Math.max(5, node.width() * scaleX);
      const newHeight = Math.max(5, node.height() * scaleY);

      // Konva 노드의 scale을 1로 리셋
      node.scaleX(1);
      node.scaleY(1);

      updateElement(id, {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight,
        rotation: node.rotation(),
      });
    },
    [updateElement, clearGuides, setResizeSnapCache],
  );

  return {
    handleTransformStart,
    handleTransform,
    handleTransformEnd,
  };
};
