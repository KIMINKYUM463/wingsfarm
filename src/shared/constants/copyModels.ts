/** 상세페이지 판매 문구를 쓰는 AI (설정 화면에서 고른다) */
export const COPY_MODELS = [
  { id: 'gpt', label: 'GPT 아스트라', hint: '사람이 쓴 것처럼 자연스러운 문구 (추천 · OpenAI 키 필요)' },
  { id: 'gemini', label: 'Gemini 아르곤', hint: 'Gemini 키만으로 사용 · OpenAI 비용 없음' },
] as const;

export type CopyModelId = (typeof COPY_MODELS)[number]['id'];

export const DEFAULT_COPY_MODEL: CopyModelId = 'gpt';

export const isCopyModelId = (value: unknown): value is CopyModelId => COPY_MODELS.some((m) => m.id === value);

/** GET·PUT /settings/copy-model 응답 */
export interface CopyModelInfo {
  model: CopyModelId;
  /** OpenAI 키가 있는지 (없으면 GPT를 골라도 Gemini가 대신 쓴다) */
  openaiReady: boolean;
}
