export const formatDateTime = (isoString: string | undefined) => {
  if (isoString === undefined) {
    return '잘못된 날짜 형식입니다';
  }
  const date = new Date(isoString);

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};
export const formatNumber = (price: string | number): string => Number(price).toLocaleString();

/** 날짜 포맷 (YYYY년 M월 D일) */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};
