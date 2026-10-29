import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectFrame } from '@/features/editor/types';
import type { KonvaElement, KonvaFrameElement } from '@/shared/types/konva';
import { isKonvaGroupElement, isKonvaFrameElement } from '@/shared/types/konva';
import { updateFrameChildren, updateElementInChildren } from '../lib/frame-utils';
import { injectRootIdToFrame } from '../lib/rootId-utils';
import { useHistoryStore } from './useHistoryStore';

// ============================================================
// 히스토리 저장 헬퍼 (중앙 집중)
// ============================================================

/** 히스토리 저장 중복 방지 플래그 */
let isRecordingHistory = false;

/** undo/redo 복원 중 플래그 (저장 방지) */
let isRestoringFromHistory = false;

/** undo/redo 복원 중인지 확인 (auto-save 스킵 및 baseline 갱신용) */
export const getIsRestoringFromHistory = () => isRestoringFromHistory;

/**
 * 변경 전 상태를 히스토리에 저장 (첫 변경 시에만)
 * - 연속 변경(드래그 중)에서는 첫 번째만 저장
 * - undo/redo 복원 중에는 저장 안 함
 * - 변경 완료 후 최종 상태로 스냅샷 업데이트 (redo 지원)
 */
export const recordHistoryIfNeeded = () => {
  if (isRestoringFromHistory) return;
  if (isRecordingHistory) return;

  const frames = useCanvasDataStore.getState().frames;
  // 초기화 전이면 저장하지 않음
  if (frames.length === 0) return;

  useHistoryStore.getState().pushHistory(frames);
  // push 후의 step 저장 (RAF에서 유효성 검증용)
  const stepAtPush = useHistoryStore.getState().historyStep;
  isRecordingHistory = true;

  // 다음 프레임에 최종 상태로 스냅샷 업데이트 + 플래그 리셋
  requestAnimationFrame(() => {
    const currentStep = useHistoryStore.getState().historyStep;
    // step이 변경됐으면 undo/redo가 발생한 것이므로 업데이트 스킵
    if (currentStep === stepAtPush) {
      const finalFrames = useCanvasDataStore.getState().frames;
      useHistoryStore.getState().updateCurrentSnapshot(finalFrames);
    }
    isRecordingHistory = false;
  });
};

/**
 * 요소 평탄화 함수
 * 재귀적으로 모든 중첩된 요소를 1차원 배열로 변환
 */
const flattenElements = (elements: KonvaElement[]): KonvaElement[] => {
  const result: KonvaElement[] = [];
  elements.forEach((element) => {
    result.push(element);
    if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
      result.push(...flattenElements(element.children));
    }
  });
  return result;
};

/**
 * 캔버스 데이터 저장소 (하이브리드 방식)
 *
 * ## 책임
 * - Konva 렌더링 데이터 저장 및 관리
 * - 불변성 있는 상태 업데이트 (Zustand 셀렉터로 자동 리렌더링)
 * - 캔버스 요소 평탄화 맵 관리
 * - 낙관적 업데이트 시 자동 저장 제어
 * - 프로젝트 메타데이터 (상품명, 카테고리명)
 *
 * ## 책임 외
 * - AI 이미지 생성 상태 → useImageGenerationStore
 * - AI 텍스트 생성 상태 → useTextGenerationStore
 * - Undo/Redo 로직 → useHistoryStore (향후)
 */
interface CanvasDataState {
  // 렌더링용 Konva 프레임 (트리 구조, rootId 포함)
  frames: KonvaFrameElement[];
  // 평탄화된 요소 맵 (빠른 검색용)
  flatElements: Map<string, KonvaElement>;
  // 에셋 ID → URL 매핑 (렌더링용)
  assetUrls: Record<string, string>;
  // 템플릿 초기화 완료 여부 (로딩 상태 판단용)
  isInitialized: boolean;
  // 상품명
  productName: string | null;
  // 카테고리명 (예: "식품/건강")
  categoryName: string | null;
  // Ghost 활성화 중인 프레임 ID (스켈레톤 표시용)
  activatingFrameId: string | null;
  // 복제 중인 프레임 ID (스켈레톤 표시용)
  duplicatingFrameId: string | null;

