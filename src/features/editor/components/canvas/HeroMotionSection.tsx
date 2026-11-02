'use client';

import { useFrameLayout } from '@/features/editor/hooks/useFrameLayout';
import type { HeroMotionState } from '@/features/editor/hooks/useHeroMotion';
import { CANVAS_WIDTH } from '@/features/editor/lib/download-options';
import { useHeroVideoStore } from '@/features/editor/store/useHeroVideoStore';
import { showToast } from '@/utils/toast';

/**
 * 상세페이지 첫 섹션 위에 따로 들어간 움직이는 컷 (템플릿과 별개)
 * - 페이지 폭에 맞춰 첫 섹션과 같은 확대율·위치로 보여준다
 * - 다운로드할 땐 이 영상이 GIF로, 그 아래 섹션들이 JPG로 나간다
 */
export function HeroMotionSection({ hero, onEdit }: { hero: HeroMotionState; onEdit: () => void }) {
  const video = useHeroVideoStore((state) => state.video);
  const height = video ? Math.round((CANVAS_WIDTH * video.height) / video.width) : 0;
  const { scaledFrameWidth, scaledFrameHeight, layerOffsetY } = useFrameLayout({ width: CANVAS_WIDTH, height }, { index: 0 });
  if (!video) return null;

  const remove = () =>
    hero.apply.mutate(false, { onSuccess: () => showToast.success('맨 위 움직이는 컷을 뺐어요. 다시 넣으려면 위쪽 칩을 눌러 주세요.') });

  return (
    <section data-frame-id="hero-motion" aria-label="맨 위 움직이는 컷" className="flex justify-center" style={{ paddingTop: layerOffsetY }}>
      <div className="relative" style={{ width: scaledFrameWidth }}>
        <div className="absolute -top-9 right-0 left-0 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-gray-700">
            ▶ 맨 위 움직이는 컷 <span className="font-normal text-gray-400">· 템플릿 위에 따로 들어가요 (GIF로 내보내기)</span>
          </span>
          <span className="flex gap-1.5">
            <button type="button" className="btn-outline px-2.5 py-1 text-xs" onClick={onEdit}>
              바꾸기·GIF
            </button>
            <button type="button" className="btn-outline px-2.5 py-1 text-xs" disabled={hero.apply.isPending} onClick={remove}>
              빼기
            </button>
          </span>
        </div>
        <video
          src={video.url}
          className="block w-full bg-gray-900 shadow-sm"
          style={{ height: scaledFrameHeight }}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    </section>
  );
}
