'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ImageGenerationStylesResponseData } from '@/features/detail-page/types';

type ImageGenerationStylesContextValue = ImageGenerationStylesResponseData | null;

const ImageGenerationStylesContext = createContext<ImageGenerationStylesContextValue>(null);

interface ImageGenerationStylesProviderProps {
  children: ReactNode;
  data: ImageGenerationStylesResponseData | null;
}

/**
 * 이미지 생성 스타일 데이터 Provider
 *
 * SSG로 가져온 데이터를 클라이언트 컴포넌트에 전달하기 위한 Context
 */
export const ImageGenerationStylesProvider = ({
  children,
  data,
}: ImageGenerationStylesProviderProps) => {
  return (
    <ImageGenerationStylesContext.Provider value={data}>
      {children}
    </ImageGenerationStylesContext.Provider>
  );
};

/**
 * 이미지 생성 스타일 데이터 조회 훅
 */
export const useImageGenerationStyles = () => {
  const context = useContext(ImageGenerationStylesContext);
  return context;
};

/**
 * 이미지 생성 스타일 majors 목록 조회 훅
 */
export const useImageGenerationMajors = () => {
  const context = useContext(ImageGenerationStylesContext);
  return context?.majors ?? [];
};
