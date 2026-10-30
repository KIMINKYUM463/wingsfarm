import { useEffect, useState } from 'react';
import { loadIconCategories, type ShapeCategory } from '@/features/editor/constants/shapes';

const NO_CATEGORIES: ShapeCategory[] = [];

/** 아이콘 묶음 — 불러오기 전·실패 시에는 빈 배열 (도형·선·그래픽은 그대로 보인다) */
export const useIconCategories = () => {
  const [categories, setCategories] = useState(NO_CATEGORIES);

  useEffect(() => {
    let alive = true;
    loadIconCategories()
      .then((loaded) => alive && setCategories(loaded))
      .catch((error: unknown) => console.warn('아이콘을 불러오지 못했어요', error));
    return () => {
      alive = false;
    };
  }, []);

  return categories;
};
