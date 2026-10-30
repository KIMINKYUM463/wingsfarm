import 'server-only';
import type { ProjectFrame } from '@/features/editor/types';
import { findCategory } from './catalog/categories';
import { NATURAL_COPY_RULES } from './copyStyle';
import { asFrame, asNode, applyTexts, collectEditableTexts, collectPromptGuides } from './frames/tree';
import type { GeminiClient } from './gemini';
import type { ProductContext, ProjectRecord } from './projects';

/**
 * 템플릿 문구 → 이 상품의 판매 문구 (Gemini 텍스트)
 * - AI 상세페이지 생성, 에디터에서 템플릿 추가·교체, 초안 다시생성이 함께 쓴다
 * - AI 클라이언트는 받아서 쓴다 (테스트에서 가짜로 바꿔 끼울 수 있게)
 */
type JsonWriter = Pick<GeminiClient, 'generateJson'>;

export const contextBrief = (
  project: Pick<ProjectRecord, 'productName' | 'categoryId' | 'companyName'>,
  context?: ProductContext,
) =>
  [
    `상품명: ${project.productName}`,
    `카테고리: ${findCategory(project.categoryId)?.name ?? '기타'}`,
    project.companyName && `업체명: ${project.companyName}`,
    context && `요약: ${context.summary}`,
    context?.target && `타깃: ${context.target}`,
    context?.tone && `톤: ${context.tone}`,
    context?.sellingPoints.length && `핵심 장점: ${context.sellingPoints.join(' / ')}`,
    context?.keywords.length && `키워드: ${context.keywords.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

const oneLine = (text: string, max = 60) => {
  const line = text.replace(/\s*\n\s*/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
};

/**
 * 페이지에 이미 있는 섹션별 대표 문구(글자가 큰 순 2개) — 사실·톤을 맞추고 같은 말 반복을 피하는 데 쓴다
 * @param frames 페이지 순서대로 정렬된 프레임
 */
export const pageCopyOf = (frames: ProjectFrame[], limit = 30) =>
  frames
    .filter((f) => f.status === 'active')
    .flatMap((f) =>
      collectEditableTexts(asNode(f.frameData))
        .sort((a, b) => b.fontSize - a.fontSize)
        .slice(0, 2)
        .map((t) => oneLine(t.text)),
    )
    .slice(0, limit);

/** 템플릿 자리표시([키워드 1])·작성 안내(~적어 주세요) — 남으면 손님에게 그대로 보인다 */
export const PLACEHOLDER = /\[[^\]\n]{1,40}\]|(?:적어|옮겨) 주세요/;
export const hasPlaceholder = (text: string) => PLACEHOLDER.test(text);

/** 자리표시는 모두 채우되, 자료에 없는 사실은 지어내지 않는다 (거짓 후기·수치는 표시광고법 위반) */
export const PLACEHOLDER_RULES = `- 대괄호 [ ] 자리표시와 "~적어 주세요" 같은 작성 안내는 하나도 남기지 않고 손님이 읽을 실제 문구로 바꾼다.
- [키워드]·[이유]·[팁]·[재료]·[단계]·[계절]처럼 일반 내용 자리는 상품 정보로 채운다. 키워드는 2~8자 짧은 말.
- [입력한 상품 사실]에 있는 값(후기·연락처·배송·인증·수치)은 바꾸지 않고 그대로 옮긴다.
- 자료에 없는 사실은 지어내지 않는다. 가격·전화번호·인증번호·판매량·재구매율·당도 같은 수치 자리는 숫자 없이 그 자리 역할에 맞는 말로 바꾼다. 예) [가격] → "옵션에서 확인해 주세요", [전화번호] → "스토어 문의하기로 연락 주세요"
- 실제 후기·생산자 인터뷰가 자료에 없으면 남이 한 말처럼 쓰지 않는다(따옴표·손님 이름·"구매자" 금지). 그 자리는 판매자 말투로 이 상품을 추천하는 이유를 쓰고, 섹션 제목은 "이런 분께 추천해요"처럼, 별점(★) 자리는 "추천 이유" 같은 짧은 라벨로, 작성자 자리는 판매자·브랜드 이름으로 바꾼다.`;

/**
 * 같은 구성(part2) 섹션이 여러 개면(긴 구성) 핵심 장점을 나눠 맡겨 섹션끼리 같은 말을 되풀이하지 않게 한다
 * @param frames 페이지 순서대로 정렬된 프레임
 * @returns 프레임 id → 프롬프트에 붙일 안내
 */
export function sameKindFocus(frames: ProjectFrame[], points: string[]) {
  const groups = new Map<string, ProjectFrame[]>();
  for (const frame of frames.filter((f) => f.status === 'active')) groups.set(frame.part2, [...(groups.get(frame.part2) ?? []), frame]);
  const focus = new Map<string, string>();
  for (const [part2, list] of groups) {
    if (list.length < 2) continue;
    list.forEach((frame, i) => {
      const mine = points.filter((_, j) => j % list.length === i);
      focus.set(
        frame.id,
        `[같은 구성 나눠 쓰기] '${part2}' 섹션이 ${list.length}개 있고 이 섹션은 ${i + 1}번째다. ${
          mine.length ? `다음 장점만 중심으로 쓰고 다른 장점은 되풀이하지 않는다: ${mine.join(' / ')}` : '앞뒤 같은 구성 섹션과 겹치지 않는 다른 내용을 쓴다.'
        }`,
      );
    });
  }
  return focus;
}

const maxCharsOf = (text: string) => Math.max(Math.ceil(text.replace(/\s/g, '').length * 1.2) + 2, hasPlaceholder(text) ? 14 : 0);

type RewriteResult = { texts?: { id: string; text: string }[] };

export async function rewriteFrame(
  gemini: JsonWriter,
  brief: string,
  frame: ProjectFrame,
  pageCopy: string[] = [],
  focus = '',
): Promise<ProjectFrame> {
  const node = asNode(frame.frameData);
  const texts = collectEditableTexts(node);
  if (!texts.length) return frame;

  const guides = collectPromptGuides(node);
  const ask = (targets: typeof texts, retryNote = '') =>
    gemini.generateJson<RewriteResult>(
      `너는 한국 이커머스 상세페이지 카피라이터다. 아래 섹션 템플릿의 문구를 이 상품에 맞게 새로 써라.

