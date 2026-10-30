/**
 * Gemini 텍스트 모델 등급
 * - fast: 사진 분석·섹션 순서·분류처럼 화면에 직접 나가지 않는 작업 (빠르고 저렴)
 * - copy: 상세페이지에 그대로 실리는 판매 문구 (가장 좋은 모델, 생각 단계 포함)
 */
export type TextTier = 'fast' | 'copy';

interface TextModel {
  model: string;
  generationConfig: Record<string, unknown>;
}

export const TEXT_MODELS: Record<TextTier, TextModel> = {
  fast: {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
  },
  // Gemini 3 이후 모델은 temperature를 기본값(1.0)으로 둬야 반복·품질 저하가 없다
  copy: {
    model: process.env.GEMINI_COPY_MODEL || 'gemini-4-argon',
    generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'medium' } },
  },
};

/**
 * 좋은 모델이 실패했을 때 fast 모델로 다시 시도해도 되는지
 * - 키 자체가 틀렸거나 권한이 없으면 다른 모델도 똑같이 실패하므로 다시 시도하지 않는다
 */
export const canFallback = (status: number, message: string) => {
  if (status === 401 || status === 403) return false;
  if (status === 400) return !/api key/i.test(message);
  return status === 404 || status === 429 || status >= 500;
};
