import { LEFT_SIDEBAR_TOGGLE, TOGGLE_CREATE_DETAIL_PAGE } from '@/shared/constants/ui/toggles';

export type LeftSidebarToggleItem = (typeof LEFT_SIDEBAR_TOGGLE)[number];
export type LeftSidebarToggleName = LeftSidebarToggleItem['name'];
export type ToggleState =
  | LeftSidebarToggleName
  | 'none'
  | 'group'
  | 'block_more'
  | 'image_style_more'
  | 'model_shot_more'
  | 'shape_more'
  | 'shape_edit'
  | 'line_edit'
  | 'graphic_edit';
export type CreateDetailPageTogglesValue =
  (typeof TOGGLE_CREATE_DETAIL_PAGE)[keyof typeof TOGGLE_CREATE_DETAIL_PAGE];
