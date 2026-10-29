/**
 * FrameToolbox.tsx
 * 프레임 상단에 표시되는 툴박스 (이름 + 액션 버튼)
 *
 * ## 특징
 * - 파트 라벨 (part2) + 프레임 이름 편집
 * - 템플릿 교체 버튼
 * - 프레임 CRUD 액션 버튼 (추가, 복제, 이동, 삭제)
 * - HTML 레이어로 렌더링 (react-konva-utils)
 *
 * ## 사용 예시
 * ```tsx
 * <FrameToolbox
 *   frameName="Frame 1"
 *   part2="문제 제기"
 *   frameY={0}
 *   frameWidth={1920}
 *   frameId="frame-id"
 * />
 * ```
 */

'use client';

import { useCallback, useMemo } from 'react';
import { Html } from 'react-konva-utils';
import { generateKeyBetween } from 'fractional-indexing';
import CommonIconToggleGroup from '@/shared/ui/Toggle/IconToggleGroup';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { getCSSVariableValue } from '@/utils/css';
import { useFrameActions } from '@/features/editor/hooks/frame';
import { rgbaToHex } from '@/features/editor/lib/color-converter';
import IconButton from '@/shared/ui/Button/IconButton';
import ColorPicker from '@/shared/ui/ColorPicker/ColorPicker';
import VerticalDivider from '@/shared/ui/Divider/VerticalDivider';
import Input from '@/shared/ui/Input/Input';
import { NumericInputField } from '@/features/editor/components/panel/common';
import { useTemplateGroups } from '@/features/editor/context/TemplatesContext';
import {
  usePushMoreView,
  useCurrentMoreView,
  useReplaceMoreView,
} from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { useDialog } from '@/shared/ui/Dialog';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';

export const DEFAULT_FRAME_NAME = '제목을 입력해주세요';
export const DEFAULT_PART2 = '단계';

interface FrameToolboxProps {
  frameName: string;
  part2?: string;
  frameY: number;
  frameWidth?: number;
  frameHeight?: number;
  frameId: string;
  /** 프레임 배경색 (rgba 형식) */
  fill?: string;
}

const TOOLBOX_OFFSET = 8; // 프레임 상단에서 툴박스까지의 거리
const DEFAULT_FRAME_WIDTH = 1920; // 기본 프레임 너비

/**
 * 프레임 상단에 이름과 액션 버튼을 표시하는 툴박스
 */
