const wonFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export const won = (value: number) => `${wonFormatter.format(Math.round(value))}원`;

export const num = (value: number) => wonFormatter.format(Math.round(value));

export const percent = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;

/** 0.234 → "+23%", -0.1 → "-10%" */
export const growthText = (ratio: number) => `${ratio >= 0 ? "+" : ""}${Math.round(ratio * 100)}%`;

/** 로컬 시간 기준 YYYY-MM-DD */
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

export const uid = () => crypto.randomUUID();
