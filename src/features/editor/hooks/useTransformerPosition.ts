import { useEffect, useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import useWindowSize from '@/shared/hooks/useWindowSize';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useIsDragging } from '@/features/editor/store/useSelectionStore';

interface TransformerPosition {
  topY: number;
  centerX: number;
}

const HANDLE_OFFSET = 50; // SelectionToolbox(42px) + gap(8px)

/**
 * Konva Transformer의 상단 중앙 위치를 추적합니다.
 *
 * ## 재계산 트리거
 * - selectedIds 변경 (요소 선택/해제)
 * - isToolPanelOpen 변경 (패널 열기/닫기)
 * - viewportWidth 변경 (창 크기 조절)
 * - transform 이벤트 (요소 변형)
 *
 * ## 타이밍
 * - 더블 RAF 사용: Konva 렌더링 완료 후 좌표 계산
 * - 첫 번째 RAF: React → Konva 상태 동기화
 * - 두 번째 RAF: 정확한 getClientRect() 호출
 *
 * ## 주의사항
 * - SelectionOverlay는 offset이 없는 별도 Layer에 배치해야 함
 * - getClientRect()는 Stage 좌표를 반환하므로, Layer offset이 적용된 Layer 내부에서
 *   사용하면 double-counting 발생
 *
 * @param transformerRef - Konva Transformer ref
 * @param selectedIds - 선택된 요소 ID 배열
 * @returns Transformer 상단 중앙의 Stage 좌표
 */
export const useTransformerPosition = (
  transformerRef: React.RefObject<Konva.Transformer | null>,
  selectedIds?: string[],
): TransformerPosition => {
  const [position, setPosition] = useState<TransformerPosition>({
    topY: 0,
    centerX: 0,
  });

  // 레이아웃 변경 감지 (패널 열기/닫기, 창 크기 변경, 드래그 종료)
  const isToolPanelOpen = useIsToolPanelOpen();
  const { width: viewportWidth } = useWindowSize(100);
  const isDragging = useIsDragging();

  // RAF ID 저장 (중복 방지용)
  const rafRef = useRef<number | null>(null);

  // 위치 업데이트 함수 (RAF 쓰로틀링)
  const updatePosition = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // 이미 RAF 예약됨 → 스킵 (프레임당 1회 제한)
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      // RAF 실행 시점에 transformer 재확인 (race condition 방어)
      const tr = transformerRef.current;
      if (!tr) {
        rafRef.current = null;
        return;
      }

      // 노드 유효성 확인 (빠른 선택 해제 시 transform 이벤트 방어)
      const nodes = tr.nodes();
      if (nodes.length === 0 || !nodes.every((node) => node?.getStage())) {
        rafRef.current = null;
        return;
      }

      const box = tr.getClientRect();
      const newTopY = box.y - HANDLE_OFFSET;
      const newCenterX = box.x + box.width / 2;

      // 값이 실제로 변경된 경우에만 업데이트 (무한 루프 방지)
      setPosition((prev) => {
        if (prev.topY === newTopY && prev.centerX === newCenterX) {
          return prev;
        }
        return { topY: newTopY, centerX: newCenterX };
      });
      rafRef.current = null;
    });
  }, [transformerRef]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // Transform 이벤트 리스너 등록
    transformer.on('transform', updatePosition);
    transformer.on('transformend', updatePosition);

    // Cleanup
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      transformer.off('transform', updatePosition);
      transformer.off('transformend', updatePosition);
    };
  }, [transformerRef, updatePosition]);

  // selectedIds 또는 레이아웃 변경 시 위치 재계산
  useEffect(() => {
    // 선택된 요소가 없으면 위치 초기화
    if (!selectedIds?.length) {
      setPosition({ topY: 0, centerX: 0 });
      return;
    }

    let innerRafId: number | null = null;

    // 더블 RAF: 레이아웃 변경(패널 열기/닫기) 시 정확한 좌표 계산 보장
    const outerRafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(() => {
        const transformer = transformerRef.current;
        if (!transformer) return;

        // 모든 노드가 유효한지 확인 (스테이지에 마운트됨)
        const nodes = transformer.nodes();
        const allNodesValid = nodes.length > 0 && nodes.every((node) => node?.getStage());
        if (!allNodesValid) {
          setPosition({ topY: 0, centerX: 0 });
          return;
        }

        try {
          transformer.forceUpdate();
        } catch {
          // race condition 방어
          setPosition({ topY: 0, centerX: 0 });
          return;
        }

        const box = transformer.getClientRect();
        setPosition((prev) => {
          const newTopY = box.y - HANDLE_OFFSET;
          const newCenterX = box.x + box.width / 2;
          if (prev.topY === newTopY && prev.centerX === newCenterX) return prev;
          return { topY: newTopY, centerX: newCenterX };
        });
      });
    });

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId !== null) cancelAnimationFrame(innerRafId);
    };
    // isToolPanelOpen, viewportWidth, isDragging: 값 자체는 사용하지 않지만, 변경 시 재계산 트리거 목적
  }, [selectedIds, transformerRef, isToolPanelOpen, viewportWidth, isDragging]);

  return position;
};
