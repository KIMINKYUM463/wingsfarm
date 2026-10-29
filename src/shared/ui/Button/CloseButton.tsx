import clsx from 'clsx';
import IconButton from './IconButton';

type CloseButtonVariant = 'overlay' | 'solid';

interface CloseButtonProps {
  onClick?: () => void;
  /** 버튼 스타일 variant */
  variant?: CloseButtonVariant;
  /** 추가 클래스명 */
  className?: string;
  /** 아이콘 크기 */
  iconSize?: number;
  /** 접근성 라벨 */
  ariaLabel?: string;
}

const variantStyles: Record<CloseButtonVariant, string> = {
  /** 부모 hover 시 나타남 (부모에 group 클래스 필요) */
  overlay: 'rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100',
  /** 항상 보임, 버튼 hover 시 배경색 변경 */
  solid: 'rounded bg-gray-900 transition-colors hover:bg-gray-400 active:bg-gray-300',
};

/**
 * 이미지 썸네일 등에 사용되는 닫기 버튼
 *
 * @example
 * // hover 시 나타나는 오버레이 스타일 (부모에 group 클래스 필요)
 * <div className="group relative">
 *   <Image ... />
 *   <CloseButton variant="overlay" onClick={handleRemove} />
 * </div>
 *
 * @example
 * // 항상 보이는 solid 스타일
 * <div className="relative">
 *   <Image ... />
 *   <CloseButton variant="solid" onClick={handleRemove} />
 * </div>
 */
const CloseButton = ({
  onClick,
  variant = 'overlay',
  className,
  iconSize = 14,
  ariaLabel = '닫기',
}: CloseButtonProps) => {
  return (
    <IconButton
      type="button"
      onClick={onClick}
      icon="close"
      iconWidth={iconSize}
      iconHeight={iconSize}
      iconColor="white"
      className={clsx('absolute top-1 right-1 size-5', variantStyles[variant], className)}
      aria-label={ariaLabel}
    />
  );
};

export default CloseButton;
