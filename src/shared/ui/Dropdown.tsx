'use client';

import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Button from '@/shared/ui/Button/Button';
import useDropdown from '@/shared/hooks/useDropDown';
import clsx from 'clsx';
import DropdownList, { type DropdownOption } from '@/shared/ui/DropdownList';

// Props에 onClick이 있을 수 있음을 명시하는 타입
interface ClickableProps {
  onClick?: (e: ReactMouseEvent) => void;
}

interface DropdownProps<T extends DropdownOption> {
  options: T[];
  onSelect?: (id: string) => void;
  dropdownListClassName?: string;
  className?: string;
  renderButton?: (selected: T | undefined, isOpen: boolean) => ReactNode;
  initialId?: string;
  buttonClassName?: string;
  buttonTextClassName?: string;
  onChangeOption?: (option: T) => void;
  renderOption?: (option: T, isSelected: boolean) => ReactNode;
  placeholder?: string;
  /** 외부에서 absolute 등으로 위치를 제어할 때 true로 설정 */
  disableRelative?: boolean;
}

const Dropdown = <T extends DropdownOption>({
  renderButton,
  options,
  onSelect,
  dropdownListClassName,
  buttonTextClassName = 'p',
  className,
  initialId,
  buttonClassName,
  onChangeOption,
  renderOption,
  placeholder = '옵션 선택',
  disableRelative = false,
}: DropdownProps<T>) => {
  const { isOpen, toggleOpen, dropdownRef, selected, setSelected } = useDropdown<HTMLDivElement, T>(
    {
      options,
      initialId,
    },
  );

  const listRef = useRef<HTMLUListElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !listRef.current) {
      setOpenUpward(false);
      return;
    }

    const listRect = listRef.current.getBoundingClientRect();
    setOpenUpward(listRect.bottom > window.innerHeight);
  }, [isOpen]);

  const getButton = (): ReactNode => {
    if (!renderButton) {
      return (
        <Button
          className={clsx('btn-dropdown h-(--btn-h) px-(--control-x) w-full', buttonClassName)}
          type="button"
          justify="start"
          onClick={(e) => {
            e.stopPropagation();
            toggleOpen();
          }}
        >
          <span className={buttonTextClassName}>{selected?.label || placeholder}</span>
        </Button>
      );
    }

    const customButton = renderButton(selected, isOpen);

    if (!isValidElement(customButton)) {
      return customButton;
    }

    if (isValidElement<ClickableProps>(customButton)) {
      const originalOnClick = customButton.props.onClick;

      return cloneElement(customButton, {
        onClick: (e: ReactMouseEvent) => {
          e.stopPropagation();
          originalOnClick?.(e);
          toggleOpen();
        },
      });
    }
    return customButton;
  };

  const handleItemClick = (e: ReactMouseEvent, id: string) => {
    e.stopPropagation();
    const option = options.find((o) => o.id === id);

    if (option) {
      setSelected(option);
      onChangeOption?.(option);
    }

    onSelect?.(id);
    toggleOpen();
  };

  return (
    <div ref={dropdownRef} className={clsx(!disableRelative && 'relative', isOpen && 'dropdown-open', className)}>
      {getButton()}
      {isOpen && (
        <DropdownList
          ref={listRef}
          options={options}
          selectedId={selected?.id}
          onItemClick={handleItemClick}
          className={clsx(dropdownListClassName, openUpward && 'dropdown-list-up')}
          renderOption={renderOption}
        />
      )}
    </div>
  );
};

export default Dropdown;
