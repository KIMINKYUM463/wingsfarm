import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/** 선택된 참조 이미지 정보 */
interface SelectedAsset {
  id: string;
  thumbnailUrl: string;
}

/** 스타일 표시 정보 */
interface StyleDisplay {
  majorName: string;
  styleName: string;
  thumbnailUrl: string;
}

/** 활성 생성 작업 스냅샷 (생성 시작 시점의 정보) */
export interface ActiveJob {
  jobId: string;
  /** 생성 대상 이미지 요소 ID (로딩 상태 관리 및 자동 적용용) */
  imageId: string;
  styleDisplay: StyleDisplay | null;
  prompt: string;
  assetDisplay: { assetId: string; thumbnailUrl: string } | null;
}

/**
 * AI 이미지 생성 상태 저장소
 *
 * ## 책임
 * - 이미지 생성 로딩 상태 관리
 * - 선택된 스타일/참조이미지 관리 (패널 전환 시에도 유지)
 * - 활성 Job 관리 (탭 전환 시에도 유지)
 *
 * ## 분리 이유
 * - 캔버스 데이터와 독립적인 생명주기
 * - AI 기능의 독립적 관리 및 확장
 * - 단일 책임 원칙(SRP) 준수
 */
interface ImageGenerationState {
  // 이미지 로딩 상태 맵 (imageId -> isLoading)
  imageLoadingStates: Map<string, boolean>;
  // 선택된 스타일 ID (패널 전환 시에도 유지)
  selectedStyleId: string | null;
  // 선택된 참조 이미지 (패널 전환 시에도 유지)
  selectedAsset: SelectedAsset | null;
  // 활성 생성 작업 (생성 시작 시점의 스냅샷)
  activeJob: ActiveJob | null;

  // 이미지 로딩 상태 설정
  setImageLoading: (imageId: string, isLoading: boolean) => void;
  // 선택된 스타일 ID 설정
  setSelectedStyleId: (styleId: string | null) => void;
  // 선택된 참조 이미지 설정
  setSelectedAsset: (asset: SelectedAsset | null) => void;
  // 활성 생성 작업 설정 (스냅샷)
  setActiveJob: (job: ActiveJob) => void;
  // 생성 상태 초기화 (Job 완료/취소 시)
  clearGenerationState: () => void;
  // 폼 관련 상태만 초기화 (스타일, 참조이미지)
  resetFormState: () => void;
  // 전체 상태 초기화
  reset: () => void;
}

export const useImageGenerationStore = create<ImageGenerationState>()(
  devtools(
    (set, get) => ({
      imageLoadingStates: new Map(),
      selectedStyleId: null,
      selectedAsset: null,
      activeJob: null,

      setImageLoading: (imageId: string, isLoading: boolean) => {
        const { imageLoadingStates } = get();
        const newMap = new Map(imageLoadingStates);
        newMap.set(imageId, isLoading);
        set({ imageLoadingStates: newMap });
      },

      setSelectedStyleId: (styleId: string | null) => {
        set({ selectedStyleId: styleId });
      },

      setSelectedAsset: (asset) => {
        set({ selectedAsset: asset });
      },

      setActiveJob: (job: ActiveJob) => {
        set({ activeJob: job });
      },

      clearGenerationState: () => {
        const { activeJob, imageLoadingStates } = get();
        // activeJob의 imageId로 shimmer 해제 (선택 해제 후에도 정상 동작)
        if (activeJob?.imageId) {
          const newMap = new Map(imageLoadingStates);
          newMap.set(activeJob.imageId, false);
          set({ activeJob: null, imageLoadingStates: newMap });
        } else {
          set({ activeJob: null });
        }
      },

      resetFormState: () => {
        set({
          selectedStyleId: null,
          selectedAsset: null,
        });
      },

      reset: () => {
        set({
          imageLoadingStates: new Map(),
          selectedStyleId: null,
          selectedAsset: null,
          activeJob: null,
        });
      },
    }),
    { name: 'image-generation-store' },
  ),
);
