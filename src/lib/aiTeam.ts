export type BotId = "manager" | "trend" | "detail" | "cs" | "ads" | "orders";

export type Bot = {
  id: BotId;
  name: string;
  role: string;
  href: string;
  image: string;
  color: string;
  /** 책상 위치(장면 기준 %) */
  desk: { x: number; y: number };
  tasks: { doing: string; done: string }[];
  handoffs: { to: BotId; say: string }[];
};

export const AI_TEAM: Bot[] = [
  {
    id: "trend",
    name: "트렌드 AI",
    role: "검색 흐름·제철",
    href: "/keywords",
    image: "/robots/trend.webp",
    color: "#f472b6",
    desk: { x: 14, y: 32 },
    tasks: [
      { doing: "네이버 검색 흐름 읽는 중", done: "검색 흐름 분석 완료" },
      { doing: "급상승 품목 찾는 중", done: "급상승 품목 정리 완료" },
      { doing: "제철 캘린더 맞춰 보는 중", done: "제철 일정 확인 완료" },
    ],
    handoffs: [
      { to: "detail", say: "검색 급상승 품목이에요. 상세페이지 준비해 주세요!" },
      { to: "ads", say: "요즘 뜨는 키워드 전달해요" },
    ],
  },
  {
    id: "detail",
    name: "상세페이지 AI",
    role: "문구·디자인",
    href: "/detail-page",
    image: "/robots/detail.webp",
    color: "#a78bfa",
    desk: { x: 50, y: 26 },
    tasks: [
      { doing: "상세페이지 문구 다듬는 중", done: "상세페이지 문구 정리 완료" },
      { doing: "섹션 이미지 배치하는 중", done: "섹션 이미지 배치 완료" },
      { doing: "모바일 글자 크기 점검 중", done: "모바일 글자 크기 점검 완료" },
    ],
    handoffs: [
      { to: "cs", say: "새 상세페이지 나왔어요. 자주 묻는 질문 확인 부탁해요" },
      { to: "ads", say: "상세페이지 완성! 광고 시작해도 돼요" },
    ],
  },
  {
    id: "cs",
    name: "CS AI",
    role: "문의·리뷰",
    href: "/cs",
    image: "/robots/cs.webp",
    color: "#38bdf8",
    desk: { x: 86, y: 32 },
    tasks: [
      { doing: "문의 답변 초안 쓰는 중", done: "문의 답변 초안 작성 완료" },
      { doing: "리뷰 불만 키워드 모으는 중", done: "리뷰 불만 키워드 정리 완료" },
      { doing: "교환·반품 안내 정리 중", done: "교환·반품 안내문 완성" },
    ],
    handoffs: [
      { to: "detail", say: "고객이 크기를 자주 물어요. 상세에 넣어 주세요" },
      { to: "orders", say: "배송 문의가 늘었어요. 송장 확인 부탁해요" },
    ],
  },
  {
    id: "manager",
    name: "윙스 매니저",
    role: "팀 총괄",
    href: "/ops",
    image: "/assistant-robot.webp",
    color: "#60a5fa",
    desk: { x: 50, y: 54 },
    tasks: [
      { doing: "오늘 할 일 정리하는 중", done: "오늘 할 일 정리 완료" },
      { doing: "팀 진행 상황 확인하는 중", done: "팀 진행 상황 확인 완료" },
    ],
    handoffs: [
      { to: "trend", say: "이번 주 뜨는 품목 뭐예요?" },
      { to: "cs", say: "오늘 문의 많았어요?" },
      { to: "orders", say: "택배 마감 전에 끝낼 수 있죠?" },
    ],
  },
  {
    id: "ads",
    name: "광고 AI",
    role: "ROAS·키워드",
    href: "/ads",
    image: "/robots/ads.webp",
    color: "#fbbf24",
    desk: { x: 22, y: 74 },
    tasks: [
      { doing: "키워드 ROAS 계산하는 중", done: "키워드 ROAS 계산 완료" },
      { doing: "손익분기와 비교하는 중", done: "손익분기 비교 완료" },
      { doing: "제외 키워드 고르는 중", done: "제외 키워드 후보 정리 완료" },
    ],
    handoffs: [
      { to: "trend", say: "이 키워드 전환이 좋아요. 비슷한 것 찾아 주세요" },
      { to: "detail", say: "클릭은 많은데 구매가 적어요. 첫 화면 점검 부탁해요" },
    ],
  },
  {
    id: "orders",
    name: "발주 AI",
    role: "주문·송장",
    href: "/orders",
    image: "/robots/orders.webp",
    color: "#34d399",
    desk: { x: 78, y: 74 },
    tasks: [
      { doing: "주문서를 공급처별로 나누는 중", done: "공급처별 발주서 완성" },
      { doing: "송장 번호 맞추는 중", done: "송장 번호 매칭 완료" },
      { doing: "택배 마감 시간 확인하는 중", done: "택배 마감 시간 확인 완료" },
    ],
    handoffs: [
      { to: "cs", say: "송장 등록 끝! 배송 안내 보내도 돼요" },
      { to: "ads", say: "재고 넉넉해요. 광고 늘려도 돼요" },
    ],
  },
];

