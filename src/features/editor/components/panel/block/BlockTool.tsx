'use client';

import { useMemo } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import ToolControlGroup, {
  ComponentCategory,
  ComponentItem,
} from '@/features/editor/components/panel/common/ToolControlGroup';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useFrameActions } from '@/features/editor/hooks/frame';
import { useDialog } from '@/shared/ui/Dialog';
import {
  usePushMoreView,
  useCurrentMoreView,
  useClearMoreView,
  ProductImageItem,
} from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { useTemplateGroups } from '@/features/editor/context/TemplatesContext';
import Empty from '@/shared/ui/Empty';
import Dropdown from '@/shared/ui/Dropdown';

const BlockTool = () => {
  const activeFrames = useActiveFrames();
  const frames = useCanvasDataStore((state) => state.frames);
  const { getCenteredFrame } = useCenteredFrame();
  const { handleApplyTemplate } = useFrameActions();
  const { openChoice } = useDialog();
  const pushMoreView = usePushMoreView();
  const currentMoreView = useCurrentMoreView();
  const clearMoreView = useClearMoreView();
  const templateGroups = useTemplateGroups();

  // 템플릿 데이터를 ComponentCategory 형식으로 변환 (초기 2개만 표시)
  const categories: ComponentCategory[] = useMemo(() => {
    return templateGroups.map((group) => ({
      id: group.part2,
      title: group.part2,
      type: 'block' as const,
      showMore: group.templates.length > 2,
      items: group.templates.slice(0, 2).map((template) => ({
        id: template.id,
        name: null,
        part2: group.part2,
        url: template.thumbnailUrl,
        previewUrl: template.previewUrl,
      })),
    }));
  }, [templateGroups]);

  // 더보기용 전체 템플릿 맵
  const templatesByPart2 = useMemo(() => {
    const map = new Map<string, ProductImageItem[]>();
    templateGroups.forEach((group) => {
      map.set(
        group.part2,
        group.templates.map((template) => ({
          id: template.id,
          name: null,
          part2: group.part2,
          thumbnailUrl: template.thumbnailUrl,
          previewUrl: template.previewUrl,
          category: group.part2,
        })),
      );
    });
    return map;
  }, [templateGroups]);

  const handleItemClick = async (item: Pick<ComponentItem, 'id' | 'part2'>) => {
    if (activeFrames.length === 0) return;

    const centeredFrame = getCenteredFrame(activeFrames);
    if (!centeredFrame) return;

    const choice = await openChoice({
      title: '템플릿을 어떻게 적용할까요?',
      description: '현재 보고 있는 프레임을 기준으로 적용됩니다.',
      choices: [
        { value: 'overwrite', label: '현재 프레임 교체', variant: 'primary' },
        { value: 'create', label: '아래에 새로 추가', variant: 'secondary' },
      ],
    });

    if (!choice) return;

    if (choice === 'overwrite') {
      handleApplyTemplate({
        templateId: item.id,
        mode: 'overwrite',
        targetFrameId: centeredFrame.id,
        part2: item.part2,
      });
      clearMoreView();
      return;
    }

    // create 모드: 현재 프레임 아래에 추가
    const frameIndex = frames.findIndex((f) => f.id === centeredFrame.id);
    const nextFrame = frames[frameIndex + 1];
    const newFrameOrder = generateKeyBetween(
      centeredFrame.frameOrder ?? null,
      nextFrame?.frameOrder ?? null,
    );

    handleApplyTemplate({
      templateId: item.id,
      mode: 'create',
      frameOrder: newFrameOrder,
      part2: item.part2,
      tempId: crypto.randomUUID(),
    });
    clearMoreView();
  };

  const handleMoreClick = (categoryId: string) => {
    // 이미 moreView가 열려있으면 중복 push 방지
    if (currentMoreView) return;

    // "전체" 선택 시 모든 템플릿 표시
    const moreItems =
      categoryId === ''
        ? templateGroups.flatMap((group) =>
            group.templates.map((template) => ({
              id: template.id,
              name: null,
              part2: group.part2,
              thumbnailUrl: template.thumbnailUrl,
              previewUrl: template.previewUrl,
              category: group.part2,
            })),
          )
        : templatesByPart2.get(categoryId);

    if (!moreItems || moreItems.length === 0) return;

    pushMoreView(TOGGLE_STATES.BLOCK_MORE, categoryId || '전체', moreItems, (selectedItem) => {
      handleItemClick(selectedItem);
    });
  };

  // TODO: 카테고리 필터 기능 추후 구현
  // const categoryOptions = [{ id: '', label: '카테고리 선택' }];

  // 구성(part2) 드롭다운 옵션 ("전체" 옵션 포함)
  const partOptions = useMemo(
    () => [
      { id: '', label: '전체' },
      ...templateGroups.map((group) => ({ id: group.part2, label: group.part2 })),
    ],
    [templateGroups],
  );

  // 템플릿 데이터가 없는 경우
  if (categories.length === 0) {
    return (
      <ToolSectionLayout title="템플릿 교체">
        <Empty texts={['사용 가능한 템플릿이 없습니다.']} textClassName="description" />
      </ToolSectionLayout>
    );
  }

  return (
    <ToolSectionLayout
      title="템플릿 교체"
      body={
        <div className="mb-6 flex flex-col gap-2">
          {/* TODO: 카테고리 필터 기능 추후 구현
          <Dropdown
            options={categoryOptions}
            initialId=""
            dropdownListClassName="dropdown-list w-full"
          /> */}
          <Dropdown
            options={partOptions}
            placeholder="구성 선택"
            dropdownListClassName="dropdown-list w-full"
            onChangeOption={(option) => handleMoreClick(option.id)}
          />
        </div>
      }
    >
      {categories.map((category) => (
        <ToolControlGroup
          key={category.id}
          category={category}
          onItemClick={handleItemClick}
          onMoreClick={handleMoreClick}
        />
      ))}
    </ToolSectionLayout>
  );
};

export default BlockTool;
