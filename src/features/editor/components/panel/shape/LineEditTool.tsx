'use client';

import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useShapeEditNavigation } from '@/features/editor/hooks/useShapeEditNavigation';
import { usePopMoreView } from '@/features/editor/store/useToolPanelStore';
import LineEditForm from './LineEditForm';

const LineEditTool = () => {
  const { shapeElements, lineElements, graphicElements } = useSelectedElement();
  const popMoreView = usePopMoreView();

  const { shouldRender } = useShapeEditNavigation({
    currentType: 'line',
    hasCurrentElements: lineElements.length > 0,
    otherElements: {
      shape: shapeElements.length > 0,
      graphic: graphicElements.length > 0,
    },
  });

  return (
    <ToolSectionLayout title="선" onBack={popMoreView}>
      {shouldRender && <LineEditForm elements={lineElements} />}
    </ToolSectionLayout>
  );
};

export default LineEditTool;
