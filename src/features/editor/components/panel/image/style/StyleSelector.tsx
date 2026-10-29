'use client';

import Image from 'next/image';
import Button from '@/shared/ui/Button/Button';

interface SelectedStyle {
  majorName: string;
  styleName: string;
  thumbnailUrl: string;
}

interface StyleSelectorProps {
  selected: SelectedStyle | null;
  onClick: () => void;
}

/**
 * 연출 스타일 선택기 (접힌 상태)
 *
 * Figma: ai-image-prompt-setup의 label-list 컴포넌트
 */
const StyleSelector = ({ selected, onClick }: StyleSelectorProps) => {
  return (
    <div className="space-y-2">
      <p className="p-bold">연출 스타일</p>
      <Button
        type="button"
        onClick={onClick}
        className="btn-dropdown btn-right flex h-16.5 w-full items-center justify-start gap-2 py-2"
      >
        {selected ? (
          <>
            {/* 썸네일 (왼쪽) */}
            <div className="relative size-9.5 shrink-0">
              <Image
                src={selected.thumbnailUrl}
                alt={selected.styleName}
                fill
                unoptimized
                className="rounded-md border border-gray-100 object-cover"
              />
            </div>
            {/* 텍스트 (중앙) */}
            <div className="flex h-full min-w-0 flex-1 flex-col items-start justify-evenly">
              <span className="description text-gray-300">{selected.majorName}</span>
              <span className="p w-full truncate text-left">{selected.styleName}</span>
            </div>
          </>
        ) : (
          <span className="p text-gray-300">스타일을 선택하세요</span>
        )}
      </Button>
    </div>
  );
};

export default StyleSelector;
