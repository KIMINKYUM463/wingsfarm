'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { AiOrb } from './AiOrb';
import type {
  SelectedStyleDisplay,
  SelectedAssetDisplay,
} from '@/features/editor/hooks/useGenerateAIImageV2';
import { ToolFixedButtonSection } from '@/features/editor/components/panel/common';
import {
  useImageGenerationJobV2,
  type CompletedImageInfo,
} from '@/features/editor/hooks/useImageGenerationJobV2';
import IconButton from '@/shared/ui/Button/IconButton';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import TextArea from '@/shared/ui/TextArea';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { isImageElement } from '@/features/editor/lib/element-finder';
import { useImageGenerationStore } from '@/features/editor/store/useImageGenerationStore';
import { useClearSelection } from '@/features/editor/store/useSelectionStore';
import { showToast } from '@/utils/toast';
import { markAIImageReady } from '@/features/detail-page/api';
import { queryKeys } from '@/shared/constants/queryKeys';

/** 다시 생성하기 요청 정보 */
export interface RegenerateRequest {
  editPrompt: string;
  generatedImage: CompletedImageInfo;
}

interface ImageGenerationStatusProps {
  /** 프로젝트 ID (폴링 API용) */
  projectId: string;
  /** 생성 작업 ID */
  jobId: string;
  /** 이미지 요소 ID (로딩 상태 관리용) */
  imageId: string;
  /** 선택된 스타일 정보 */
  selectedStyle: SelectedStyleDisplay | null;
  /** 입력된 프롬프트 */
  prompt?: string;
  /** 선택된 참조 이미지 */
  selectedAsset?: SelectedAssetDisplay | null;
  /** 취소 버튼 클릭 핸들러 */
  onCancel?: () => void;
  /** 이미지 생성 완료 콜백 */
  onComplete?: (imageUrl: string) => void;
  /** 다시 생성하기 콜백 (추가 편집 프롬프트 + 생성된 이미지) */
  onRegenerate?: (request: RegenerateRequest) => void;
  /** 다시 생성하기 mutation 로딩 상태 */
  isRegenerating?: boolean;
}

/**
 * AI 이미지 생성 상태 UI
 *
 * - jobId를 받아 내부에서 Realtime 구독
 * - pending/processing: 로딩 UI + 생성 중 메시지
 * - completed: 생성된 이미지 프리뷰
 * - failed: 에러 메시지
 */
// 추가 편집 프롬프트 글자 수 제한
const MIN_EDIT_PROMPT_LENGTH = 2;
const MAX_EDIT_PROMPT_LENGTH = 1000;

