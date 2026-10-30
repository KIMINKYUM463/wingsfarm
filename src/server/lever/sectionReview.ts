import 'server-only';
import type { SectionReviewRequest, SectionReviewResult } from '@/shared/types/sectionReview';
import { requireGemini, type InlineImage } from './gemini';
import { badRequest } from './http';
import { copyBrief } from './productFacts';
import { getProject } from './projects';

/**
 * AI 도우미 섹션 평가 — 섹션 그림 + 문구를 보고 잘된 점·고칠 점을 초보 판매자 눈높이로 알려 준다
 * 사진을 함께 보는 일이라 빠른(fast) 모델로 한 번만 부른다. 버튼을 눌렀을 때만 호출된다.
 */
const LIMITS = { name: 60, texts: 40, text: 300, imageChars: 3_000_000, point: 120, fix: 60, items: 3 };
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

function parseImage(dataUrl: unknown): InlineImage | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > LIMITS.imageChars) return null;
  const match = DATA_URL.exec(dataUrl);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

const roleOf = (index: number, total: number) =>
  index === 0 ? '첫 화면(시선을 잡는 도입)' : index >= total - 1 ? '마지막(구매를 결정하게 하는 마무리)' : '중간(설득·정보)';

/** POST /projects/{id}/ai/section-review */
export async function reviewSection(projectId: string, body: SectionReviewRequest): Promise<SectionReviewResult> {
  const project = await getProject(projectId);
  const texts = (Array.isArray(body?.texts) ? body.texts : [])
    .slice(0, LIMITS.texts)
    .map((t) => ({ text: clean(t?.text, LIMITS.text), fontSize: Math.round(Number(t?.fontSize) || 16) }))
    .filter((t) => t.text);
  const image = parseImage(body?.image);
  if (!texts.length && !image) throw badRequest('평가할 섹션 내용이 없어요.');
  const index = Math.max(0, Number(body.index) || 0);
  const total = Math.max(index + 1, Number(body.total) || 1);

  const gemini = await requireGemini();
  const raw = await gemini.generateJson<{ summary?: unknown; good?: unknown[]; improve?: { point?: unknown; fixRequest?: unknown }[] }>(
    `너는 한국 이커머스 상세페이지 전문 디자이너 겸 카피 코치다. 처음 상세페이지를 만드는 판매자가 만든 섹션 하나를 보고, 옆자리 선배처럼 친절하고 구체적으로 피드백한다.

[상품]
${await copyBrief(project)}

[섹션] ${clean(body.name, LIMITS.name) || '섹션'} — 전체 ${total}개 중 ${index + 1}번째, 역할: ${roleOf(index, total)}
[섹션 문구] (글자 크기 px, 페이지 폭 860px — 휴대폰에서는 약 45%로 줄어 보인다)
${texts.map((t) => `- ${t.fontSize}px: ${t.text.replace(/\n/g, ' / ')}`).join('\n') || '(문구 없음)'}
${image ? '[첨부 이미지] 이 섹션을 그린 화면이다. 디자인(배치·여백·대비·사진)도 함께 본다.' : ''}

평가 기준:
- 휴대폰으로 3초 안에 이 섹션이 무슨 말을 하는지 보이는가
- 제목이 상품 특징이 아니라 손님이 얻는 것(혜택)을 말하는가
- 글자 크기·색 대비·여백이 읽기 편한가, 사진과 문구가 서로 맞는가
- 이 위치의 역할에 맞는가
- 상품 정보에 없는 과장·수치·인증을 말하지 않는가

규칙:
- good: 실제로 잘된 점 1~3개. 화면에 보이는 것을 구체적으로 짚는다(예: "큰 홍게 사진 위 흰 제목이 또렷해요").
- improve: 고치면 좋아질 점 0~3개. 무엇을 어떻게 바꿀지 한 문장. 잘 돼 있으면 비워도 된다.
- fixRequest: 문구로 고칠 수 있는 개선이면 AI 편집 도우미에게 보낼 짧은 명령문(예: "제목을 혜택 중심으로 15자 안으로 바꿔줘"). 사진·배치·색처럼 문구로 못 고치면 넣지 않는다.
- summary: 한 문장 총평. 친근한 존댓말, 이모지 없이.

JSON 형식: {"summary":"...","good":["..."],"improve":[{"point":"...","fixRequest":"..."}]}`,
    image ? [image] : [],
  );

  return {
    summary: clean(raw.summary, LIMITS.point) || '이 섹션을 살펴봤어요.',
    good: (Array.isArray(raw.good) ? raw.good : []).map((g) => clean(g, LIMITS.point)).filter(Boolean).slice(0, LIMITS.items),
    improve: (Array.isArray(raw.improve) ? raw.improve : [])
      .map((tip) => ({ point: clean(tip?.point, LIMITS.point), fixRequest: clean(tip?.fixRequest, LIMITS.fix) || undefined }))
      .filter((tip) => tip.point)
      .slice(0, LIMITS.items),
  };
}
