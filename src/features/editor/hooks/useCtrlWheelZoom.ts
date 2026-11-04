/**
 * Ctrl(⌘) + 마우스 휠로 캔버스 확대·축소
 * - 휠 한 칸마다 10%씩 증가/감소
 * - 연속 휠 시 값이 덮이지 않도록 ref를 먼저 갱신
 * - 브라우저 자체 확대는 preventDefault로 막음
 */

import { useEffect, useRef } from 'react';
import { useCurrentZoom } from '@/features/editor/hooks/useCurrentZoom';
import { useSetManualZoom, ZOOM_LIMITS } from '@/features/editor/store/useZoomStore';

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
};

export const useCtrlWheelZoom = () => {
  const zoomPercentage = useCurrentZoom();
  const setManualZoom = useSetManualZoom();
  const zoomRef = useRef(zoomPercentage);
  zoomRef.current = zoomPercentage;

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.defaultPrevented) return;
      if (e.deltaY === 0) return;

      e.preventDefault();

      // 휠 위(+10%) / 휠 아래(-10%)
      const step = e.deltaY < 0 ? ZOOM_LIMITS.STEP : -ZOOM_LIMITS.STEP;
      const next = Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, zoomRef.current + step));
      zoomRef.current = next;
      setManualZoom(next);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setManualZoom]);
};
