import { create } from 'zustand';

/** 상세페이지 첫 섹션 위에 들어간(적용된) 움직이는 컷 */
export interface HeroVideo {
  url: string;
  width: number;
  height: number;
}

/**
 * useHeroMotion이 '적용'된 컷을 넣고, 에디터 맨 위 영상 섹션(HeroMotionSection)과 미리보기가 꺼내 쓴다
 */
interface HeroVideoState {
  video: HeroVideo | null;
  setHeroVideo: (video: HeroVideo | null) => void;
}

export const useHeroVideoStore = create<HeroVideoState>((set) => ({
  video: null,
  setHeroVideo: (video) => set({ video }),
}));