const BOT_BY_ID = new Map(AI_TEAM.map((b) => [b.id, b]));
export const botOf = (id: BotId) => BOT_BY_ID.get(id)!;

/** work: 자기 책상에서 일함 → go: 동료에게 걸어감 → meet: 전달 → back: 복귀 */
export type Phase = "work" | "go" | "meet" | "back";

export type BotState = { id: BotId; phase: Phase; progress: number; task: number; to: BotId | null; say: string; wait: number };
export type TeamState = { bots: BotState[]; done: number };
export type TeamEvent = { botId: BotId; text: string };

const WALK_TICKS = 2;
const MEET_TICKS = 2;
const HANDOFF_CHANCE = 0.6;
const VISIT_OFFSET = 10;

export const initialTeam = (): TeamState => ({
  bots: AI_TEAM.map((b, i) => ({ id: b.id, phase: "work", progress: (i * 17) % 60, task: 0, to: null, say: "", wait: 0 })),
  done: 0,
});

/** 동료가 자리에서 일하고 있고, 다른 로봇이 찾아가는 중이 아닐 때만 방문한다. */
const canVisit = (bots: BotState[], target: BotId) => bots.some((s) => s.id === target && s.phase === "work") && !bots.some((s) => s.to === target);

export function stepTeam(state: TeamState, rand: () => number): { state: TeamState; events: TeamEvent[] } {
  const events: TeamEvent[] = [];
  let done = state.done;
  const bots = [...state.bots];

  bots.forEach((s, i) => {
    const bot = botOf(s.id);
    if (s.phase !== "work") {
      if (s.wait > 1) {
        bots[i] = { ...s, wait: s.wait - 1 };
      } else if (s.phase === "go") {
        bots[i] = { ...s, phase: "meet", wait: MEET_TICKS };
        events.push({ botId: s.id, text: `${botOf(s.to!).name}에게 "${s.say}"` });
      } else if (s.phase === "meet") {
        bots[i] = { ...s, phase: "back", wait: WALK_TICKS };
      } else {
        bots[i] = { ...s, phase: "work", to: null, say: "", wait: 0 };
      }
      return;
    }

    const progress = s.progress + 10 + Math.round(rand() * 18);
    if (progress < 100) {
      bots[i] = { ...s, progress };
      return;
    }
    done += 1;
    events.push({ botId: s.id, text: bot.tasks[s.task].done });
    const next = { ...s, progress: 0, task: (s.task + 1) % bot.tasks.length };
    const handoff = bot.handoffs[Math.floor(rand() * bot.handoffs.length)];
    const visit = rand() < HANDOFF_CHANCE && canVisit(bots, handoff.to) && !bots.some((o) => o.to === s.id);
    bots[i] = visit ? { ...next, phase: "go", to: handoff.to, say: handoff.say, wait: WALK_TICKS } : next;
  });

  return { state: { bots, done }, events };
}

/** 로봇이 지금 서 있어야 할 위치(%). 방문 중이면 상대 책상 옆, 아니면 자기 책상. */
export function positionOf(s: BotState) {
  const home = botOf(s.id).desk;
  if (!s.to || s.phase === "back") return home;
  const target = botOf(s.to).desk;
  return { x: target.x + (home.x < target.x ? -VISIT_OFFSET : VISIT_OFFSET), y: target.y };
}

/** 말풍선 문구. 누군가 나를 찾아와 있으면 대답한다. */
export function bubbleOf(s: BotState, bots: BotState[]) {
  const bot = botOf(s.id);
  if (s.phase === "go") return `${botOf(s.to!).name}에게 가는 중`;
  if (s.phase === "meet") return s.say;
  if (s.phase === "back") return "자리로 돌아가요";
  if (bots.some((o) => o.to === s.id && o.phase === "meet")) return "받았어요! 바로 반영할게요";
  return `${bot.tasks[s.task].doing}…`;
}
