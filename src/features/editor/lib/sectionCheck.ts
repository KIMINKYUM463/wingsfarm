import type { KonvaElement, KonvaTextElement } from '@/shared/types/konva';
import { findBlankImageSlots, findPlaceholderTexts, findVisibleLeaves, isImageElement } from './element-finder';

/**
 * 섹션 기본 점검 (AI 없이 즉시·무료) — AI 도우미 말풍선이 쓴다
 * 처음 만드는 판매자가 가장 자주 놓치는 것: 빈 사진·남은 자리표시·휴대폰에서 작은 글자·긴 문단·약한 제목
 */
export interface SectionNote {
  tone: 'good' | 'fix';
  text: string;
  /** AI 편집 도우미(채팅)에 보낼 고치기 요청 — 문구로 고칠 수 있을 때만 */
  fixRequest?: string;
}

/** 860px 페이지가 휴대폰(약 390px)에서 45%로 줄어든다 — 22px보다 작으면 10px 아래로 보여 읽기 어렵다 */
export const MIN_MOBILE_FONT = 22;
const LONG_PARAGRAPH = 110;
const HEADLINE_FONT = 40;
const WEAK_HEADLINE_FONT = 32;
const HEADLINE_MAX_CHARS = 22;

const visibleTexts = (elements: KonvaElement[]) =>
  findVisibleLeaves(elements, (e) => e.type === 'text' && Boolean((e as KonvaTextElement).text?.trim())) as KonvaTextElement[];

const charCount = (text: string) => text.replace(/\s/g, '').length;

export function checkSection(elements: KonvaElement[]): SectionNote[] {
  const notes: SectionNote[] = [];
  const texts = visibleTexts(elements);
  const blanks = findBlankImageSlots(elements).length;
  const placeholders = findPlaceholderTexts(elements).length;
  const photos = findVisibleLeaves(elements, (e) => isImageElement(e) && 'assetId' in e && Boolean(e.assetId)).length;
  const small = texts.filter((t) => t.fontSize < MIN_MOBILE_FONT).length;
  const long = texts.filter((t) => charCount(t.text) > LONG_PARAGRAPH).length;
  const headline = [...texts].sort((a, b) => b.fontSize - a.fontSize)[0];

  if (placeholders) {
    notes.push({ tone: 'fix', text: `채울 문구가 ${placeholders}곳 남았어요. "[키워드]" 같은 글자가 손님에게 그대로 보여요.`, fixRequest: '이 페이지에 남은 자리표시 문구를 상품 정보로 채워줘' });
  }
  if (blanks) notes.push({ tone: 'fix', text: `빈 사진 자리가 ${blanks}곳 있어요. 사진을 넣거나 자리를 지워 주세요.` });
  if (small) {
    notes.push({ tone: 'fix', text: `글자 ${small}개가 휴대폰에서 너무 작게 보여요 (${MIN_MOBILE_FONT}px 미만).`, fixRequest: '이 페이지의 작은 글자를 휴대폰에서 읽기 좋게 키워줘' });
  }
  if (long) notes.push({ tone: 'fix', text: '한 문단이 길어요. 두세 줄로 줄이면 훨씬 잘 읽혀요.', fixRequest: '이 페이지의 긴 문단을 두세 줄로 짧게 다듬어줘' });
  if (headline && headline.fontSize < WEAK_HEADLINE_FONT) {
    notes.push({ tone: 'fix', text: '눈에 띄는 큰 제목이 없어요. 3초 안에 무슨 섹션인지 보여야 해요.', fixRequest: '이 페이지 제목을 혜택이 보이게 짧고 크게 바꿔줘' });
  }

  if (headline && headline.fontSize >= HEADLINE_FONT && charCount(headline.text) <= HEADLINE_MAX_CHARS) notes.push({ tone: 'good', text: '제목이 짧고 크게 눈에 잘 띄어요.' });
  if (photos && !blanks) notes.push({ tone: 'good', text: '사진 자리가 모두 채워져 있어요.' });
  if (texts.length && !placeholders && !small && !long) notes.push({ tone: 'good', text: '문구가 다 채워졌고 휴대폰에서도 읽기 좋은 크기예요.' });
  return notes;
}

/** 고칠 점 → AI가 문구로 고칠 것(같은 요청은 하나로) / 직접 해야 할 것(사진·배치 등) */
export function splitFixes(notes: Pick<SectionNote, 'text' | 'fixRequest'>[]) {
  const auto = new Map<string, string>();
  const manual: string[] = [];
  for (const { text, fixRequest } of notes) {
    if (fixRequest) {
      if (!auto.has(fixRequest)) auto.set(fixRequest, text);
    } else if (!manual.includes(text)) {
      manual.push(text);
    }
  }
  return { auto: [...auto.keys()], manual };
}

/** AI 채팅 요청 길이 한도 (서버 chat.ts LIMITS.message) */
const FIX_MESSAGE_MAX = 500;

/** 여러 고치기 요청을 AI 편집 도우미에 보낼 한 문장으로 묶는다 (한도를 넘는 항목은 뺀다) */
export function buildFixMessage(requests: string[]) {
  if (requests.length === 1) return requests[0].slice(0, FIX_MESSAGE_MAX);
  let message = '이 페이지를 아래 개선점대로 한 번에 고쳐줘. 상품 정보에 없는 내용은 새로 만들지 마.';
  requests.forEach((request, i) => {
    const line = `\n${i + 1}. ${request}`;
    if (message.length + line.length <= FIX_MESSAGE_MAX) message += line;
  });
  return message;
}
