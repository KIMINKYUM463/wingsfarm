/**
 * Konva 에디터 폰트 설정 상수
 *
 * - Variable 폰트: 단일 파일로 모든 weight 지원 (Pretendard)
 * - Static 폰트: weight별 개별 파일 로드 필요 (Google Fonts)
 */

export interface FontDefinition {
  /** 내부 ID (Dropdown key) */
  id: string;
  /** CSS font-family 이름 */
  family: string;
  /** UI 표시명 */
  label: string;
  /** 폰트 타입 */
  type: 'variable' | 'static';
  /** 지원 weight 목록 */
  weights: number[];
  /** 로드 소스 */
  source: 'local' | 'google';
  /** Google Fonts URL (source가 google일 때) */
  googleUrl?: string;
}

/**
 * 지원 폰트 목록
 */
export const FONT_DEFINITIONS: FontDefinition[] = [
  {
    id: 'pretendard',
    family: 'Pretendard',
    label: 'Pretendard',
    type: 'variable',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    source: 'local',
  },
  {
    id: 'nanum-gothic',
    family: 'Nanum Gothic',
    label: '나눔고딕',
    type: 'static',
    weights: [400, 700, 800],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap',
  },
  {
    id: 'nanum-myeongjo',
    family: 'Nanum Myeongjo',
    label: '나눔명조',
    type: 'static',
    weights: [400, 700, 800],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap',
  },
  {
    id: 'noto-sans-kr',
    family: 'Noto Sans KR',
    label: 'Noto Sans KR',
    type: 'static',
    weights: [100, 300, 400, 500, 700, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100;300;400;500;700;900&display=swap',
  },
  {
    id: 'noto-serif-kr',
    family: 'Noto Serif KR',
    label: 'Noto Serif KR',
    type: 'static',
    weights: [200, 300, 400, 500, 600, 700, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200;300;400;500;600;700;900&display=swap',
  },
  {
    id: 'work-sans',
    family: 'Work Sans',
    label: 'Work Sans',
    type: 'static',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Work+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap',
  },
  {
    id: 'quicksand',
    family: 'Quicksand',
    label: 'Quicksand',
    type: 'static',
    weights: [300, 400, 500, 600, 700],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap',
  },
  {
    id: 'nunito',
    family: 'Nunito',
    label: 'Nunito',
    type: 'static',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600;700;800;900&display=swap',
  },
  {
    id: 'rubik',
    family: 'Rubik',
    label: 'Rubik',
    type: 'static',
    weights: [300, 400, 500, 600, 700, 800, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap',
  },
  {
    id: 'karla',
    family: 'Karla',
    label: 'Karla',
    type: 'static',
    weights: [200, 300, 400, 500, 600, 700, 800],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Karla:wght@200;300;400;500;600;700;800&display=swap',
  },
  {
    id: 'dm-sans',
    family: 'DM Sans',
    label: 'DM Sans',
    type: 'static',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap',
  },
  {
    id: 'abhaya-libre',
    family: 'Abhaya Libre',
    label: 'Abhaya Libre',
    type: 'static',
    weights: [400, 500, 600, 700, 800],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@400;500;600;700;800&display=swap',
  },
  // ========================================
  // Figma 템플릿 폰트 (Google Fonts)
  // ========================================
  {
    id: 'abril-fatface',
    family: 'Abril Fatface',
    label: 'Abril Fatface',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&display=swap',
  },
  {
    id: 'ramaraja',
    family: 'Ramaraja',
    label: 'Ramaraja',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Ramaraja&display=swap',
  },
  {
    id: 'abyssinica-sil',
    family: 'Abyssinica SIL',
    label: 'Abyssinica SIL',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Abyssinica+SIL&display=swap',
  },
  {
    id: 'antic-didone',
    family: 'Antic Didone',
    label: 'Antic Didone',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Antic+Didone&display=swap',
  },
  {
    id: 'prata',
    family: 'Prata',
    label: 'Prata',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Prata&display=swap',
  },
  {
    id: 'prociono',
    family: 'Prociono',
    label: 'Prociono',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Prociono&display=swap',
  },
  {
    id: 'andada-pro',
    family: 'Andada Pro',
    label: 'Andada Pro',
    type: 'static',
    weights: [400, 500, 600, 700, 800],
    source: 'google',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Andada+Pro:wght@400;500;600;700;800&display=swap',
  },
  {
    id: 'andika',
    family: 'Andika',
    label: 'Andika',
    type: 'static',
    weights: [400, 700],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Andika:wght@400;700&display=swap',
  },
  {
    id: 'chonburi',
    family: 'Chonburi',
    label: 'Chonburi',
    type: 'static',
    weights: [400],
    source: 'google',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Chonburi&display=swap',
  },
];

/**
 * 폰트 ID로 FontDefinition 조회
 */
export const getFontById = (id: string): FontDefinition | undefined =>
  FONT_DEFINITIONS.find((f) => f.id === id);

/**
 * fontFamily로 FontDefinition 조회
 */
export const getFontByFamily = (family: string): FontDefinition | undefined =>
  FONT_DEFINITIONS.find((f) => f.family === family);

/**
 * 기본 폰트
 */
export const DEFAULT_FONT = FONT_DEFINITIONS[0]; // Pretendard

/**
 * Weight 라벨 매핑
 */
export const WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};
