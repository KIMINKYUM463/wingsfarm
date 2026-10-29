'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TemplateListData } from '@/features/editor/types';

type TemplatesContextValue = TemplateListData | null;

const TemplatesContext = createContext<TemplatesContextValue>(null);

interface TemplatesProviderProps {
  children: ReactNode;
  data: TemplateListData | null;
}

/**
 * 템플릿 데이터 Provider
 *
 * SSG로 가져온 데이터를 클라이언트 컴포넌트에 전달하기 위한 Context
 */
export const TemplatesProvider = ({ children, data }: TemplatesProviderProps) => {
  return <TemplatesContext.Provider value={data}>{children}</TemplatesContext.Provider>;
};

/**
 * 템플릿 데이터 조회 훅
 */
export const useTemplates = () => {
  return useContext(TemplatesContext);
};

/**
 * 템플릿 그룹 목록 조회 훅
 */
export const useTemplateGroups = () => {
  const context = useContext(TemplatesContext);
  return context?.groups ?? [];
};