  // 템플릿 초기화 (정렬된 ProjectFrame 배열 + assetUrls + 프로젝트 메타데이터 전달)
  initializeTemplate: (
    projectFrames: ProjectFrame[],
    assetUrls: Record<string, string>,
    productName: string,
    categoryName: string,
  ) => void;
  // 요소 업데이트 (불변성 유지, 자동 리렌더링)
  updateElement: (elementId: string, updates: Partial<KonvaElement>) => void;
  // AI 생성 텍스트 내용 설정
  setTextContent: (elementId: string, text: string) => void;
  // 프레임 ID로 프레임 찾기 (rootId로 프레임 조회용)
  getFrameById: (frameId: string | null | undefined) => KonvaFrameElement | undefined;
  // assetId로 URL 조회
  getAssetUrl: (assetId: string) => string | undefined;
  // assetId에 대한 URL 캐시 (업로드/AI 생성 시 사용)
  setAssetUrl: (assetId: string, url: string) => void;
  // 데이터 초기화
  reset: () => void;
  // Ghost 활성화 상태 설정
  setActivatingFrameId: (frameId: string | null) => void;
  // 복제 상태 설정
  setDuplicatingFrameId: (frameId: string | null) => void;
  // 히스토리에서 frames 복원 (undo/redo용)
  restoreFromHistory: (frames: KonvaFrameElement[]) => void;
}

