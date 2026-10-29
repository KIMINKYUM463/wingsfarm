'use client';
import Button from '@/shared/ui/Button/Button';
import clsx from 'clsx';
import Icon from '@/shared/ui/Icon';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { LeftSidebarToggleItem, ToggleState } from '@/shared/types/ui/toggles';

interface ToggleGroupProps {
  items: readonly LeftSidebarToggleItem[];
  wrapClassName?: string;
  btnClassName?: string;
  selectedName?: ToggleState;
  onSelect: (name: ToggleState) => void;
}

const ToggleGroup = ({
  items,
  wrapClassName,
  btnClassName,
  selectedName,
  onSelect,
}: ToggleGroupProps) => {
  return (
    <nav className={wrapClassName}>
      {items.map((item) => {
        const isSelected = item.name === selectedName;
        return (
          <ActionTooltip key={item.name} content={item.label} direction="right">
            <Button
              className={clsx(
                'p-2 rounded-lg',
                isSelected && 'bg-(--color-bg-point) text-(--color-point)',
                btnClassName,
              )}
              onClick={() => onSelect(item.name)}
            >
              <Icon name={item.iconName} fill={isSelected} />
            </Button>
          </ActionTooltip>
        );
      })}
    </nav>
  );
};

export default ToggleGroup;
