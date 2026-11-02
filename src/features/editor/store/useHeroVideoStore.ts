import { create } from 'zustand';

/** 캔버스에 그린 영상 노드 이름 — 다운로드할 때는 숨긴다 (JPG는 사진, GIF는 서버가 클립을 직접 합성) */
export const HERO_VIDEO_NAME = '_hero-video';

/**
 * 캔버스 맨 위 사진 자리에 재생할 움직이는 컷
 * useHeroMotion이 '적용'된 컷을 넣고, 사진 자리(KonvaRect)가 자기 id와 같으면 영상을 그린다
 */
interface HeroVideoState {
  elementId: string | null;
  url: string | null;
  setHeroVideo: (video: { elementId: string; url: string } | null) => void;
}

export const useHeroVideoStore = create<HeroVideoState>((set) => ({
  elementId: null,
  url: null,
  setHeroVideo: (video) => set({ elementId: video?.elementId ?? null, url: video?.url ?? null }),
}));
