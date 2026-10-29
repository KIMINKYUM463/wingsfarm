'use client';

import { useState } from 'react';

// 제네릭 T를 사용하여 초기값과 반환값의 타입을 동적으로 지정
export const useToggle = <T>(initialValue: T) => {
  const [toggle, setToggle] = useState<T>(initialValue);

  const handleToggle = (newValue: T) => {
    setToggle(newValue);
  };

  return [toggle, handleToggle] as const;
};
