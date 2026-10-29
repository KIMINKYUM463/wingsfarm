/** API 오류를 화면에 보여줄 한 줄 메시지로 */
export const errorMessage = (err: unknown) => (err instanceof Error && err.message) || '요청을 처리하지 못했어요.';
