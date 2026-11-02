'use client';

import { useParams } from 'next/navigation';
import ModalContent from '../ModalContent';
import ScrollArea from '@/shared/ui/ScrollArea';
import type { ModalComponentProps } from '../types';
import CustomIcon from '@/shared/ui/CustomIcon';
import Icon from '@/shared/ui/Icon';
import Button from '@/shared/ui/Button/Button';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import { useProjectEstimate } from '@/features/editor/hooks/useProjectEstimate';
import { usePrefetchKeywords } from '@/features/detail-page/hooks';
import { useDialog } from '@/shared/ui/Dialog/useDialog';

/**
 * AiDetailPageModal - AI 상세페이지 생성 모달
 *
 * 프로젝트의 프레임별 AI 이미지 자리 수를 조회하여 표시합니다.
 */
const AiDetailPageModal = ({ onClose }: ModalComponentProps) => {
  const params = useParams();
  const projectId = params.id as string;

  const { data, isLoading } = useProjectEstimate(projectId);
  const { mutate: prefetchKeywords } = usePrefetchKeywords();
  const { openModal } = useDialog();

  const handleStart = () => {
    openModal('productInfo', { projectId });
    prefetchKeywords(projectId);
  };

  return (
    <ModalContent onClose={onClose} className="rounded-xl bg-white p-9" maxW="lg">
      <div className="flex flex-col gap-6">
        {/* 헤더 + 제목 그룹 (Figma: gap-32px to 리스트) */}
        <div className="flex flex-col gap-8">
          {/* 아이콘 + 라벨 + 제목 (Figma: gap-12px) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.75">
              <CustomIcon
                name="ai-star-24"
                width={24}
                height={24}
                className="text-(--color-point)"
              />
              <p className="title-1-bold text-(--color-point)">AI로 상세페이지 완성하기</p>
            </div>
            <h2 className="h2-bold">
              상세페이지를 만들기 위한
              <br />
              기본적인 정보를 알려주세요.
            </h2>
          </div>

          {/* 구성 목록 박스 - 스켈레톤과 동일한 h-63으로 레이아웃 시프트 방지 */}
          {isLoading ? (
            <Skeleton bg="gray-50" className="h-63 w-full rounded-lg" />
          ) : (
            <div className="h-63 rounded-lg border border-gray-200 bg-gray-50 py-4">
              <div className="mb-3 flex items-center justify-between px-5">
                <p className="title-1-bold text-(--color-point)">이렇게 구성돼요.</p>
                <div className="flex items-center gap-0.5">
                  <Icon name="image" width={16} height={16} className="text-(--color-point)" />
                  <span className="p-bold text-(--color-point)">
                    {data?.totalImageCount ?? 0}장
                  </span>
                </div>
              </div>
              {/* 스크롤 영역: 전체 너비, 스크롤바는 오른쪽 끝에 위치 */}
              <ScrollArea className="max-h-47">
                <div className="px-5">
                  <ol className="flex flex-col gap-2">
                    {data?.items.map((item, index) => (
                      <li
                        key={`${index}-${item.frameName}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <span className="p w-6 text-gray-500 tabular-nums">{index + 1}.</span>
                          <span className="p text-gray-500">{item.part2}</span>
                        </div>
                        <div className="flex items-center">
                          <Icon name="image" width={16} height={16} className="text-gray-400" />
                          <span className="description w-5.5 text-right text-gray-400">
                            {item.imageCount}장
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* 시작하기 버튼 (Figma: gap-24px from 리스트) */}
        <div className="flex items-center justify-end">
          {isLoading ? (
            <Skeleton bg="gray-50" className="h-(--btn-h) w-32 rounded-lg" />
          ) : (
            <Button
              className="btn-primary flex items-center gap-2"
              onClick={handleStart}
              disabled={!data}
            >
              <span className="p-bold">시작하기</span>
            </Button>
          )}
        </div>
      </div>
    </ModalContent>
  );
};

export default AiDetailPageModal;
