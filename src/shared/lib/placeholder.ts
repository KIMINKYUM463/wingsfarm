/** 템플릿 자리표시([키워드 1])·작성 안내(~적어 주세요)·초안의 (입력 필요) — 남으면 손님에게 그대로 보인다 */
export const PLACEHOLDER = /\[[^\]\n]{1,40}\]|\(입력 ?필요\)|(?:적어|옮겨) 주세요/;

export const hasPlaceholder = (text: string) => PLACEHOLDER.test(text);
