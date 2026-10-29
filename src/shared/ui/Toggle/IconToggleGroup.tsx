import Button from '@/shared/ui/Button/Button';
import Icon, { type IconName } from '@/shared/ui/Icon';
import ActionTooltip, { type TooltipDirection } from '@/shared/ui/Tooltip/ActionTooltip';
import clsx from 'clsx';
import React from 'react';

type IconToggleItem = {
  iconName?: IconName;
  customIcon?: React.ReactNode;
  onClick?: (index: number, isActive: boolean, e: React.MouseEvent) => void;
  isActive?: boolean;
  disabled?: boolean;
  iconColor?: string;
  /** 툴팁 텍스트 */
  tooltip?: string;
};

interface IconToggleGroupProps {
  items: IconToggleItem[];
  className?: string;
  /** 툴팁 방향 (기본: bottom) */
  tooltipDirection?: TooltipDirection;
}

const CommonIconToggleGroup = ({
  items,
  className,
  tooltipDirection = 'bottom',
}: IconToggleGroupProps) => {
  const handleClick = (index: number, e: React.MouseEvent) => {
    if (items[index].disabled) return;

    const wasActive = items[index].isActive || false;
    const willBeActive = !wasActive;

    items[index].onClick?.(index, willBeActive, e);
  };

  return (
    <div className={clsx('btn-editor-wrap', className)}>
      {items.map((item, index) => {
        const iconElement =
          item.customIcon ??
          (item.iconName && <Icon name={item.iconName} color={item.iconColor} />);

        const button = (
          <Button
            type="button"
            key={index}
            className={clsx('btn-editor flex-1', {
              active: item.isActive,
              'cursor-not-allowed': item.disabled,
            })}
            onClick={(e) => handleClick(index, e)}
          >
            {iconElement}
          </Button>
        );

        if (item.tooltip) {
          return (
            <ActionTooltip
              key={index}
              content={item.tooltip}
              direction={tooltipDirection}
            >
              {button}
            </ActionTooltip>
          );
        }

        return button;
      })}
    </div>
  );
};

export default CommonIconToggleGroup;
