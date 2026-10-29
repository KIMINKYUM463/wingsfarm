'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { GraphicElement } from '@/shared/types/elements';

type GraphicElementsContextValue = GraphicElement[] | null;

const GraphicElementsContext = createContext<GraphicElementsContextValue>(null);

interface GraphicElementsProviderProps {
  children: ReactNode;
  data: GraphicElement[] | null;
}

/**
 * 그래픽 요소 데이터 Provider
 *
 * ISR로 가져온 데이터를 클라이언트 컴포넌트에 전달하기 위한 Context
 */
export const GraphicElementsProvider = ({ children, data }: GraphicElementsProviderProps) => {
  return (
    <GraphicElementsContext.Provider value={data}>{children}</GraphicElementsContext.Provider>
  );
};

/**
 * 그래픽 요소 목록 조회 훅
 */
export const useGraphicElements = () => {
  const context = useContext(GraphicElementsContext);
  return context ?? [];
};
