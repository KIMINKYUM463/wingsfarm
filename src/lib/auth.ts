/** 로그인 뒤 돌아갈 주소 — 다른 사이트로 튀는 주소("//evil.com")와 로그인 화면 자신은 막는다 */
export const safeNext = (next: string | null | undefined) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/");
