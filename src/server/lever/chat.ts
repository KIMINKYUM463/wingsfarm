import 'server-only';
import type { ChatEditChange, ChatEditRequest, ChatEditResult, ChatTextAlign } from '@/shared/types/chatEdit';
import { describeWarnings, findUnsupportedClaims } from './catalog/factGuard';
import { DETAIL_COPY_RULES } from './copyStyle';
import { contextBrief } from './copywriter';
import { requireGemini } from './gemini';
import { badRequest } from './http';
import { projectEvidence } from './productFacts';
import { getProject } from './projects';

/**
 * 에디터 AI 채팅 수정 — "이 페이지 문구 더 짧게"처럼 말하면 문구를 고쳐 캔버스에 적용한다
 *
 * - 클라이언트가 지금 캔버스의 문구(저장 전 수정 포함)를 보내고, AI는 바꿀 문구만 돌려준다
 * - 바뀐 문구에 입력 자료에 없던 주장(산지직송·인증·순위 등)이 새로 생기면 경고를 붙인다
 * - 질문(다운로드 위치, 비용 등)에는 changes 없이 답만 한다
 */
const LIMITS = { message: 500, frames: 40, textsPerFrame: 60, text: 600, history: 6 };
const ALIGNS: ChatTextAlign[] = ['left', 'center', 'right'];
const FONT_SCALE: [number, number] = [0.6, 1.6];

const EDITOR_FAQ = `[에디터 도움말 — 질문에 답할 때 사용]
- 다운로드: 오른쪽 위 "다운로드" → 판매처(스마트스토어 860·쿠팡 780·토스 1080·자사몰 너비 지정), 형식(JPG·PNG·WEBP·HTML), 품질, 페이지 선택. 무료·무제한
- 색 바꾸기: 왼쪽 "색상" 탭에서 대표 색·톤 11종 선택 (AI 초안으로 만든 페이지)
- 되돌리기: 결과 카드의 "되돌리기", 또는 상단 시계 아이콘 "버전 기록"에서 저장한 시점으로 복원
- 비용: 채팅 문구 수정은 무료 (등록한 Gemini API 키로 처리). AI 사진 생성만 이미지 생성 비용이 든다
- 섹션 추가·순서: 오른쪽 "구성 목록"에서 드래그, 왼쪽 "템플릿" 탭에서 추가`;

const clean = (value: unknown, max: number) => String(value ?? '').slice(0, max);

function sanitizeRequest(body: ChatEditRequest) {
  const message = clean(body?.message, LIMITS.message).trim();
  if (!message) throw badRequest('요청할 내용을 입력해주세요.');
  const frames = (Array.isArray(body.frames) ? body.frames : []).slice(0, LIMITS.frames).map((f) => ({
    frameId: clean(f.frameId, 80),
    name: clean(f.name, 60),
    texts: (Array.isArray(f.texts) ? f.texts : []).slice(0, LIMITS.textsPerFrame).map((t) => ({
      id: clean(t.id, 80),
      text: clean(t.text, LIMITS.text),
      fontSize: Number(t.fontSize) || 16,
      align: ALIGNS.includes(t.align as ChatTextAlign) ? (t.align as ChatTextAlign) : 'left',
    })),
  }));
  const scope = frames.find((f) => f.frameId === body.scopeFrameId);
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-LIMITS.history)
    .map((h) => `${h.role === 'assistant' ? 'AI' : '사용자'}: ${clean(h.text, 300)}`);
  return { message, targets: scope ? [scope] : frames, scoped: Boolean(scope), history };
}

interface RawChange {
  id?: unknown;
  text?: unknown;
  align?: unknown;
  fontScale?: unknown;
}

