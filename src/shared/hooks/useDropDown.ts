import { useEffect, useMemo, useRef, useState } from 'react';

interface UseDropdownOptions<T extends { id: string; label: string }> {
  options: T[];
  initialId?: string;
}

const useDropdown = <
  TElement extends HTMLElement,
  TOption extends { id: string; label: string } = { id: string; label: string },
>(
  optionsConfig?: UseDropdownOptions<TOption>,
) => {
  const [isOpen, setOpen] = useState(false);
  const dropdownRef = useRef<TElement>(null);

  // 초기 옵션 계산
  const initialOption = useMemo(() => {
    if (!optionsConfig) return undefined;

    if (optionsConfig.initialId !== undefined) {
      const found = optionsConfig.options.find((o) => o.id === optionsConfig.initialId);
      if (found) return found;
    }
    return undefined;
  }, [optionsConfig]);

  // 선택된 옵션 상태
  const [selected, setSelected] = useState<TOption | undefined>(initialOption);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleOpen = () => setOpen((prev) => !prev);

  return {
    isOpen,
    setIsOpen: setOpen,
    toggleOpen,
    dropdownRef,
    selected,
    setSelected,
  };
};

export default useDropdown;
