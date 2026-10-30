/** 맨 위 움직이는 컷 상태 (프로젝트마다 하나) */
export type HeroMotionKind = 'pan' | 'video' | 'stock';

/** 무료 영상 사이트 */
export type StockSource = 'pexels' | 'pixabay';

/** 무료 영상 출처 표시 */
export interface HeroMotionCredit {
  author: string;
  url: string;
  /** 예전 기록에는 없다 → Pexels */
  source?: StockSource;
}

export interface HeroMotionInfo {
  kind: HeroMotionKind;
  status: 'pending' | 'ready' | 'failed';
  /** 움직이는 컷이 들어간 섹션(프레임)과 사진 자리 */
  frameId: string;
  elementId: string;
  /** 클립을 만든 원본 사진 — 사진을 바꾸면 다시 만들어야 한다 (무료 영상은 사진과 무관) */
  assetId: string;
  clipUrl: string | null;
  /** 실패 이유 또는 대체 안내 (예: AI 영상 실패 → 줌·이동으로 대신) */
  notice: string | null;
  credit?: HeroMotionCredit | null;
  updatedAt: string;
}

/** 무료 영상 검색 결과 한 건 */
export interface StockVideo {
  source: StockSource;
  id: number;
  thumbnail: string;
  /** 초 */
  duration: number;
  width: number;
  height: number;
  author: string;
  pageUrl: string;
}
