/**
 * AI로 만든 사진 표시
 *
 * 네이버쇼핑(2026-07-10~)은 AI로 만들거나 바꾼 상세페이지 이미지에 AI 활용 사실을
 * "이미지 안 또는 가장 가까운 위치"에 표시하도록 한다(신선식품은 의무).
 * 서버가 AI 에셋 주소에 `ai=1`을 붙이고, 캔버스는 그 주소의 사진 위에 배지를 그린다.
 * 저장소 경로는 `?` 뒤를 무시하므로 파일 읽기에는 영향이 없다.
 */
export const AI_IMAGE_LABEL = 'AI 연출 이미지';

const AI_PARAM = 'ai=1';

export const markAiAssetUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}${AI_PARAM}`;

export const isAiAssetUrl = (url: string | undefined) => Boolean(url && /[?&]ai=1(?:&|$)/.test(url));
