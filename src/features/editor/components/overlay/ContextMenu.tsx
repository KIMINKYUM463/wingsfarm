'use client';

import { useState, useLayoutEffect, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/shared/ui/Icon';
import CustomIcon from '@/shared/ui/CustomIcon';
import clsx from 'clsx';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useClipboardStore } from '@/features/editor/store/useClipboardStore';

// ============================================================
// Types
// ============================================================

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  targetId: string;
}

interface MenuItemType {
  icon?: string;
  customIcon?: React.ReactNode;
  label: string;
  shortcut?: string[];
  hasSubmenu?: boolean;
}

interface MenuItemProps extends MenuItemType {
  onClick: () => void;
  isActive?: boolean;
}

interface SubmenuPosition {
  horizontal: 'right' | 'left';
  vertical: 'down' | 'up';
}

// ============================================================
// Constants
// ============================================================

const VIEWPORT_PADDING = 8;
const SUBMENU_CLOSE_DELAY = 150; // 서브메뉴 닫힘 딜레이 (대각선 이동 허용)

// 클라이언트에서 한 번만 계산 (SSR 환경에서는 false)
const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform);

const LAYER_SUBMENU_ITEMS: MenuItemType[] = [
  { customIcon: <CustomIcon name="front" width={24} height={24} />, label: '맨 앞으로 가져오기', shortcut: ['mod', 'alt', ']'] },
  { customIcon: <CustomIcon name="first" width={24} height={24} />, label: '앞으로 가져오기', shortcut: ['mod', ']'] },
  { customIcon: <CustomIcon name="behind" width={24} height={24} />, label: '뒤로 보내기', shortcut: ['mod', '['] },
  { customIcon: <CustomIcon name="back" width={24} height={24} />, label: '맨 뒤로 보내기', shortcut: ['mod', 'alt', '['] },
];

// ============================================================
// Utils
// ============================================================

const processShortcuts = (items: MenuItemType[], isMac: boolean): MenuItemType[] => {
  const modKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = '⇧';
  const altKey = isMac ? '⌥' : 'Alt';

  return items.map((item) => {
    if (!item.shortcut) return item;
    return {
      ...item,
      shortcut: item.shortcut.map((key) => {
        if (key === 'mod') return modKey;
        if (key === 'shift') return shiftKey;
        if (key === 'alt') return altKey;
        return key;
      }),
    };
  });
};

const calcMenuPosition = (
  x: number,
  y: number,
  menuRect: DOMRect,
): { x: number; y: number } => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let newX = x;
  let newY = y;

  // 우측 경계 체크
  if (x + menuRect.width > viewportWidth - VIEWPORT_PADDING) {
    newX = Math.max(VIEWPORT_PADDING, viewportWidth - menuRect.width - VIEWPORT_PADDING);
  }

  // 하단 경계 체크 → 위로 열기
  if (y + menuRect.height > viewportHeight - VIEWPORT_PADDING) {
    newY = y - menuRect.height;
    if (newY < VIEWPORT_PADDING) {
      newY = VIEWPORT_PADDING;
    }
  }

  return { x: newX, y: newY };
};

const calcSubmenuPosition = (
  menuRect: DOMRect,
  submenuRect: DOMRect,
): SubmenuPosition => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const horizontal: 'right' | 'left' =
    menuRect.right + submenuRect.width > viewportWidth - VIEWPORT_PADDING &&
    menuRect.left - submenuRect.width > VIEWPORT_PADDING
      ? 'left'
      : 'right';

  const vertical: 'down' | 'up' =
    submenuRect.bottom > viewportHeight - VIEWPORT_PADDING ? 'up' : 'down';

  return { horizontal, vertical };
};

// ============================================================
// Sub Components
// ============================================================

const ShortcutKey = ({ keyNames }: { keyNames: string[] }) => (
  <div className="flex items-center gap-1">
    {keyNames.map((key, index) => (
      <p
        key={index}
        className="bg-gray-50 w-7 h-7 flex-center rounded-md border border-(--color-border) text-gray-300"
      >
        {key}
      </p>
    ))}
  </div>
);

