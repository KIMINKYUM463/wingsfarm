/** 농수산물 위탁셀러용 운영 SOP — 실무팩·위탁 가이드 벤치마크 기반 */
import { toDateKey } from "@/lib/format";

export type OpsCadence = "daily" | "weekly" | "monthly";

export type OpsItem = {
  id: string;
  cadence: OpsCadence;
  title: string;
  hint: string;
  /** 제철 시즌이면 강조 (시즌 준비·종료 관련) */
  seasonSensitive?: boolean;
};

export const OPS_CADENCE_META: Record<OpsCadence, { label: string; blurb: string; minutes: string }> = {
  daily: { label: "매일", blurb: "영업일 아침·저녁 5분", minutes: "약 5분" },
  weekly: { label: "매주", blurb: "주 1회 집중 점검", minutes: "약 30분" },
  monthly: { label: "매월", blurb: "정산·세무·시즌 점검", minutes: "약 2시간" },
};

export const OPS_ITEMS: OpsItem[] = [
  // daily
  { id: "d-orders", cadence: "daily", title: "신규 주문·문의 확인", hint: "스마트스토어·쿠팡·톡톡 미답변 0건" },
  { id: "d-ship", cadence: "daily", title: "당일 출고·송장 업로드", hint: "미출고·송장 누락이 클레임의 1순위" },
  { id: "d-delay", cadence: "daily", title: "출고 지연 선제 안내", hint: "산지 마감·기상 이슈가 있으면 톡톡으로 먼저 알림" },
  { id: "d-cs", cadence: "daily", title: "파손·상함 CS 처리", hint: "증빙 요청 → 보상 정책 적용 → 공급처 공유" },
  { id: "d-margin", cadence: "daily", title: "공급가·시세 변동 확인", hint: "경락가 급변 시 판매가·광고비 재점검", seasonSensitive: true },
  { id: "d-ads", cadence: "daily", title: "광고 소진·ROAS 한눈", hint: "ROAS가 손익분기 아래로 떨어지면 입찰·소재 조정" },
  // weekly
  { id: "w-price", cadence: "weekly", title: "경쟁가·옵션가 리뷰", hint: "kg당 단가 역전·역마진 SKU 없는지" },
  { id: "w-title", cadence: "weekly", title: "상품명·검색태그 점검", hint: "제철 키워드·중량·산지를 앞쪽에" },
  { id: "w-thumb", cadence: "weekly", title: "썸네일·상세 상단 개선", hint: "클릭률 낮은 상품부터 메인컷 교체" },
  { id: "w-content", cadence: "weekly", title: "마케팅 콘텐츠 1건 발행", hint: "숏폼·쓰레드·카드뉴스·블로그 중 하나" },
  { id: "w-season", cadence: "weekly", title: "다가오는 제철 준비", hint: "D-30 이내 품목 상세·썸네일·재고 협의", seasonSensitive: true },
  { id: "w-supplier", cadence: "weekly", title: "공급처 품질·출고 피드백", hint: "클레임 많은 공급처는 물량·포장 협의" },
  { id: "w-review", cadence: "weekly", title: "리뷰·별점 응대", hint: "칭찬 감사 / 클레임은 CS 도우미로 초안" },
  // monthly
  { id: "m-settle", cadence: "monthly", title: "채널 정산·실입금 대사", hint: "수수료·광고비·CS 보상 누락 없는지" },
  { id: "m-tax", cadence: "monthly", title: "면세·과세 매출 구분 점검", hint: "미가공 vs 가공(깐마늘 등) 섞임 주의" },
  { id: "m-sku", cadence: "monthly", title: "SKU·옵션 정리", hint: "안 팔리는 옵션 숨김, 선물세트 시즌 반영", seasonSensitive: true },
  { id: "m-backup", cadence: "monthly", title: "윙스팜AI 데이터 백업", hint: "설정 → JSON 내보내기" },
  { id: "m-fee", cadence: "monthly", title: "수수료·광고비율 업데이트", hint: "채널 정책 변경 시 마진 재계산" },
  { id: "m-roadmap", cadence: "monthly", title: "다음 달 제철 로드맵", hint: "등록 예정 품목·광고 예산·라이브 일정", seasonSensitive: true },
];

export function opsKey(dateKey: string, itemId: string) {
  return `${dateKey}:${itemId}`;
}

export function weekKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // 월요일 시작
  return x.toISOString().slice(0, 10);
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 주기별 완료 상태 저장 키의 앞부분 (일 = 날짜, 주 = 월요일, 월 = 연-월) */
export function periodKeyFor(cadence: OpsCadence, d = new Date()) {
  if (cadence === "daily") return toDateKey(d);
  return cadence === "weekly" ? `w:${weekKey(d)}` : `m:${monthKey(d)}`;
}
