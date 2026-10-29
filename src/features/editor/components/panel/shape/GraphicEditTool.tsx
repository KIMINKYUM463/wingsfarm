'use client';

import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useShapeEditNavigation } from '@/features/editor/hooks/useShapeEditNavigation';
import { usePopMoreView } from '@/features/editor/store/useToolPanelStore';
import GraphicEditForm from './GraphicEditForm';

const GraphicEditTool = () => {
  const { graphicElements, shapeElements, lineElements } = useSelectedElement();
  const popMoreView = usePopMoreView();

  const { shouldRender } = useShapeEditNavigation({
    currentType: 'graphic',
    hasCurrentElements: graphicElements.length > 0,
    otherElements: {
      shape: shapeElements.length > 0,
      line: lineElements.length > 0,
    },
  });

  return (
    <ToolSectionLayout title="그래픽" onBack={popMoreView}>
      {shouldRender && <GraphicEditForm elements={graphicElements} />}
    </ToolSectionLayout>
  );
};

export default GraphicEditTool;
