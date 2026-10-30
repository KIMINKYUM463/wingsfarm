import { useEffect, useState } from 'react';
import { getCenteredFrameId } from '@/features/editor/lib/centered-frame';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';

/** 지금 보고 있는 페이지 (화면 가운데에 가장 가까운 페이지, 스크롤을 따라간다) */
export function useCenteredFrameId() {
  const frames = useCanvasDataStore((state) => state.frames);
  const [frameId, setFrameId] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setFrameId(getCenteredFrameId());
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [frames]);
  return frameId;
}
