'use client';

import dynamic from 'next/dynamic';
import { clsx } from 'clsx';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useDialog } from '@/shared/ui/Dialog';
import Button from '@/shared/ui/Button/Button';
import IconButton from '@/shared/ui/Button/IconButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import { useRegenerateFrames } from '@/features/editor/hooks/useRegenerateFrames';
import { shouldShowEditWarning } from '@/shared/ui/Dialog/Modal/components/EditWarningModal';

// window 기반 줌 계산으로 인한 hydration mismatch 방지
const ZoomControl = dynamic(() => import('@/features/editor/components/footer/ZoomControl'), {
  ssr: false,
});

const EditorFooter = () => {
  const isToolPanelOpen = useIsToolPanelOpen();
  const { openModal } = useDialog();
  const { handleRegenerateAll, isPending: isRegenerating } = useRegenerateFrames();
  const productName = useCanvasDataStore((state) => state.productName);
  const categoryName = useCanvasDataStore((state) => state.categoryName);

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
          className="btn-secondary"
          icon="sync"
          text="초안 다시생성"
          textClassName="p"
          onClick={handleRegenerateAll}
          disabled={isRegenerating}
        />
      </div>

      <div className="flex gap-4 items-center">
        {/* 상품명 + 카테고리명 */}
        <div className="flex items-center text-gray-400">
          <p
            className="truncate"
            style={{
              maxWidth:
                'calc(100vw - var(--w-left-sidebar) - var(--tool-panel-w) - 10.125rem - 9.5rem - 3rem - 2rem)',
            }}
          >
            {productName || '상품명 미입력'}
          </p>
          <p className="ml-1">{categoryName ? `- ${categoryName}` : '- 카테고리 미지정'}</p>
        </div>

        <ZoomControl className="w-38" />
      </div>
    </footer>
  );
};

export default EditorFooter;
