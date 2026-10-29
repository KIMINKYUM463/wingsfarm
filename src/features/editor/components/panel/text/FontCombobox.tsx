'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import clsx from 'clsx';
import Button from '@/shared/ui/Button/Button';
import useDropdown from '@/shared/hooks/useDropDown';
import {
  FONT_DEFINITIONS,
  WEIGHT_LABELS,
  getFontByFamily,
  type FontDefinition,
} from '@/features/editor/constants/fonts';
import Icon from '@/shared/ui/Icon';

interface FontComboboxProps {
  currentFamily: string;
  currentWeight: number;
  onSelect: (family: string, weight: number) => void;
  className?: string;
  /** 다중 선택 시 폰트 family가 다르면 true → "혼합" 표시 */
  isFamilyMixed?: boolean;
  /** 다중 선택 시 폰트 weight가 다르면 true → weight 생략 */
  isWeightMixed?: boolean;
}

const MIXED_LABEL = '혼합';

const FontCombobox = ({
  currentFamily,
  currentWeight,
  onSelect,
  className,
  isFamilyMixed = false,
  isWeightMixed = false,
}: FontComboboxProps) => {
  const { isOpen, setIsOpen, dropdownRef } = useDropdown<HTMLDivElement>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // 드롭다운 닫힐 때 편집 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // 현재 선택된 폰트 라벨
  // - family 다르면: "혼합"
  // - family 같고 weight 다르면: "Pretendard" (weight 생략)
  // - 둘 다 같으면: "Pretendard Regular"
  const currentFont = getFontByFamily(currentFamily);
  const currentLabel = isFamilyMixed
    ? MIXED_LABEL
    : currentFont
      ? isWeightMixed
        ? currentFont.label
        : `${currentFont.label} ${WEIGHT_LABELS[currentWeight] || currentWeight}`
      : currentFamily;

  // 검색 필터링
  const filteredFonts = useMemo(() => {
    if (!searchQuery.trim()) return FONT_DEFINITIONS;
    const query = searchQuery.toLowerCase();
    return FONT_DEFINITIONS.filter(
      (font) =>
        font.label.toLowerCase().includes(query) || font.family.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!isEditing) setIsEditing(true);
  };

  const handleSelect = (font: FontDefinition, weight: number) => {
    onSelect(font.family, weight);
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={clsx('relative', isOpen && 'dropdown-open', className)}>
      <Button type="button" className="btn-dropdown h-10 w-full" onClick={() => setIsOpen(!isOpen)}>
        <input
          type="text"
          value={isEditing ? searchQuery : currentLabel}
          onChange={handleInputChange}
          onClick={(e) => {
            if (!isOpen) return; // 닫힌 상태: 버튼으로 이벤트 전파 → 열기
            e.stopPropagation(); // 열린 상태: 버튼 클릭 방지
            if (!isEditing) {
              setIsEditing(true);
              setSearchQuery(currentLabel);
            }
          }}
          placeholder={currentLabel}
          className={clsx(
            'title-1 w-full bg-transparent outline-none',
            !isEditing && 'cursor-pointer',
          )}
          readOnly={!isEditing}
          style={!isEditing && !isFamilyMixed ? { fontFamily: currentFamily, fontWeight: currentWeight } : undefined}
        />
      </Button>

      {isOpen && (
        <div className="dropdown-list my-0 max-h-127.5 w-full overflow-y-auto p-1">
          {filteredFonts.length === 0 ? (
            <div className="flex h-10 items-center px-3 text-gray-300">검색 결과가 없습니다</div>
          ) : (
            filteredFonts.map((font) => {
              // family 혼합이면 어떤 폰트도 선택 표시 안 함
              const isCurrentFont = !isFamilyMixed && font.family === currentFamily;
              const hasMultipleWeights = font.weights.length > 1;

              // Weight 1개: 하위 항목과 동일한 indent (12px + 24px icon + 8px gap = 44px)
              if (!hasMultipleWeights) {
                const weight = font.weights[0];
                const isSelected = isCurrentFont && currentWeight === weight;

                return (
                  <div
                    key={font.id}
                    onClick={() => handleSelect(font, weight)}
                    className={clsx(
                      'flex min-h-10 cursor-pointer items-center rounded-md pr-3 pl-11 hover:bg-gray-50 active:bg-gray-100',
                      isSelected && 'bg-gray-50',
                    )}
                  >
                    <span style={{ fontFamily: font.family, fontWeight: weight }}>
                      {font.label}
                    </span>
                  </div>
                );
              }

              // Weight 여러 개: 아코디언
              return (
                <details key={font.id} open={isCurrentFont} className="group">
                  <summary
                    className={clsx(
                      'flex h-10 cursor-pointer list-none items-center gap-2 rounded-md px-3 hover:bg-gray-50 active:bg-gray-100',
                      isCurrentFont && 'bg-gray-50',
                    )}
                  >
                    <Icon
                      name="chevron_right"
                      width={24}
                      className="text-gray-400 transition-transform group-open:rotate-90"
                    />
                    <span style={{ fontFamily: font.family }}>{font.label}</span>
                  </summary>
                  {font.weights.map((weight) => {
                    // weight 혼합이면 하위 weight 선택 표시 안 함
                    const isSelected = isCurrentFont && !isWeightMixed && currentWeight === weight;

                    return (
                      <div
                        key={`${font.id}-${weight}`}
                        onClick={() => handleSelect(font, weight)}
                        className={clsx(
                          'flex min-h-10 cursor-pointer items-center rounded-md pr-3 pl-11 hover:bg-gray-50 active:bg-gray-100',
                          isSelected && 'bg-gray-50',
                        )}
                      >
                        <span style={{ fontFamily: font.family, fontWeight: weight }}>
                          {font.label} {WEIGHT_LABELS[weight] || weight}
                        </span>
                      </div>
                    );
                  })}
                </details>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default FontCombobox;
