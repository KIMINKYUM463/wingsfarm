'use client';
import React from 'react';
import { clsx } from 'clsx';
import ToggleGroup from '@/shared/ui/Toggle/ToggleGroup';
import ToolPanel from '@/features/editor/components/panel/ToolPanel';
import { LEFT_SIDEBAR_TOGGLE } from '@/shared/constants/ui/toggles';
import {
  useSelectedTool,
  useToolPanelStore,
  useMoreViewStack,
} from '@/features/editor/store/useToolPanelStore';
import { isMoreView } from '@/shared/utils/toggleUtils';

const ToolLayout = () => {
  const selectedTool = useSelectedTool();
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);
  const moreViewStack = useMoreViewStack();

  // 더보기 화면이 열려있을 때는 원본 툴을 active로 표시
  const displayTool =
    isMoreView(selectedTool) && moreViewStack.length > 0
      ? moreViewStack.at(0)?.originalTool
      : selectedTool;

  return (
    <aside className={clsx('flex fixed z-50 left-0 h-full bg-white')}>
      <ToggleGroup
        items={LEFT_SIDEBAR_TOGGLE}
        wrapClassName="w-(--w-left-sidebar) flex-column items-center gap-4 py-content border-r border-(--color-border)"
        selectedName={displayTool}
        onSelect={setSelectedTool}
      />
      <ToolPanel selectedTool={selectedTool} handleToolSelect={setSelectedTool} />
    </aside>
  );
};

export default ToolLayout;