[상품]
${brief}

[섹션] ${frame.part2 || frame.frameName || '상세 섹션'}
${focus ? `${focus}\n` : ''}${guides.length ? `[디자이너 작성 가이드]\n${guides.join('\n')}\n` : ''}${
        pageCopy.length ? `[이 페이지의 다른 섹션 문구] (상품 사실·톤 참고용, 같은 문장을 그대로 반복하지 않는다)\n${pageCopy.join(' / ')}\n` : ''
      }${retryNote}
[현재 문구] (id, 원래 문구, 최대 글자 수, 줄 수)
${JSON.stringify(targets.map((t) => ({ id: t.id, text: t.text, maxChars: maxCharsOf(t.text), lines: t.text.split('\n').length })))}

규칙:
- 모든 id에 대해 1개씩 작성하고, 원래 문구의 역할(제목·본문·라벨·숫자·버튼)을 유지한다.
- 공백 제외 글자 수는 maxChars 이내, 줄 수(lines)는 같게 한다. 줄바꿈은 \\n 으로 표현한다.
${PLACEHOLDER_RULES}
- 영문 라벨(예: POINT 01, BEST)은 형식을 유지한다.

${NATURAL_COPY_RULES}

JSON 형식: {"texts":[{"id":"...","text":"..."}]}`,
      [],
      'copy',
    );

  const map: Record<string, string> = {};
  const collect = (result: RewriteResult, targets: typeof texts) => {
    const allowed = new Set(targets.map((t) => t.id));
    for (const t of result.texts ?? []) if (allowed.has(t?.id) && String(t.text).trim()) map[t.id] = String(t.text);
  };
  collect(await ask(texts), texts);

  const leftover = texts.filter((t) => hasPlaceholder(map[t.id] ?? t.text));
  if (leftover.length) {
    collect(
      await ask(leftover, '\n[다시 쓰기] 아래 문구에 자리표시나 작성 안내가 남아 있었다. 이번에는 하나도 남기지 말고 실제 문구로 바꿔라.\n'),
      leftover,
    );
  }
  return { ...frame, frameData: asFrame(applyTexts(structuredClone(node), map)) };
}
