'use client';

import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useShapeEditNavigation } from '@/features/editor/hooks/useShapeEditNavigation';
import { usePopMoreView } from '@/features/editor/store/useToolPanelStore';
import ShapeEditForm from './ShapeEditForm';
import ShapeOutlineForm from './ShapeOutlineForm';

const ShapeEditTool = () => {
  const { shapeElements, lineElements, graphicElements } = useSelectedElement();
  const popMoreView = usePopMoreView();

  const { shouldRender } = useShapeEditNavigation({
    currentType: 'shape',
    hasCurrentElements: shapeElements.length > 0,
    otherElements: {
      line: lineElements.length > 0,
      graphic: graphicElements.length > 0,
    },
  });

  return (
    <ToolSectionLayout title="도형" onBack={popMoreView}>
      {shouldRender && (
        <>
          <ShapeEditForm elements={shapeElements} />
          <ShapeOutlineForm elements={shapeElements} />
        </>
      )}
    </ToolSectionLayout>
  );
};

export default ShapeEditTool;