export const useCanvasDataStore = create<CanvasDataState>()(
  devtools(
    (set, get) => ({
      frames: [],
      flatElements: new Map(),
      assetUrls: {},
      isInitialized: false,
      productName: null,
      categoryName: null,
      activatingFrameId: null,
      duplicatingFrameId: null,

      initializeTemplate: (
        projectFrames: ProjectFrame[],
        assetUrls: Record<string, string>,
        productName: string,
        categoryName: string,
      ) => {
        // ProjectFrame[] → KonvaFrameElement[] 변환
        const frames = projectFrames.map((pf): KonvaFrameElement => {
          // ghost 프레임: 최소한의 정보만 (렌더링 안 함, 목록에만 표시)
          if (pf.status === 'ghost') {
            return {
              type: 'frame',
              id: pf.id,
              name: pf.frameName ?? '',
              x: 0,
              y: 0,
              children: [],
              status: 'ghost',
              frameOrder: pf.frameOrder,
              part2: pf.part2,
            };
          }

          // active 프레임: rootId 주입 (백엔드 응답에 rootId 없을 수 있음)
          const frameData = pf.frameData as KonvaFrameElement;
          const frameWithRootIds = injectRootIdToFrame(frameData, pf.id);
          return {
            ...frameWithRootIds,
            id: pf.id,
            name: pf.frameName ?? frameData.name,
            frameOrder: pf.frameOrder,
            part2: pf.part2,
            status: 'active',
          };
        });

        // active 프레임의 요소만 평탄화 (ghost는 children이 없음)
        const activeFrames = frames.filter((f) => f.status === 'active');
        const allElements = flattenElements(activeFrames);

        // Map으로 변환 (id를 key로 사용)
        const elementsMap = new Map<string, KonvaElement>();
        allElements.forEach((element) => {
          elementsMap.set(element.id, element);
        });

        set({
          frames,
          flatElements: elementsMap,
          assetUrls,
          isInitialized: true,
          productName,
          categoryName,
        });
      },

      updateElement: (elementId: string, updates: Partial<KonvaElement>) => {
        // 변경 전 히스토리 저장 (첫 변경 시에만)
        recordHistoryIfNeeded();

        const { flatElements, frames } = get();
        const elementToUpdate = flatElements.get(elementId);

        if (!elementToUpdate) {
          console.warn(`Element with ID ${elementId} not found.`);
          return;
        }

        const updatedElement = { ...elementToUpdate, ...updates } as KonvaElement;
        const newFlatElements = new Map(flatElements).set(elementId, updatedElement);

        // 최상위 Frame 수정
        const isTopLevelFrame =
          isKonvaFrameElement(elementToUpdate) && frames.some((f) => f.id === elementId);
        if (isTopLevelFrame) {
          set({
            frames: frames.map((frame) =>
              frame.id === elementId ? (updatedElement as KonvaFrameElement) : frame,
            ),
            flatElements: newFlatElements,
          });
          return;
        }

        // 중첩 Frame 수정 (rootId 있음 - 최적화)
        if (isKonvaFrameElement(elementToUpdate) && elementToUpdate.rootId) {
          set({
            frames: updateFrameChildren(frames, elementToUpdate.rootId, (children) =>
              updateElementInChildren(children, elementId, updatedElement),
            ),
            flatElements: newFlatElements,
          });
          return;
        }

        // 중첩 Frame 수정 (rootId 없음 - fallback)
        if (isKonvaFrameElement(elementToUpdate)) {
          set({
            frames: frames.map((frame) => {
              const newChildren = updateElementInChildren(
                frame.children,
                elementId,
                updatedElement,
              );
              if (newChildren === frame.children) return frame;
              return { ...frame, children: newChildren };
            }),
            flatElements: newFlatElements,
          });
          return;
        }

        // 일반 요소 수정: rootId로 해당 프레임만 탐색
        const rootId = (elementToUpdate as { rootId?: string }).rootId;
        if (!rootId) {
          console.warn(`Cannot update element without rootId: ${elementId}`);
          return;
        }

        const newFrames = updateFrameChildren(frames, rootId, (children) =>
          updateElementInChildren(children, elementId, updatedElement),
        );

        // 그룹 내 자식 수정 시, 부모 그룹/프레임도 flatElements에 동기화 필요
        // 해당 프레임의 children을 다시 평탄화하여 모든 중간 컨테이너 업데이트
        const targetFrame = newFrames.find((f) => f.id === rootId);
        if (targetFrame) {
          flattenElements(targetFrame.children).forEach((el) => {
            newFlatElements.set(el.id, el);
          });
        }

        set({
          frames: newFrames,
          flatElements: newFlatElements,
        });
      },

      setTextContent: (elementId: string, text: string) => {
        get().updateElement(elementId, { text } as Partial<KonvaElement>);
      },

      getFrameById: (frameId: string | null | undefined) => {
        if (!frameId) return undefined;
        return get().frames.find((f) => f.id === frameId);
      },

      getAssetUrl: (assetId: string) => {
        return get().assetUrls[assetId];
      },

      setAssetUrl: (assetId: string, url: string) => {
        set((state) => ({
          assetUrls: {
            ...state.assetUrls,
            [assetId]: url,
          },
        }));
      },

      reset: () => {
        set({
          frames: [],
          flatElements: new Map(),
          assetUrls: {},
          isInitialized: false,
          productName: null,
          categoryName: null,
          activatingFrameId: null,
          duplicatingFrameId: null,
        });
      },

      setActivatingFrameId: (frameId: string | null) => {
        set({ activatingFrameId: frameId });
      },

      setDuplicatingFrameId: (frameId: string | null) => {
        set({ duplicatingFrameId: frameId });
      },

      restoreFromHistory: (frames: KonvaFrameElement[]) => {
        // undo/redo 복원 중 플래그 설정 (히스토리 저장 방지)
        isRestoringFromHistory = true;

        // active 프레임의 요소만 평탄화
        const activeFrames = frames.filter((f) => f.status === 'active');
        const allElements = flattenElements(activeFrames);

        // Map으로 변환
        const elementsMap = new Map<string, KonvaElement>();
        allElements.forEach((element) => {
          elementsMap.set(element.id, element);
        });

        set({
          frames,
          flatElements: elementsMap,
        });

        // 플래그 리셋
        isRestoringFromHistory = false;
      },
    }),
    { name: 'canvas-data-store' },
  ),
);

// ============================================================
// Derived Hooks (useShallow 캡슐화)
// ============================================================
import { useShallow } from 'zustand/react/shallow';

/** active 상태의 프레임만 반환 (캔버스에 실제 렌더링되는 프레임) */
export const useActiveFrames = () =>
  useCanvasDataStore(useShallow((state) => state.frames.filter((f) => f.status === 'active')));

/** ghost 상태의 프레임만 반환 (비활성화된 템플릿 프레임) */
export const useGhostFrames = () =>
  useCanvasDataStore(useShallow((state) => state.frames.filter((f) => f.status === 'ghost')));
