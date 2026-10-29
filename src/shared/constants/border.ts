// 테두리 및 선택 스타일
export const BORDER_STYLES = {
  HOVER: {
    color: '#5DADEC',
    width: 2,
  },
  SELECTED: {
    color: '#5DADEC',
    width: 2,
  },
  TRANSFORMER: {
    color: '#5DADEC',
    width: 2,
  },
  EDITING: {
    color: '#5DADEC',
    width: 2,
  },
  SELECTION_RECT: {
    color: 'rgba(0,0,255,0.5)',
    width: 2,
  },
} as const;

export type BorderStyleType = keyof typeof BORDER_STYLES;
