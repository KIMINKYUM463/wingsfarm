'use client';

import { useCallback } from 'react';
import { CommonIconToggleGroup, SliderField, ToolFormLayout } from '@/features/editor/components/panel/common';
import { IMAGE_ZOOM_MAX } from '@/features/editor/hooks/useImagePattern';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';
import type { KonvaImageAdjust, KonvaPathElement, KonvaRectElement } from '@/shared/types/konva';

type ImageElement = KonvaRectElement | KonvaPathElement;
type ImageUpdates = KonvaImageAdjust & { cornerRadius?: number };
type UpdateFor = ImageUpdates | ((element: ImageElement) => ImageUpdates);

/** 슬라이더: 드래그 중에도 50ms마다 반영 */
const SLIDER_OPTIONS = { delay: 150, maxWait: 50 };

/** "원래대로" — 모서리 둥글기는 템플릿 디자인이라 건드리지 않는다 */
const DEFAULT_ADJUST: Required<KonvaImageAdjust> = {
  imageFit: 'cover',
  imageZoom: 1,
  imageFocusX: 0.5,
  imageFocusY: 0.5,
  imageFlipX: false,
  imageFlipY: false,
  imageGrayscale: false,
};

const toPercent = (value: number) => Math.round(value * 100);

/** 모서리 둥글기 100% = 짧은 변의 절반 (원·알약 모양) */
const maxRadius = (element: KonvaRectElement) => Math.min(element.width, element.height) / 2;
const radiusOf = ({ cornerRadius }: KonvaRectElement) =>
  (Array.isArray(cornerRadius) ? cornerRadius[0] : cornerRadius) ?? 0;

const TextLabel = ({ children }: { children: string }) => <span className="p whitespace-nowrap">{children}</span>;

interface ImageAdjustSectionProps {
  /** 선택된 사진 요소 (여러 개면 첫 번째 값을 보여 주고 모두에 적용) */
  elements: ImageElement[];
}

/**
 * 사진 편집 — 맞춤·확대·위치(크롭)·반전·흑백·모서리 둥글기
 * 원본 사진은 그대로 두고 요소에 표시 설정만 저장한다 (되돌리기·자동 저장은 기존 흐름 그대로)
 */
const ImageAdjustSection = ({ elements }: ImageAdjustSectionProps) => {
  const { updateElement } = useElementStore();

  const applyAll = useCallback(
    (updates: UpdateFor) =>
      elements.forEach((element) =>
        updateElement(element.id, typeof updates === 'function' ? updates(element) : updates),
      ),
    [elements, updateElement],
  );
  const applyWhileDragging = useDebouncedCallback(
    applyAll as (updates: unknown) => void,
    SLIDER_OPTIONS,
  ) as (updates: UpdateFor) => void;

  const first = { ...DEFAULT_ADJUST, ...elements[0] };
  const rects = elements.filter((element): element is KonvaRectElement => element.type === 'rect');
  const radiusPercent = rects[0] ? toPercent(radiusOf(rects[0]) / (maxRadius(rects[0]) || 1)) : 0;

  const setRadius = (percent: number) =>
    applyWhileDragging((element) =>
      element.type === 'rect' ? { cornerRadius: Math.round((maxRadius(element) * percent) / 100) } : {},
    );

  return (
    <section className="space-y-6 border-b border-gray-100 pb-8">
      <div className="flex items-center justify-between">
        <h3 className="title-1-bold">사진 편집</h3>
        <button type="button" className="p text-gray-400 hover:text-gray-900" onClick={() => applyAll(DEFAULT_ADJUST)}>
          원래대로
        </button>
      </div>

      <ToolFormLayout title="맞춤" subTitle="채우기는 칸을 꽉 채우고, 맞추기는 사진 전체가 보여요">
        <CommonIconToggleGroup
          items={[
            { customIcon: <TextLabel>채우기</TextLabel>, isActive: first.imageFit === 'cover', onClick: () => applyAll({ imageFit: 'cover' }) },
            { customIcon: <TextLabel>맞추기</TextLabel>, isActive: first.imageFit === 'contain', onClick: () => applyAll({ imageFit: 'contain' }) },
          ]}
        />
      </ToolFormLayout>

      <SliderField
        title="확대 (자르기)"
        min={100}
        max={IMAGE_ZOOM_MAX * 100}
        value={toPercent(first.imageZoom)}
        onChange={(value) => applyWhileDragging({ imageZoom: value / 100 })}
      />
      <SliderField
        title="가로 위치"
        value={toPercent(first.imageFocusX)}
        onChange={(value) => applyWhileDragging({ imageFocusX: value / 100 })}
      />
      <SliderField
        title="세로 위치"
        value={toPercent(first.imageFocusY)}
        onChange={(value) => applyWhileDragging({ imageFocusY: value / 100 })}
      />

      <ToolFormLayout title="반전 · 효과">
        <CommonIconToggleGroup
          items={[
            { customIcon: <TextLabel>좌우 반전</TextLabel>, isActive: first.imageFlipX, onClick: (_, active) => applyAll({ imageFlipX: active }) },
            { customIcon: <TextLabel>상하 반전</TextLabel>, isActive: first.imageFlipY, onClick: (_, active) => applyAll({ imageFlipY: active }) },
            { customIcon: <TextLabel>흑백</TextLabel>, isActive: first.imageGrayscale, onClick: (_, active) => applyAll({ imageGrayscale: active }) },
          ]}
        />
      </ToolFormLayout>

      {rects.length > 0 && <SliderField title="모서리 둥글기" value={radiusPercent} onChange={setRadius} />}
    </section>
  );
};

export default ImageAdjustSection;
