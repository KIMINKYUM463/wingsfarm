'use client';
import IconButton from '@/shared/ui/Button/IconButton';
import { ToggleState } from '@/shared/types/ui/toggles';
import TextTool from '@/features/editor/components/panel/text/TextTool';
import ImageTool from '@/features/editor/components/panel/image/ImageTool';
import ShapeTool from '@/features/editor/components/panel/shape/ShapeTool';
import ShapeEditTool from '@/features/editor/components/panel/shape/ShapeEditTool';
import LineEditTool from '@/features/editor/components/panel/shape/LineEditTool';
import GraphicEditTool from '@/features/editor/components/panel/shape/GraphicEditTool';
import BlockTool from '@/features/editor/components/panel/block/BlockTool';
import FileTool from '@/features/editor/components/panel/file/FileTool';
import ColorTool from '@/features/editor/components/panel/color/ColorTool';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import ProjectTool from '@/features/editor/components/panel/project/ProjectTool';
import ProductImageSelector from '@/features/editor/components/panel/file/ProductImageSelector';
import { isMoreView } from '@/shared/utils/toggleUtils';

const ToolPanel = ({
  handleToolSelect,
  selectedTool,
}: {
  selectedTool: ToggleState;
  handleToolSelect: (tool: ToggleState) => void;
}) => {
  if (selectedTool === TOGGLE_STATES.NONE) {
    return null;
  }

  // 도형/선/그래픽 편집 패널 렌더링
  const renderEditTool = () => {
    if (selectedTool === TOGGLE_STATES.SHAPE_EDIT) return <ShapeEditTool />;
    if (selectedTool === TOGGLE_STATES.LINE_EDIT) return <LineEditTool />;
    if (selectedTool === TOGGLE_STATES.GRAPHIC_EDIT) return <GraphicEditTool />;
    return null;
  };

  // 편집 패널인지 확인
  const isEditView =
    selectedTool === TOGGLE_STATES.SHAPE_EDIT ||
    selectedTool === TOGGLE_STATES.LINE_EDIT ||
    selectedTool === TOGGLE_STATES.GRAPHIC_EDIT;

  return (
    <div className="relative right-0 z-50 h-full w-(--tool-panel-w) border-r border-gray-100 bg-white">
      {isEditView ? (
        renderEditTool()
      ) : isMoreView(selectedTool) ? (
        <ProductImageSelector />
      ) : (
        <>
          {selectedTool === TOGGLE_STATES.TEXT && <TextTool />}
          {selectedTool === TOGGLE_STATES.IMAGE && <ImageTool />}
          {selectedTool === TOGGLE_STATES.SHAPE && <ShapeTool />}
          {selectedTool === TOGGLE_STATES.TEMPLATE && <BlockTool />}
          {selectedTool === TOGGLE_STATES.COLOR && <ColorTool />}
          {selectedTool === TOGGLE_STATES.FILE && <FileTool />}
          {selectedTool === TOGGLE_STATES.PROJECT && <ProjectTool />}
        </>
      )}
      <IconButton
        onClick={() => handleToolSelect(TOGGLE_STATES.NONE)}
        className="btn-side-bar-door absolute top-2/5 -right-4.5 z-50 rounded-full border border-gray-100"
        icon="keyboard_double_arrow_left"
      />
    </div>
  );
};

export default ToolPanel;
