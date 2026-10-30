export const LEFT_SIDEBAR_TOGGLE = [
  { name: 'template', label: '템플릿', iconName: 'auto_awesome_mosaic' },
  { name: 'text', label: '텍스트', iconName: 'insert_text' },
  { name: 'image', label: 'AI 이미지', iconName: 'image' },
  { name: 'shape', label: '요소', iconName: 'category' },
  { name: 'color', label: '색상', iconName: 'palette' },
  { name: 'animation', label: '움직임', iconName: 'animation' },
  { name: 'file', label: '업로드', iconName: 'backup' },
  { name: 'project', label: '프로젝트', iconName: 'folder' },
] as const;

export const TOGGLE_STATES = {
  NONE: 'none',
  TEMPLATE: 'template',
  TEXT: 'text',
  IMAGE: 'image',
  SHAPE: 'shape',
  GROUP: 'group',
  COLOR: 'color',
  ANIMATION: 'animation',
  FILE: 'file',
  PROJECT: 'project',
  BLOCK_MORE: 'block_more',
  IMAGE_STYLE_MORE: 'image_style_more',
  MODEL_SHOT_MORE: 'model_shot_more',
  SHAPE_MORE: 'shape_more',
  SHAPE_EDIT: 'shape_edit',
  LINE_EDIT: 'line_edit',
  GRAPHIC_EDIT: 'graphic_edit',
} as const;

export const TOGGLE_CREATE_DETAIL_PAGE = {
  IMAGE: 'image',
  KEYWORD: 'keyword', // 'keyword'로 변경되어야 합니다.
} as const;
