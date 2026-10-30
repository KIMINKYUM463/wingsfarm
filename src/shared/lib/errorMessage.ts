/** API 오류를 화면에 보여줄 한 줄 메시지로 — 서버가 보낸 구체적인 안내(rawMessage)를 먼저 쓴다 */
export const errorMessage = (err: unknown) => {
  const raw = err instanceof Error && 'rawMessage' in err ? (err as { rawMessage?: unknown }).rawMessage : undefined;
  return (typeof raw === 'string' && raw.trim()) || (err instanceof Error && err.message) || '요청을 처리하지 못했어요.';
};
