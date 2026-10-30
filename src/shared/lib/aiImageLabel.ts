/**
 * AI로 만든 사진 구분 표시
 *
 * 서버가 AI 에셋 주소에 `ai=1`을 붙여 AI 사진인지 구분할 수 있게 한다 (사진 위 배지는 그리지 않음).
 * 네이버쇼핑(2026-07-10~)은 AI 이미지의 AI 활용 표시를 요구하므로(신선식품은 의무) 페이지 끝 AI 고지 섹션은 유지한다.
 * 저장소 경로는 `?` 뒤를 무시하므로 파일 읽기에는 영향이 없다.
 */
const AI_PARAM = 'ai=1';

export const markAiAssetUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}${AI_PARAM}`;

export const isAiAssetUrl = (url: string | undefined) => Boolean(url && /[?&]ai=1(?:&|$)/.test(url));