const MenuItem = ({ icon, customIcon, label, shortcut, hasSubmenu, onClick, isActive }: MenuItemProps) => {
  const iconElement = customIcon ?? (icon && <Icon name={icon as any} width={24} height={24} />);

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center justify-between gap-3 p-1 hover:bg-gray-50 rounded-lg transition-colors',
        { 'bg-gray-50': isActive },
      )}
    >
      <div className="flex items-center gap-2 py-1 px-1.5">
        {iconElement}
        <p>{label}</p>
      </div>
      {hasSubmenu && <Icon name="keyboard_arrow_right" />}
      {shortcut && <ShortcutKey keyNames={shortcut} />}
    </button>
  );
};

// ============================================================
// Main Component
// ============================================================

const ContextMenu = ({ x, y, onClose, targetId }: ContextMenuProps) => {
  // Refs
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [showLayerSubmenu, setShowLayerSubmenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x, y });
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition>({
    horizontal: 'right',
    vertical: 'down',
  });

  // Store
  const selectedItems = useSelectionStore((state) => state.selectedItems);
  const getElement = useElementStore((state) => state.getElement);
  const createGroup = useElementStore((state) => state.createGroup);
  const ungroupElements = useElementStore((state) => state.ungroupElements);
  const deleteElement = useElementStore((state) => state.deleteElement);
  const duplicateElement = useElementStore((state) => state.duplicateElement);
  const pasteElements = useElementStore((state) => state.pasteElements);
  const moveToTop = useElementStore((state) => state.moveToTop);
  const moveUp = useElementStore((state) => state.moveUp);
  const moveDown = useElementStore((state) => state.moveDown);
  const moveToBottom = useElementStore((state) => state.moveToBottom);

  // Clipboard
  const copyToClipboard = useClipboardStore((state) => state.copy);
  const copiedElements = useClipboardStore((state) => state.copiedElements);

  // Derived State
  const targetElement = getElement(targetId);
  const isGroupSelected = targetElement?.type === 'group';
  // 그룹 생성 조건: 2개 이상 + 모두 같은 프레임에 있어야 함
  const canCreateGroup =
    selectedItems.length >= 2 &&
    new Set(selectedItems.map((item) => item.rootId)).size === 1;

  // Menu Items (메모이제이션)
  const menuItems = useMemo<MenuItemType[]>(() => [
    { icon: 'content_copy', label: '복사', shortcut: ['mod', 'C'] },
    { icon: 'content_paste', label: '붙여넣기', shortcut: ['mod', 'V'] },
    { icon: 'library_add', label: '복제', shortcut: ['mod', 'D'] },
    { icon: 'stacks', label: '레이어', hasSubmenu: true },
    { icon: 'delete', label: '삭제', shortcut: ['Del'] },
    ...(isGroupSelected
      ? [{ customIcon: <CustomIcon name="ungroup" width={24} height={24} />, label: '그룹 해제', shortcut: ['mod', 'shift', 'G'] }]
      : canCreateGroup
        ? [{ customIcon: <CustomIcon name="group" width={24} height={24} />, label: '그룹', shortcut: ['mod', 'G'] }]
        : []),
  ], [isGroupSelected, canCreateGroup]);

  const processedMenuItems = useMemo(
    () => processShortcuts(menuItems, IS_MAC),
    [menuItems],
  );

  const processedLayerSubmenuItems = useMemo(
    () => processShortcuts(LAYER_SUBMENU_ITEMS, IS_MAC),
    [],
  );

  // Effects
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    setMenuPosition(calcMenuPosition(x, y, menuRect));
  }, [x, y]);

  useEffect(() => {
    if (!showLayerSubmenu || !menuRef.current || !submenuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const submenuRect = submenuRef.current.getBoundingClientRect();
    setSubmenuPosition(calcSubmenuPosition(menuRect, submenuRect));
  }, [showLayerSubmenu]);

  useClickOutside(contextMenuRef, {
    onClickOutside: onClose,
    onEscape: onClose,
  });

  // Handlers
  const handleMenuItemClick = useCallback((label: string) => {
    const frameId = selectedItems[0]?.rootId || (targetElement as { rootId?: string })?.rootId;

    switch (label) {
      case '복사': {
        // 선택된 요소들을 클립보드에 복사
        const elementsToCopy = selectedItems
          .map((item) => getElement(item.id))
          .filter((el): el is NonNullable<typeof el> => el !== undefined);
        if (elementsToCopy.length > 0 && frameId) {
          copyToClipboard(elementsToCopy, frameId);
        }
        break;
      }
      case '붙여넣기': {
        // 클립보드에서 요소 붙여넣기
        if (copiedElements.length > 0 && frameId) {
          pasteElements(frameId, copiedElements);
        }
        break;
      }
      case '복제':
        duplicateElement(targetId);
        break;
      case '삭제':
        selectedItems.forEach((item) => deleteElement(item.id));
        break;
      case '그룹':
        if (selectedItems.length >= 2 && frameId) {
          createGroup(frameId, selectedItems.map((item) => item.id));
        }
        break;
      case '그룹 해제':
        ungroupElements(targetId);
        break;
      // 레이어 순서 변경
      case '맨 앞으로 가져오기':
        moveToTop(targetId);
        break;
      case '앞으로 가져오기':
        moveUp(targetId);
        break;
      case '뒤로 보내기':
        moveDown(targetId);
        break;
      case '맨 뒤로 보내기':
        moveToBottom(targetId);
        break;
    }
    onClose();
  }, [selectedItems, targetId, targetElement, getElement, deleteElement, duplicateElement, createGroup, ungroupElements, copyToClipboard, copiedElements, pasteElements, moveToTop, moveUp, moveDown, moveToBottom, onClose]);

  // 서브메뉴 호버 핸들러 (대각선 이동 지원)
  const handleSubmenuAreaEnter = useCallback(() => {
    // 닫힘 타이머 취소
    if (submenuCloseTimeoutRef.current) {
      clearTimeout(submenuCloseTimeoutRef.current);
      submenuCloseTimeoutRef.current = null;
    }
    setShowLayerSubmenu(true);
  }, []);

  const handleSubmenuAreaLeave = useCallback(() => {
    // 딜레이 후 닫기 (대각선 이동 허용)
    submenuCloseTimeoutRef.current = setTimeout(() => {
      setShowLayerSubmenu(false);
    }, SUBMENU_CLOSE_DELAY);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (submenuCloseTimeoutRef.current) {
        clearTimeout(submenuCloseTimeoutRef.current);
      }
    };
  }, []);

  const menuContent = (
    <div
      ref={contextMenuRef}
      className="fixed"
      style={{ left: menuPosition.x, top: menuPosition.y, zIndex: 2147483647 }}
    >
      <div ref={menuRef} className="bg-white rounded-lg shadow-(--shadow-1) w-72 p-1">
        {processedMenuItems.map((item, index) => (
          <div
            key={index}
            className="relative"
            onMouseEnter={() => item.hasSubmenu && handleSubmenuAreaEnter()}
            onMouseLeave={() => item.hasSubmenu && handleSubmenuAreaLeave()}
          >
            <MenuItem
              {...item}
              onClick={() => !item.hasSubmenu && handleMenuItemClick(item.label)}
              isActive={item.hasSubmenu && showLayerSubmenu}
            />

            {item.hasSubmenu && showLayerSubmenu && (
              <div
                ref={submenuRef}
                className={clsx('absolute', {
                  'left-full ml-1': submenuPosition.horizontal === 'right',
                  'right-full mr-1': submenuPosition.horizontal === 'left',
                  '-top-1': submenuPosition.vertical === 'down',
                  'bottom-0': submenuPosition.vertical === 'up',
                })}
                onMouseEnter={handleSubmenuAreaEnter}
                onMouseLeave={handleSubmenuAreaLeave}
              >
                <div className="bg-white rounded-lg shadow-(--shadow-1) w-72 p-1">
                  {processedLayerSubmenuItems.map((subItem, subIndex) => (
                    <MenuItem
                      key={subIndex}
                      {...subItem}
                      onClick={() => handleMenuItemClick(subItem.label)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Portal을 사용하여 document.body에 렌더링 (모든 요소 위에 표시)
  if (typeof document === 'undefined') return null;
  return createPortal(menuContent, document.body);
};

export default ContextMenu;