export const FrameToolbox = ({
  frameName,
  part2,
  frameY,
  frameWidth = DEFAULT_FRAME_WIDTH,
  frameHeight,
  frameId,
  fill = 'rgba(255, 255, 255, 1)',
}: FrameToolboxProps) => {
  const { frameActionItems, handleFillChange, handleHeightChange, handleRename, handleApplyTemplate } =
    useFrameActions(frameId);
  const btnSizeSidebar = getCSSVariableValue('--btn-h');
  const templateGroups = useTemplateGroups();
  const pushMoreView = usePushMoreView();
  const currentMoreView = useCurrentMoreView();
  const replaceMoreView = useReplaceMoreView();
  const { openChoice } = useDialog();
  const frames = useCanvasDataStore((state) => state.frames);

  // 현재 part2에 해당하는 템플릿 목록
  const templatesForPart2 = useMemo(() => {
    const group = templateGroups.find((g) => g.part2 === part2);
    if (!group) return [];
    return group.templates.map((template) => ({
      id: template.id,
      name: null,
      part2: group.part2,
      thumbnailUrl: template.thumbnailUrl,
      previewUrl: template.previewUrl,
      category: group.part2,
    }));
  }, [templateGroups, part2]);

  // 템플릿 선택 시 콜백
  const handleSelectTemplate = useCallback(
    async (selectedItem: { id: string; part2?: string }) => {
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
          templateId: selectedItem.id,
          mode: 'overwrite',
          targetFrameId: frameId,
          part2: selectedItem.part2,
        });
        return;
      }

      // create 모드: 현재 프레임 아래에 추가
      const currentFrame = frames.find((f) => f.id === frameId);
      if (!currentFrame) return;

      const frameIndex = frames.findIndex((f) => f.id === frameId);
      const nextFrame = frames[frameIndex + 1];
      const newFrameOrder = generateKeyBetween(
        currentFrame.frameOrder ?? null,
        nextFrame?.frameOrder ?? null,
      );

      handleApplyTemplate({
        templateId: selectedItem.id,
        mode: 'create',
        frameOrder: newFrameOrder,
        part2: selectedItem.part2,
        tempId: crypto.randomUUID(),
      });
    },
    [openChoice, handleApplyTemplate, frameId, frames],
  );

  // 템플릿 교체 버튼 클릭: 해당 part2의 템플릿 목록 열기
  const handleTemplateChange = useCallback(() => {
    if (templatesForPart2.length === 0) return;

    // 같은 타입(BLOCK_MORE)이 열려있으면 교체 (다른 프레임에서 연속 클릭 시)
    if (currentMoreView?.type === TOGGLE_STATES.BLOCK_MORE) {
      replaceMoreView(TOGGLE_STATES.BLOCK_MORE, part2 || DEFAULT_PART2, templatesForPart2, handleSelectTemplate);
      return;
    }

    // 다른 타입의 moreView가 열려있으면 무시
    if (currentMoreView) return;

    pushMoreView(
      TOGGLE_STATES.BLOCK_MORE,
      part2 || DEFAULT_PART2,
      templatesForPart2,
      handleSelectTemplate,
      TOGGLE_STATES.TEMPLATE, // originalTool: 뒤로가기 시 BlockTool로
    );
  }, [templatesForPart2, part2, pushMoreView, replaceMoreView, currentMoreView, handleSelectTemplate]);

  return (
    <Html
      divProps={{
        style: {
          position: 'absolute',
          top: `${frameY - btnSizeSidebar - TOOLBOX_OFFSET}px`,
          width: `${frameWidth}px`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'end',
          gap: '70px',
          pointerEvents: 'auto',
        },
      }}
    >
      {/* 좌측: 파트 라벨 + 프레임 이름 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="p-bold shrink-0 text-gray-400">{part2 || DEFAULT_PART2}</span>
        <VerticalDivider />
        <Input
          type="text"
          defaultValue={frameName}
          maxLength={30}
          placeholder={DEFAULT_FRAME_NAME}
          className="p-bold min-w-0 flex-1 cursor-text truncate border-none bg-transparent text-gray-300 outline-none placeholder:text-gray-300 focus:placeholder:text-transparent"
          onBlur={(e) => {
            const value = e.target.value.trim();
            // 빈 값이면 원래 값으로 복원
            if (!value) {
              e.target.value = frameName;
              return;
            }
            e.target.value = value;
            handleRename(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.currentTarget.blur();
              return;
            }
            if (e.key === 'Escape') {
              e.currentTarget.value = frameName;
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      {/* 우측: ColorPicker + Divider + 템플릿 교체 + 프레임 액션들 */}
      <div className="flex shrink-0 items-center gap-3">
        {/* ColorPicker */}
        <IconButton
          icon="auto_awesome_mosaic"
          text="템플릿 교체"
          iconColor="var(--color-point)"
          textClassName="p"
          className="btn-secondary"
          onClick={handleTemplateChange}
        />
        {/* 높이 입력 */}
        {frameHeight && (
          <NumericInputField
            key={frameHeight}
            label="높이"
            defaultValue={frameHeight}
            suffix="px"
            onCommit={handleHeightChange}
            min={100}
            max={10000}
            className="w-38"
          />
        )}
        <VerticalDivider />
        <ActionTooltip content="배경 색상" direction="bottom">
          <div className="flex-center h-(--btn-h) w-(--btn-h) rounded-lg border border-gray-200 bg-white">
            <ColorPicker initialColor={rgbaToHex(fill)} onChange={handleFillChange} />
          </div>
        </ActionTooltip>

        {/* 프레임 액션 버튼들 */}
        <CommonIconToggleGroup className="w-39" items={frameActionItems} />
      </div>
    </Html>
  );
};
