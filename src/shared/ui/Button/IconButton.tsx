import { forwardRef } from 'react';
import { clsx } from 'clsx';
import Button from './Button';
import { ButtonProps } from '@/shared/types/ui';
import Icon, { IconName } from '@/shared/ui/Icon';

type IconButtonProps = Omit<ButtonProps, 'children'> & {
  /**
   * 기본 아이콘 이름 (Material Symbols)
   */
  icon?: IconName;
  /**
   * 커스텀 아이콘 (선택적)
   * icon보다 우선순위가 높습니다
   */
  customIcon?: React.ReactNode;
  /**
   * 버튼 텍스트 (선택적)
   */
  text?: string;
  /**
   * 텍스트 스타일 클래스
   * @default 'title-1'
   */
  textClassName?: string;
  /**
   * 아이콘 위치
   * @default 'left'
   */
  iconPosition?: 'left' | 'right';
  /**
   * 아이콘 너비 (px)
   * @default 24
   */
  iconWidth?: number;
  /**
   * 아이콘 높이 (px)
   * @default 24
   */
  iconHeight?: number;
  /**
   * 아이콘 색상
   */
  iconColor?: string;
};

/**
 * 아이콘이 포함된 버튼 컴포넌트
 * 아이콘 위치를 왼쪽 또는 오른쪽으로 지정할 수 있습니다.
 *
 * @example
 * ```tsx
 * // 아이콘 + 텍스트 (왼쪽)
 * <IconButton icon="add" text="다운로드" />
 *
 * // 아이콘 + 텍스트 (오른쪽)
 * <IconButton icon="arrow_forward" text="시작하기" iconPosition="right" />
 *
 * // 아이콘만
 * <IconButton icon="delete" />
 *
 * // 커스텀 텍스트 스타일
 * <IconButton icon="person" text="로그인" textClassName="p-bold" />
 *
 * // 커스텀 아이콘 크기 및 색상
 * <IconButton icon="credit_card" iconWidth={28} iconHeight={28} iconColor="red" />
 *
 * // 커스텀 아이콘 사용
 * <IconButton customIcon={<CustomIcon name="profile" />} text="프로필" />
 * ```
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      customIcon,
      text,
      textClassName = 'title-1',
      iconPosition = 'left',
      iconWidth = 24,
      iconHeight = 24,
      iconColor,
      className,
      ...props
    },
    ref,
  ) => {
    const iconElement =
      customIcon ?? (icon && <Icon name={icon} width={iconWidth} height={iconHeight} color={iconColor} />);
    const textElement = text && <span className={clsx(textClassName)}>{text}</span>;

    return (
      <Button ref={ref} className={className} {...props}>
        {iconPosition === 'left' ? (
          <>
            {iconElement}
            {textElement}
          </>
        ) : (
          <>
            {textElement}
            {iconElement}
          </>
        )}
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';

export default IconButton;
