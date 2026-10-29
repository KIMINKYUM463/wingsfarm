/**
 * 고유한 ID를 생성하는 유틸리티
 * 타임스탬프와 랜덤 문자열을 조합하여 충돌 가능성 최소화
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};
