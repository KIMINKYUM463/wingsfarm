/**
 * 상세페이지 디자인 스타일 (초안 화면·서버 레이아웃·편집기 템플릿이 함께 사용)
 *
 * 860px 상세페이지에서 자주 쓰이는 디자인 패턴을 4가지 방향으로 정리한 것.
 * 같은 섹션 구성·문구라도 스타일에 따라 글꼴·정렬·바탕·카드·사진 모양이 달라진다.
 */
export type DesignStyleId = 'modern' | 'natural' | 'premium' | 'pop' | 'docu';

export interface DesignStyleOption {
  id: DesignStyleId;
  name: string;
  description: string;
  /** 이 스타일과 잘 어울리는 톤 (TONE_PRESETS id) */
  toneId: string;
  /** 제목 글꼴 (편집기 글꼴 목록의 family 이름) */
  headingFont: string;
}

export const DESIGN_STYLE_OPTIONS: DesignStyleOption[] = [
  { id: 'modern', name: '모던', description: '흰 바탕·넓은 여백·왼쪽 정렬 큰 제목, 정보는 카드로 정리', toneId: 'mono', headingFont: 'Pretendard' },
  { id: 'natural', name: '내추럴', description: '따뜻한 바탕·명조 제목·둥근 사진, 산지와 생산자 이야기에 어울려요', toneId: 'forest', headingFont: 'Nanum Myeongjo' },
  { id: 'premium', name: '프리미엄', description: '어두운 바탕·세리프 제목·가는 선, 선물세트와 고급 상품에 어울려요', toneId: 'navy', headingFont: 'Noto Serif KR' },
  { id: 'pop', name: '발랄', description: '굵은 제목·알약 배지·강한 대비, 할인·이벤트 상품에 어울려요', toneId: 'coral', headingFont: 'Pretendard' },
  { id: 'docu', name: '산지 다큐', description: '화면 끝까지 꽉 찬 큰 사진·짧은 제목·각진 모서리, 산지·수확 현장 사진이 많을 때 어울려요', toneId: 'mocha', headingFont: 'Noto Serif KR' },
];

export const designStyleOption = (id: DesignStyleId | undefined) =>
  DESIGN_STYLE_OPTIONS.find((s) => s.id === id) ?? DESIGN_STYLE_OPTIONS.find((s) => s.id === DEFAULT_DESIGN_STYLE)!;

export const DEFAULT_DESIGN_STYLE: DesignStyleId = 'modern';

export const isDesignStyleId = (value: unknown): value is DesignStyleId => DESIGN_STYLE_OPTIONS.some((s) => s.id === value);

export const normalizeDesignStyle = (value: unknown, fallback: DesignStyleId = DEFAULT_DESIGN_STYLE): DesignStyleId =>
  isDesignStyleId(value) ? value : fallback;
