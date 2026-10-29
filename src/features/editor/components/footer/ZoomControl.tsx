'use client';

/**
 * ZoomControl.tsx
 * 캔버스 줌 조절 컴포넌트
 *
 * ## 특징
 * - 현재 줌 퍼센트 표시 (% 접미사 포함)
 * - +/- 버튼으로 5% 단위 조절
 * - 직접 입력 가능
 * - 30% ~ 100% 범위 제한
 */

import clsx from 'clsx';
import IconButton from '@/shared/ui/Button/IconButton';
import Input from '@/shared/ui/Input/Input';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { useCurrentZoom } from '@/features/editor/hooks/useCurrentZoom';
import {
  useSetManualZoom,
  useResetToAutoFit,
  useIsManualZoom,
  ZOOM_LIMITS,
} from '@/features/editor/store/useZoomStore';

interface ZoomControlProps {
  className?: string;
}

const ZoomControl = ({ className }: ZoomControlProps) => {
  const zoomPercentage = useCurrentZoom();
  const setManualZoom = useSetManualZoom();
  const resetToAutoFit = useResetToAutoFit();
  const isManualZoom = useIsManualZoom();

  const handleDecrease = () => {
    const newValue = Math.max(ZOOM_LIMITS.MIN, zoomPercentage - ZOOM_LIMITS.STEP);
    setManualZoom(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(ZOOM_LIMITS.MAX, zoomPercentage + ZOOM_LIMITS.STEP);
    setManualZoom(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseInt(e.target.value) || ZOOM_LIMITS.MIN;
    const clampedValue = Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, inputValue));
    setManualZoom(clampedValue);
  };

  const handleDoubleClick = () => {
    // 더블 클릭 시 자동 맞춤 모드로 리셋
    resetToAutoFit();
  };

  return (
    <div className={clsx('btn-editor-wrap', className)}>
      <ActionTooltip content="화면 축소" direction="top">
        <IconButton
          type="button"
          className="btn-editor min-w-(--btn-h)"
          onClick={handleDecrease}
          icon="check_indeterminate_small"
          disabled={zoomPercentage <= ZOOM_LIMITS.MIN}
        />
      </ActionTooltip>
      <div
        className="relative flex h-full flex-1 items-center"
        onDoubleClick={handleDoubleClick}
        title={isManualZoom ? '더블 클릭하여 자동 맞춤으로 리셋' : '자동 맞춤 모드'}
      >
        <Input
          type="number"
          value={zoomPercentage}
          onChange={handleInputChange}
          min={ZOOM_LIMITS.MIN}
          max={ZOOM_LIMITS.MAX}
          className="h-full w-full pr-6 text-center focus:border focus:border-(--color-point) focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2 text-gray-400">%</span>
      </div>
      <ActionTooltip content="화면 확대" direction="top">
        <IconButton
          type="button"
          className="btn-editor min-w-(--btn-h)"
          onClick={handleIncrease}
          icon="add"
          iconColor="black"
          disabled={zoomPercentage >= ZOOM_LIMITS.MAX}
        />
      </ActionTooltip>
    </div>
  );
};

export default ZoomControl;