const ImageGenerationStatus = ({
  projectId,
  jobId,
  imageId,
  selectedStyle,
  prompt,
  selectedAsset,
  onCancel,
  onComplete,
  onRegenerate,
  isRegenerating = false,
}: ImageGenerationStatusProps) => {
  // 생성된 이미지 정보 (완료 시)
  const [generatedImage, setGeneratedImage] = useState<CompletedImageInfo | null>(null);
  // 추가 편집 프롬프트
  const [editPrompt, setEditPrompt] = useState('');

  // 이미지 추가/교체용 hooks
  const activeFrames = useActiveFrames();
  const { addImageToFrame, updateElement } = useElementStore();
  const { getCenteredFrame } = useCenteredFrame();
  const { scrollToPosition } = useScrollToElement();
  const { element: selectedElement } = useSelectedElement();
  const flatElements = useCanvasDataStore((state) => state.flatElements);
  const setAssetUrl = useCanvasDataStore((state) => state.setAssetUrl);
  const setImageLoading = useImageGenerationStore((state) => state.setImageLoading);
  const clearSelection = useClearSelection();

  // 선택된 요소가 이미지인지 확인
  const isSelectedImageElement = selectedElement && isImageElement(selectedElement);

  // AI 이미지 READY 상태 변경 mutation
  const queryClient = useQueryClient();
  const { mutate: markReady, isPending: isMarkingReady } = useMutation({
    mutationFn: (assetId: string) => markAIImageReady(projectId, assetId),
    onSuccess: () => {
      // READY 상태가 되면 assets 목록을 stale로 표시 (즉시 refetch 안 함)
      // 사용자가 FileTool/ImageTool 패널로 전환할 때 자동 refetch됨
      queryClient.invalidateQueries({
        queryKey: queryKeys.ASSETS.lists(),
        refetchType: 'none',
      });
    },
    // 에러 시 전역 MutationCache.onError에서 토스트 자동 처리
  });

  // 완료 핸들러
  const handleComplete = useCallback(
    (info: CompletedImageInfo) => {
      setGeneratedImage(info);
      onComplete?.(info.imageUrl);

      // 로딩 상태 해제 + 선택 해제 (재생성 시 imageId가 빈 문자열이면 스킵)
      if (imageId) {
        setImageLoading(imageId, false);
      }
      clearSelection();

      // imageId로 직접 요소 조회하여 이미지 요소면 자동 적용
      // (backup 버튼 클릭으로 시작된 생성이면 해당 요소에 바로 반영)
      const targetElement = flatElements.get(imageId);
      if (targetElement && isImageElement(targetElement)) {
        // AI 이미지를 READY 상태로 변경 후 프레임에 적용
        markReady(info.assetId, {
          onSuccess: () => {
            setAssetUrl(info.assetId, info.imageUrl);
            updateElement(imageId, { assetId: info.assetId });
          },
        });
      }
    },
    [
      onComplete,
      imageId,
      setImageLoading,
      clearSelection,
      flatElements,
      markReady,
      setAssetUrl,
      updateElement,
    ],
  );

  // Realtime 구독 + 폴링 폴백 (에러는 UI로 표시)
  const { status } = useImageGenerationJobV2(projectId, jobId, {
    onComplete: handleComplete,
  });

  // 실패 시 shimmer 해제 + 선택 해제
  useEffect(() => {
    if (status !== 'failed') return;

    // 재생성 시 imageId가 빈 문자열이면 shimmer 해제 스킵
    if (imageId) setImageLoading(imageId, false);
    clearSelection();
  }, [status, imageId, setImageLoading, clearSelection]);

  // 이미지 추가 핸들러 (TextTool의 handleAddText와 동일한 패턴)
  const handleAddImage = useCallback(() => {
    if (activeFrames.length === 0 || !generatedImage?.assetId || !generatedImage?.imageUrl) return;

    const centeredFrame = getCenteredFrame(activeFrames);
    if (!centeredFrame) return;

    // AI 이미지를 READY 상태로 변경 후 프레임에 추가
    markReady(generatedImage.assetId, {
      onSuccess: () => {
        addImageToFrame(centeredFrame.id, generatedImage.assetId, generatedImage.imageUrl);

        // 이미지가 추가될 위치 (프레임 중앙)로 스크롤
        setTimeout(() => {
          const centerX = (centeredFrame.width ?? 860) / 2;
          const centerY = (centeredFrame.height ?? 1080) / 2;
          scrollToPosition(centeredFrame.id, centerX, centerY, {
            behavior: 'smooth',
            delay: 100,
          });
        }, 100);
      },
    });
  }, [
    activeFrames,
    generatedImage?.assetId,
    generatedImage?.imageUrl,
    getCenteredFrame,
    markReady,
    addImageToFrame,
    scrollToPosition,
  ]);

  // 이미지 교체 핸들러 (선택된 이미지 요소의 assetId를 교체)
  const handleReplaceImage = useCallback(() => {
    if (!generatedImage?.imageUrl || !generatedImage?.assetId) return;

    // 이미지 요소가 선택되지 않은 경우
    if (!isSelectedImageElement) {
      showToast.warn('교체할 이미지를 먼저 선택한 후 다시 시도해주세요.');
      return;
    }

    // 이미 같은 이미지로 교체된 경우
    if ((selectedElement as { assetId?: string }).assetId === generatedImage.assetId) {
      showToast.warn('이미 적용된 이미지입니다.');
      return;
    }

    // AI 이미지를 READY 상태로 변경 후 교체
    markReady(generatedImage.assetId, {
      onSuccess: () => {
        // assetUrl 등록
        setAssetUrl(generatedImage.assetId, generatedImage.imageUrl);

        // 선택된 요소의 assetId 교체
        updateElement(selectedElement.id, { assetId: generatedImage.assetId });

        // 교체 성공 피드백
        showToast.success('이미지가 교체되었어요!');
      },
    });
  }, [
    isSelectedImageElement,
    selectedElement,
    generatedImage?.assetId,
    generatedImage?.imageUrl,
    markReady,
    setAssetUrl,
    updateElement,
  ]);

  // 다시 생성하기 핸들러
  const handleRegenerate = useCallback(() => {
    if (!generatedImage || editPrompt.length < MIN_EDIT_PROMPT_LENGTH) return;
    onRegenerate?.({ editPrompt, generatedImage });
  }, [editPrompt, generatedImage, onRegenerate]);

  // 다시 생성하기 버튼 활성화 여부
  const canRegenerate =
    editPrompt.length >= MIN_EDIT_PROMPT_LENGTH && editPrompt.length <= MAX_EDIT_PROMPT_LENGTH;

  // 취소 핸들러 (shimmer 해제 + 선택 해제)
  const handleCancel = useCallback(() => {
    // 재생성 시 imageId가 빈 문자열이면 shimmer 해제 스킵
    if (imageId) setImageLoading(imageId, false);
    clearSelection();
    onCancel?.();
  }, [imageId, setImageLoading, clearSelection, onCancel]);

  const isGenerating = status === 'pending' || status === 'processing' || status === null;
  const isCompleted = status === 'completed' && generatedImage?.imageUrl;
  const isFailed = status === 'failed';

  // 프롬프트 또는 참조 이미지가 있는지 확인
  const hasPromptInfo = prompt || selectedAsset;

  // 생성 중 UI
  if (isGenerating) {
    return (
      <ToolSectionLayout
        title="AI 이미지"
        footer={
          <ToolFixedButtonSection
            descriptionText="취소해도 이미 보낸 요청의 Gemini 사용량은 돌아오지 않아요."
            descriptionClassName="text-(--color-gray-300)"
            buttonText="취소"
            buttonClassName="btn-ghost"
            onButtonClick={handleCancel}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* 로딩 배경 (피그마: 323x323, #000000) */}
          <AiOrb className="aspect-square w-full rounded-lg">
            {/* 텍스트: bottom 60px, 14px, font-weight 500 */}
            <div
              className="absolute left-1/2 w-full -translate-x-1/2 px-5 text-center"
              style={{ bottom: '60px' }}
            >
              <p className="text-white">최대 3분이 소요될 수 있습니다.</p>
              <p className="text-white">잠시 다른 작업을 하셔도 괜찮습니다.</p>
            </div>
          </AiOrb>

          {/* 프롬프트 미리보기 (피그마: 참조 이미지 45px + 프롬프트 텍스트) */}
          {hasPromptInfo && (
            <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.75">
              {selectedAsset && (
                <div className="relative size-11.25 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={selectedAsset.thumbnailUrl}
                    alt="참조 이미지"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
              {prompt && <p className="line-clamp-2 text-gray-400">{prompt}</p>}
            </div>
          )}
        </div>
      </ToolSectionLayout>
    );
  }

  // 생성 완료 UI
  if (isCompleted) {
    return (
      <ToolSectionLayout
        title="AI 이미지"
        footer={
          <ToolFixedButtonSection
            secondaryButtonText="돌아가기"
            secondaryButtonClassName="btn-neutral"
            onSecondaryButtonClick={handleCancel}
            buttonText="다시 생성하기"
            buttonClassName="btn-primary"
            disabled={!canRegenerate}
            isLoading={isRegenerating}
            onButtonClick={handleRegenerate}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* 생성된 이미지 */}
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-900">
            <Image
              src={generatedImage.imageUrl}
              alt="생성된 AI 이미지"
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          {/* 이미지 액션 버튼 (피그마: Image Buttons) */}
          <div className="flex gap-2">
            <ActionTooltip content="페이지에 새 이미지를 배치" direction="top">
              <IconButton
                icon="add"
                text="이미지 추가"
                textClassName="p"
                className="btn-outline flex-1"
                onClick={handleAddImage}
                disabled={isMarkingReady}
              />
            </ActionTooltip>
            <ActionTooltip content="기존 이미지를 새 이미지로 바꿈" direction="top">
              <IconButton
                icon="sync_alt"
                text="이미지 교체"
                textClassName="p"
                className="btn-outline flex-1"
                onClick={handleReplaceImage}
                disabled={isMarkingReady}
              />
            </ActionTooltip>
          </div>

          {/* 프롬프트 미리보기 */}
          {hasPromptInfo && (
            <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.75">
              {selectedAsset && (
                <div className="relative size-11.25 shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={selectedAsset.thumbnailUrl}
                    alt="참조 이미지"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
              {prompt && <p className="p-medium text-gray-400">{prompt}</p>}
            </div>
          )}

          {/* 추가 편집 섹션 */}
          <div className="flex flex-col gap-3">
            <p className="p">추가 편집</p>
            <TextArea
              className="h-45 w-full rounded-lg border border-solid border-gray-100 px-3 py-3"
              placeholder="추가 편집에 대해 자세히 설명해 주세요."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              maxLength={MAX_EDIT_PROMPT_LENGTH}
            />
          </div>
        </div>
      </ToolSectionLayout>
    );
  }

  // 생성 실패 UI
  if (isFailed) {
    return (
      <ToolSectionLayout
        title="AI 이미지 생성 실패"
        footer={
          <ToolFixedButtonSection
            buttonText="돌아가기"
            buttonClassName="btn-neutral"
            onButtonClick={handleCancel}
          />
        }
      >
        <div className="flex-center flex-col gap-4 py-16">
          <div className="flex-center size-16 rounded-full bg-(--color-red-100)">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-center">
            <p className="p-bold mb-2">이미지 생성에 실패했어요</p>
            <p className="description text-(--color-gray-400)">
              일시적인 오류일 수 있어요.
              <br />
              다시 시도해주세요.
            </p>
          </div>
        </div>
      </ToolSectionLayout>
    );
  }

  // 상태가 없는 경우 (일반적으로 발생하지 않음)
  return null;
};

export default ImageGenerationStatus;
