import { sceneIdeas } from '@/shared/lib/draftMedia';

/**
 * AI 상품 사진 프롬프트 (초안 생성·에디터 사진 자리·연출 스타일이 함께 쓴다)
 * - 이미지 모델에는 판매자가 올린 상품 사진만 참고로 준다. 디자인 레퍼런스(상세페이지 캡처)를 주면
 *   글씨·레이아웃까지 따라 그려 상세페이지 같은 이미지가 나온다.
 * - 글씨 금지 규칙은 맨 앞과 맨 뒤에 둬서 장면 설명보다 우선하게 한다.
 */
const PHOTO_RULES = [
  'Create ONE new real-camera photograph of the exact product shown in the reference photos.',
  'It is a single photo only — not a web page, detail page, poster, banner, flyer, collage, split screen, infographic, mockup or screenshot.',
  'Keep the product identical to the reference photos: shape, color, size, count, label and packaging. Only the setting, props, lighting and camera distance change.',
  'Photorealistic commercial product photography.',
];

const NO_TEXT_RULE =
  'Absolutely no added text anywhere: no letters, words, numbers, captions, headlines, price tags, badges, stickers, watermarks, logo overlays, frames or borders. ' +
  'Only markings already printed on the product packaging in the reference photos may appear.';

type PromptPart = string | false | null | undefined | 0;

export const productPhotoPrompt = (...details: PromptPart[]) =>
  [...PHOTO_RULES, ...details, NO_TEXT_RULE].filter(Boolean).join('\n');

/** 같은 페이지의 다른 사진과 겹치지 않게 하는 지시 */
export const distinctFrom = (otherScenes: string[]) => {
  const others = [...new Set(otherScenes.map((s) => s.trim()).filter(Boolean))].slice(0, 12);
  return others.length
    ? `Other photos in the same set show: ${others.join(' / ')}. Make this photo clearly different from them (different background, angle, distance and props).`
    : null;
};

/** n번째 사진 자리의 장면 (카테고리별 장면 목록을 돌려 써서 사진마다 다르게) */
export const sceneForIndex = (categoryId: string, index: number) => {
  const ideas = sceneIdeas(categoryId);
  return ideas[((index % ideas.length) + ideas.length) % ideas.length];
};
