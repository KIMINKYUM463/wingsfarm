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

const maxCharsOf = (text: string) => Math.ceil(text.replace(/\s/g, '').length * 1.2) + 2;

export async function rewriteFrame(
  gemini: JsonWriter,
  brief: string,
  frame: ProjectFrame,
  pageCopy: string[] = [],
): Promise<ProjectFrame> {
  const node = asNode(frame.frameData);
  const texts = collectEditableTexts(node);
  if (!texts.length) return frame;

  const guides = collectPromptGuides(node);
  const result = await gemini.generateJson<{ texts?: { id: string; text: string }[] }>(
    `너는 한국 이커머스 상세페이지 카피라이터다. 아래 섹션 템플릿의 문구를 이 상품에 맞게 새로 써라.

[상품]
${brief}

[섹션] ${frame.part2 || frame.frameName || '상세 섹션'}
${guides.length ? `[디자이너 작성 가이드]\n${guides.join('\n')}\n` : ''}${
      pageCopy.length ? `[이 페이지의 다른 섹션 문구] (상품 사실·톤 참고용, 같은 문장을 그대로 반복하지 않는다)\n${pageCopy.join(' / ')}\n` : ''
    }
[현재 문구] (id, 원래 문구, 최대 글자 수, 줄 수)
${JSON.stringify(texts.map((t) => ({ id: t.id, text: t.text, maxChars: maxCharsOf(t.text), lines: t.text.split('\n').length })))}

규칙:
- 모든 id에 대해 1개씩 작성하고, 원래 문구의 역할(제목·본문·라벨·숫자·버튼)을 유지한다.
- 공백 제외 글자 수는 maxChars 이내, 줄 수(lines)는 같게 한다. 줄바꿈은 \\n 으로 표현한다.
- "~적어 주세요"처럼 작성 안내가 들어 있는 문구는 이 상품의 실제 판매 문구로 바꾼다.
- 상품 정보에 없는 수치·인증·성분·후기·가격은 지어내지 말고 일반적인 표현을 쓴다.
- 대괄호 [ ] 자리표시는 상품 정보에 그 사실이 있을 때만 채우고, 없으면 대괄호째 그대로 둔다.
- 영문 라벨(예: POINT 01, BEST)은 형식을 유지한다.

${NATURAL_COPY_RULES}

JSON 형식: {"texts":[{"id":"...","text":"..."}]}`,
    [],
    'copy',
  );

  const allowed = new Set(texts.map((t) => t.id));
  const map = Object.fromEntries(
    (result.texts ?? []).filter((t) => allowed.has(t?.id)).map((t) => [t.id, String(t.text)]),
  );
  return { ...frame, frameData: asFrame(applyTexts(structuredClone(node), map)) };
}
