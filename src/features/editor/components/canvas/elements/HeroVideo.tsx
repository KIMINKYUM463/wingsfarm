'use client';

import Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import { HERO_VIDEO_NAME } from '@/features/editor/store/useHeroVideoStore';
import type { KonvaRectElement } from '@/shared/types/konva';

const FPS = 24;

/** 맨 위 사진 자리 위에서 움직이는 컷을 소리 없이 반복 재생 — 클릭은 아래 사진 자리로 통과 */
export function HeroVideo({ element, url }: { element: KonvaRectElement; url: string }) {
  const imageRef = useRef<Konva.Image>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = document.createElement('video');
    Object.assign(el, { muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', src: url });
    const onReady = () => setVideo(el);
    el.addEventListener('loadeddata', onReady);
    void el.play().catch(() => undefined);
    return () => {
      el.removeEventListener('loadeddata', onReady);
      el.pause();
      el.removeAttribute('src');
      el.load();
      setVideo(null);
    };
  }, [url]);

  useEffect(() => {
    const layer = imageRef.current?.getLayer();
    if (!video || !layer) return;
    let last = 0;
    const animation = new Konva.Animation((frame) => {
      if (!frame || frame.time - last < 1000 / FPS) return false;
      last = frame.time;
    }, layer);
    animation.start();
    return () => {
      animation.stop();
    };
  }, [video]);

  if (!video) return null;
  return (
    <KonvaImage
      ref={imageRef}
      name={HERO_VIDEO_NAME}
      image={video}
      listening={false}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      offsetX={element.offsetX}
      offsetY={element.offsetY}
      scaleX={element.scaleX ?? 1}
      scaleY={element.scaleY ?? 1}
      cornerRadius={element.cornerRadius}
      opacity={element.opacity ?? 1}
    />
  );
}
