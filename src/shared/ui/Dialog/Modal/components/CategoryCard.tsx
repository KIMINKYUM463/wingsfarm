'use client';

import { clsx } from 'clsx';
import Button from '@/shared/ui/Button/Button';
import Checkbox from '@/shared/ui/Checkbox';

interface CategoryCardProps {
  name: string;
  imageUrl: string;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * CategoryCard - 카테고리 선택 카드
 * - CheckableImage 스타일 참고
 * - 체크마크 + 아이콘 + 이름
 */
const CategoryCard = ({ name, imageUrl, selected = false, onClick }: CategoryCardProps) => {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex w-full min-w-0 flex-col items-center gap-3.25 transition-all duration-300',
        selected && '-translate-y-4',
      )}
    >
      {/* 카테고리 박스 */}
      <div
        className={clsx(
          'relative aspect-square w-full max-w-25 rounded-xl bg-(color-bg-point) flex-center transition-all',
          'hover-border-point cursor-pointer',
          selected && 'border-transparent outline-2 outline-(--color-point) -outline-offset-2',
        )}
      >
        {/* 선택 체크 표시 */}
        {selected && (
          <Checkbox
            checked
            readOnly
            className="absolute top-1.5 left-1.5 z-10"
          />
        )}

        {/* 카테고리 아이콘 - 원본 크기 유지, 중앙 정렬 */}
        <img src={imageUrl} alt={name} />
      </div>

      {/* 카테고리 이름 */}
      <span className="title-1 text-center leading-snug break-keep">{name}</span>
    </Button>
  );
};

export default CategoryCard;
