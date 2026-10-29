'use client';

import dynamic from 'next/dynamic';
import { clsx } from 'clsx';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAiChatStore } from '@/features/editor/store/useAiChatStore';
import { useDialog } from '@/shared/ui/Dialog';
import Button from '@/shared/ui/Button/Button';
import IconButton from '@/shared/ui/Button/IconButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { Tour, useTour, type TourStep } from '@/shared/ui/Tour';
import { useRegenerateFrames } from '@/features/editor/hooks/useRegenerateFrames';
import { shouldShowEditWarning } from '@/shared/ui/Dialog/Modal/components/EditWarningModal';

// window 기반 줌 계산으로 인한 hydration mismatch 방지
const ZoomControl = dynamic(() => import('@/features/editor/components/footer/ZoomControl'), {
  ssr: false,
});

/** 처음 들어온 에디터에서 한 번 보여주는 5단계 편집 안내 */
const EDITOR_TOUR: TourStep[] = [
  { selector: '[data-frame-id]', title: '캔버스', body: '글자를 더블클릭하면 바로 고칠 수 있어요. 사진 자리에 내 사진을 끌어다 놓으면 바뀌어요.' },
  { selector: '[data-tour="editor-sections"]', title: '섹션 목록', body: '누르면 그 섹션으로 이동하고, 끌어서 순서를 바꿔요. 빠진 구성은 템플릿 탭에서 추가해요.' },
  { selector: '[data-tour="editor-tools"]', title: '편집 도구', body: '텍스트·AI 이미지·요소·업로드를 여기서 넣어요. 색상 탭에서 페이지 전체 색을 한 번에 바꿀 수 있어요.' },
  { selector: '[data-tour="editor-chat"]', title: 'AI 채팅', body: '"이 페이지 문구 더 짧게"처럼 말하면 AI가 캔버스를 바로 고쳐요. 마음에 안 들면 되돌리기 한 번이면 돼요.' },
  { selector: '[data-tour="editor-export"]', title: '내보내기', body: '스마트스토어·쿠팡·토스·자사몰 크기에 맞춰 JPG·PNG·WEBP·HTML로 받아요. 다운로드는 무료예요.' },
];

const EditorFooter = () => {
  const isToolPanelOpen = useIsToolPanelOpen();
  const { openModal } = useDialog();
  const { handleRegenerateAll, isPending: isRegenerating } = useRegenerateFrames();
  const productName = useCanvasDataStore((state) => state.productName);
  const categoryName = useCanvasDataStore((state) => state.categoryName);
  const isInitialized = useCanvasDataStore((state) => state.isInitialized);
  const chatOpen = useAiChatStore((state) => state.open);
  const setChatOpen = useAiChatStore((state) => state.setOpen);
  const tour = useTour('editor', isInitialized);

  const handleAiButtonClick = () => {
    const modalType = shouldShowEditWarning() ? 'editWarning' : 'aiDetailPage';
    openModal(modalType);
  };

  return (
    <footer
      className={clsx(
        'fixed bottom-0 right-0 h-(--footer-h) bg-white px-content flex-center-between border-t border-gray-100 z-40',
        isToolPanelOpen
          ? 'left-[calc(var(--w-left-sidebar)+var(--tool-panel-w))]'
          : 'left-(--w-left-sidebar)',
      )}
    >
      <div className="flex gap-2">
        <Button id="ai-button" className="btn-ai" onClick={handleAiButtonClick}>
          <CustomIcon name="ai" width={24} height={24} />
          <span className="title-1-bold">AI</span>
          <span className="btn-ai-hover-text title-1-bold">상세페이지</span>
        </Button>
        <IconButton
          className={clsx('btn-secondary', chatOpen && 'ring-1 ring-(--color-point)')}
          icon="forum"
          text="AI로 수정"
          textClassName="p"
          onClick={() => setChatOpen(!chatOpen)}
          data-tour="editor-chat"
        />
        <IconButton
          className="btn-secondary"
          icon="sync"
          text="초안 다시생성"
          textClassName="p"
          onClick={handleRegenerateAll}
          disabled={isRegenerating}
        />
        <ActionTooltip content="편집 가이드 다시 보기" direction="top">
          <IconButton className="btn-icon text-gray-400" icon="help" onClick={tour.start} aria-label="편집 가이드 다시 보기" />
        </ActionTooltip>
      </div>

      <div className="flex gap-4 items-center">
        {/* 상품명 + 카테고리명 */}
        <div className="flex items-center text-gray-400">
          <p
            className="truncate"
            style={{
              maxWidth:
                'calc(100vw - var(--w-left-sidebar) - var(--tool-panel-w) - 10.125rem - 9.5rem - 3rem - 2rem - 8rem)',
            }}
          >
            {productName || '상품명 미입력'}
          </p>
          <p className="ml-1">{categoryName ? `- ${categoryName}` : '- 카테고리 미지정'}</p>
        </div>

        <ZoomControl className="w-38" />
      </div>
      <Tour steps={EDITOR_TOUR} open={tour.open} onClose={tour.close} />
    </footer>
  );
};

export default EditorFooter;
