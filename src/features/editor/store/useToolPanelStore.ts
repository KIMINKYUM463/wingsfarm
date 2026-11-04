/**
 * useToolPanelStore.ts
 * 우측 Tool Panel 상태 관리
 *
 * ## 책임
 * - 현재 선택된 Tool (TEXT, IMAGE, SHAPE 등)
 * - 더보기 화면 스택 관리
 * - 텍스트 요소 전용 토글 상태
 *
 * ## 사용처
 * - LeftSideBar (Tool 선택)
 * - ToolPanel (패널 렌더링)
 * - SelectionToolbox (텍스트 생성기)
 */

import React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ToggleState } from '@/shared/types/ui/toggles';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { TextToggleState, TEXT_TOGGLE_STATES } from '@/shared/types/editor/textToggle';
import { isMoreView } from '@/shared/utils/toggleUtils';

export interface ProductImageItem {
  id: string;
  name: string | null;
  thumbnailUrl?: string | null;
  category?: string;
  updatedAt?: string;
  // 스타일 선택용 확장 필드
  price?: number;
  /** 부모 이름 (대분류명 등) - 선택기 라벨 표시용 */
  parentName?: string;
  /** 섹션/그룹명 (중분류명 등) - 그룹 헤더 표시용 */
  groupName?: string;
  /** 샘플 이미지 URL 목록 (스타일 프리셋 호버 프리뷰용) */
  sampleImageUrls?: string[];
  /** 템플릿 미리보기 URL (돋보기 버튼 → 팝업) */
  previewUrl?: string;
  /** 원본 API 데이터 (계층 구조 등 추가 정보 필요시) */
  data?: unknown;
  /** 구성명 (템플릿 적용 시 낙관적 업데이트용) */
  part2?: string;
  /** Shape 프리뷰용 React 노드 (ShapeItemGrid 렌더링) */
  preview?: React.ReactNode;
}

interface MoreViewData {
  type: ToggleState;
  originalTool: ToggleState;
  title: string;
  items: ProductImageItem[];
  onSelect: (item: ProductImageItem) => void;
}

interface ToolPanelState {
  // Tool 관련
  selectedTool: ToggleState;
  textToggleState: TextToggleState;

  // 더보기 관련 (스택 기반)
  moreViewStack: MoreViewData[];

  // Actions
  setSelectedTool: (tool: ToggleState) => void;
  setTextToggleState: (state: TextToggleState) => void;
  resetTextToggleState: () => void;
  pushMoreView: (
    moreViewType: ToggleState,
    title: string,
    items: ProductImageItem[],
    onSelect: (item: ProductImageItem) => void,
    originalTool?: ToggleState,
  ) => void;
  popMoreView: () => void;
  clearMoreView: () => void;
  /** 스택 최상단을 교체 (pop + push를 atomic하게 처리) */
  replaceMoreView: (
    moreViewType: ToggleState,
    title: string,
    items: ProductImageItem[],
    onSelect: (item: ProductImageItem) => void,
  ) => void;
}

export const useToolPanelStore = create<ToolPanelState>()(
  devtools(
    (set) => ({
      selectedTool: TOGGLE_STATES.NONE,
      textToggleState: TEXT_TOGGLE_STATES.DEFAULT,
      moreViewStack: [],

      setSelectedTool: (tool: ToggleState) => {
        set((state) => {
          // 주요 툴(더보기가 아닌 툴)로 전환 시 moreViewStack 초기화
          if (!isMoreView(tool) && state.moreViewStack.length > 0) {
            return { selectedTool: tool, moreViewStack: [] };
          }
          return { selectedTool: tool };
        });
      },

      setTextToggleState: (state: TextToggleState) => {
        set({ textToggleState: state });
      },

      resetTextToggleState: () => {
        set({ textToggleState: TEXT_TOGGLE_STATES.DEFAULT });
      },

      pushMoreView: (
        moreViewType: ToggleState,
        title: string,
        items: ProductImageItem[],
        onSelect: (item: ProductImageItem) => void,
        originalTool?: ToggleState,
      ) => {
        set((state) => {
          const resolvedOriginalTool: ToggleState =
            originalTool ||
            (state.moreViewStack.length > 0
              ? state.moreViewStack.at(0)?.originalTool
              : state.selectedTool) ||
            state.selectedTool;

          return {
            moreViewStack: [
              ...state.moreViewStack,
              {
                type: moreViewType,
                originalTool: resolvedOriginalTool,
                title,
                items,
                onSelect,
              },
            ],
            selectedTool: moreViewType,
          };
        });
      },

      popMoreView: () => {
        set((state) => {
          const currentView = state.moreViewStack.at(-1);
          const newStack = state.moreViewStack.slice(0, -1);
          const previousView = newStack.at(-1);

          return {
            moreViewStack: newStack,
            selectedTool: previousView?.type || currentView?.originalTool || TOGGLE_STATES.NONE,
          };
        });
      },

      clearMoreView: () => {
        set((state) => {
          // 스택이 비어있으면 아무것도 하지 않음 (중복 호출 방지)
          if (state.moreViewStack.length === 0) {
            return state;
          }

          const originalTool = state.moreViewStack.at(0)?.originalTool || TOGGLE_STATES.NONE;
          return {
            moreViewStack: [],
            selectedTool: originalTool,
          };
        });
      },

      replaceMoreView: (
        moreViewType: ToggleState,
        title: string,
        items: ProductImageItem[],
        onSelect: (item: ProductImageItem) => void,
      ) => {
        set((state) => {
          // 스택이 비어있으면 push처럼 동작
          if (state.moreViewStack.length === 0) {
            return {
              moreViewStack: [
                {
                  type: moreViewType,
                  originalTool: state.selectedTool,
                  title,
                  items,
                  onSelect,
                },
              ],
              selectedTool: moreViewType,
            };
          }

          // 스택 최상단의 originalTool 유지하면서 교체
          const currentTop = state.moreViewStack.at(-1);
          const newStack = state.moreViewStack.slice(0, -1);

          return {
            moreViewStack: [
              ...newStack,
              {
                type: moreViewType,
                originalTool: currentTop?.originalTool || TOGGLE_STATES.SHAPE,
                title,
                items,
                onSelect,
              },
            ],
            selectedTool: moreViewType,
          };
        });
      },
    }),
    { name: 'tool-panel-store' },
  ),
);

// 셀렉터 함수들
export const useSelectedTool = () => useToolPanelStore((state) => state.selectedTool);

export const useTextToggleState = () => useToolPanelStore((state) => state.textToggleState);

export const useSetTextToggleState = () => useToolPanelStore((state) => state.setTextToggleState);

export const useIsToolPanelOpen = () =>
  useToolPanelStore((state) => state.selectedTool !== TOGGLE_STATES.NONE);

export const useMoreViewStack = () => useToolPanelStore((state) => state.moreViewStack);

export const useCurrentMoreView = () =>
  useToolPanelStore((state) => state.moreViewStack.at(-1) || null);

export const usePushMoreView = () => useToolPanelStore((state) => state.pushMoreView);

export const usePopMoreView = () => useToolPanelStore((state) => state.popMoreView);

export const useClearMoreView = () => useToolPanelStore((state) => state.clearMoreView);

export const useReplaceMoreView = () => useToolPanelStore((state) => state.replaceMoreView);