/** POST /projects/{id}/ai/chat */
export async function chatEdit(projectId: string, body: ChatEditRequest): Promise<ChatEditResult> {
  const project = await getProject(projectId);
  const { message, targets, scoped, history } = sanitizeRequest(body);
  const texts = new Map(targets.flatMap((f) => f.texts.map((t) => [t.id, { ...t, frameId: f.frameId, frameName: f.name }] as const)));

  const gemini = await requireGemini();
  const raw = await gemini.generateJson<{ reply?: unknown; changes?: RawChange[]; followUps?: unknown[] }>(
    `너는 한국 이커머스 상세페이지 에디터의 AI 편집 도우미다. 사용자의 요청대로 캔버스 문구를 고치거나 질문에 답한다.

[상품]
${contextBrief(project, project.context)}

${EDITOR_FAQ}

[편집 대상 — ${scoped ? '현재 페이지만' : '문서 전체'}]
${JSON.stringify(targets.map((f) => ({ page: f.name, texts: f.texts.map(({ id, text, align }) => ({ id, text, align })) })))}
${history.length ? `\n[이전 대화]\n${history.join('\n')}\n` : ''}
[사용자 요청] ${message}

규칙:
- 문구를 고칠 땐 바꿀 텍스트만 changes에 넣는다. id는 편집 대상에 있는 값만 쓴다.
- text: 새 문구 (줄바꿈은 \\n). 길이를 늘리라는 요청이 아니면 원래 줄 수 이하로 쓴다.
- align: "left"|"center"|"right" (정렬을 바꾸라는 요청일 때만), fontScale: 글자 크기 배율 0.6~1.6 (크기 요청일 때만).
- 상품 정보에 없는 수치·인증·순위·산지직송·효능 표현을 새로 만들지 않는다.
- 질문이거나 문구로 할 수 없는 요청(사진 편집 등)이면 changes는 비우고 reply로 방법을 안내한다.
- reply: 한 문장 요약 (예: "히어로 문구 5개를 더 짧게 다듬었어요").
- followUps: 이어서 해볼 만한 요청 2개 (짧은 명령문).

${DETAIL_COPY_RULES}

JSON 형식: {"reply":"...","changes":[{"id":"...","text":"...","align":"center","fontScale":1.2}],"followUps":["...","..."]}`,
    [],
    'copy',
  );

  const evidence = await projectEvidence(project);
  const changes: ChatEditChange[] = [];
  const warnings: string[] = [];
  for (const change of Array.isArray(raw.changes) ? raw.changes : []) {
    const current = texts.get(String(change.id));
    if (!current || changes.some((c) => c.elementId === current.id)) continue;
    const text = typeof change.text === 'string' && change.text.trim() ? change.text.slice(0, LIMITS.text) : undefined;
    const align = ALIGNS.includes(change.align as ChatTextAlign) ? (change.align as ChatTextAlign) : undefined;
    const scale = Number(change.fontScale);
    const fontSize =
      Number.isFinite(scale) && scale !== 1
        ? Math.round(current.fontSize * Math.min(FONT_SCALE[1], Math.max(FONT_SCALE[0], scale)))
        : undefined;
    const after = {
      ...(text !== undefined && text !== current.text && { text }),
      ...(align && align !== current.align && { align }),
      ...(fontSize && fontSize !== current.fontSize && { fontSize }),
    };
    if (!Object.keys(after).length) continue;
    changes.push({
      frameId: current.frameId,
      frameName: current.frameName,
      elementId: current.id,
      before: { text: current.text, align: current.align, fontSize: current.fontSize },
      after,
    });
    if (after.text) {
      const before = new Set(findUnsupportedClaims(current.text, evidence).map((w) => w.label));
      warnings.push(...describeWarnings(findUnsupportedClaims(after.text, evidence).filter((w) => !before.has(w.label))));
    }
  }

  return {
    reply: clean(raw.reply, 300).trim() || (changes.length ? `문구 ${changes.length}개를 고쳤어요.` : '바꿀 문구를 찾지 못했어요.'),
    changes,
    followUps: (Array.isArray(raw.followUps) ? raw.followUps : []).map((f) => clean(f, 40).trim()).filter(Boolean).slice(0, 2),
    warnings: [...new Set(warnings)],
  };
}
