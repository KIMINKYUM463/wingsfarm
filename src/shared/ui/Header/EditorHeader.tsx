'use client';

import { useRef } from 'react';
import Logo from '@/shared/ui/Logo';
import IconButton from '@/shared/ui/Button/IconButton';
import HomeButton from '@/shared/ui/Button/HomeButton';
import Popover from '@/shared/ui/Popover/Popover';
import CustomIcon from '@/shared/ui/CustomIcon';
import Input from '@/shared/ui/Input/Input';
import VerticalDivider from '@/shared/ui/Divider/VerticalDivider';
import CreditButton from '@/shared/ui/Button/CreditButton';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { useManualSave } from '@/features/editor/hooks/useManualSave';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useUpdateProject } from '@/features/projects/hooks';
import { useHistory } from '@/features/editor/hooks/useHistory';
import { VersionHistoryButton } from '@/features/editor/components/overlay/VersionHistory';
import { PagePreviewButton } from '@/features/editor/components/overlay/PagePreview';

interface EditorHeaderProps {
  productName?: string;
}

export function EditorHeader({ productName = '' }: EditorHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // 수동 저장
  const { handleSave, isDisabled } = useManualSave();

  // 자동 저장 상태
  const saveStatus = useAutoSaveStore((state) => state.status);

  // 프로젝트 정보 수정
  const { mutate: updateProductName, isPending } = useUpdateProject();

  // Undo/Redo
  const { undo, redo, canUndo, canRedo } = useHistory();

  /** 상품명 변경 처리 (blur 시 호출) */
  const handleProductNameChange = (value: string) => {
    // 변경 없거나 진행 중이면 무시
    if (value === productName || isPending) return;

    updateProductName(
      { productName: value || null },
      {
        onError: () => {
          // 에러 시 Input 값 롤백
          if (inputRef.current) {
            inputRef.current.value = productName;
          }
        },
      },
    );
  };

  return (
    <header className="px-content flex-center-between fixed top-0 right-0 left-0 z-50 h-(--header-h) border-b border-(--color-border) bg-white">
      <div className="flex gap-6">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ActionTooltip content="실행 취소" direction="bottom">
              <IconButton
                icon="undo"
                className="btn-editor p-2.25"
                onClick={undo}
                disabled={!canUndo}
              />
            </ActionTooltip>
            <ActionTooltip content="다시 실행" direction="bottom">
              <IconButton
                icon="redo"
                className="btn-editor p-2.25"
                onClick={redo}
                disabled={!canRedo}
              />
            </ActionTooltip>
          </div>
          <VerticalDivider className="-mx-px self-center" />
          <ActionTooltip
            content={
              saveStatus === 'pending'
                ? '변경사항 있음'
                : saveStatus === 'saving'
                  ? '저장 중'
                  : '저장 완료'
            }
            direction="bottom"
          >
            <IconButton
              customIcon={
                saveStatus === 'pending' || saveStatus === 'saving' ? (
                  <CustomIcon name="folder-loading" width={24} height={24} />
                ) : undefined
              }
              icon={
                saveStatus === 'pending' || saveStatus === 'saving' ? undefined : 'folder_check_2'
              }
              className="btn-editor p-2.25 disabled:bg-transparent"
              onClick={handleSave}
              disabled={isDisabled || saveStatus === 'saving'}
            />
          </ActionTooltip>
          <VersionHistoryButton />
        </div>
      </div>

      <div
        className="@container"
        style={{
          position: 'absolute',
          left: 'calc(var(--w-left-sidebar) + var(--tool-panel-w))',
          width:
            'min(28.125rem, calc(100vw - var(--w-left-sidebar) - var(--tool-panel-w) - 27rem))',
        }}
      >
        <Input
          ref={inputRef}
          placeholder="제목을 입력해주세요"
          defaultValue={productName}
          maxLength={100}
          className="input-single hidden w-full @[12.5rem]:block"
          onBlur={(e) => {
            const value = e.target.value.trim();
            e.target.value = value;
            handleProductNameChange(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.currentTarget.blur();
              return;
            }
            if (e.key === 'Escape') {
              e.currentTarget.value = productName;
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="flex gap-2">
        <HomeButton compact />
        <Popover
          contentType="fileUpload"
          position="alignCenter"
          hasBackButton={false}
          trigger={
            <IconButton
              icon="more_horiz"
              className="h-(--btn-h) w-(--btn-h) rounded-lg p-1 hover:bg-gray-50 focus:bg-gray-100"
            />
          }
        />
        <Popover
          contentType="userProfile"
          position="alignCenter"
          hasBackButton={false}
          trigger={
            <IconButton
              customIcon={<CustomIcon name="profile" width={32} height={32} />}
              className="h-(--btn-h) rounded-full p-[0.3175rem] hover:bg-gray-100 focus:bg-gray-100"
            />
          }
        />
        {/* TODO: 크레딧 잔액 버튼 임시 숨김 */}
        {/* <CreditButton /> */}

        <PagePreviewButton />
        <Popover
          contentType="download"
          trigger={
            <IconButton
              icon="vertical_align_bottom"
              textClassName="p"
              text="다운로드"
              className="btn-primary"
              data-tour="editor-export"
            />
          }
        />
        <a
          href="https://adaptive-bucket-63a.notion.site/LeverPage-2ef3d7ccabd980789146d8889a005f51"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconButton
            icon="arrow_outward"
            text="제작 가이드"
            iconPosition="right"
            className="btn-dark hidden sm:flex"
            textClassName="p"
          />
        </a>
      </div>
    </header>
  );
}
