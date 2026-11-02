import { cookies } from "next/headers";
import { AUTH_COOKIE, AUTH_MAX_AGE, appPassword, isValidPassword, sessionToken } from "@/lib/server/appAuth";

/** 틀렸을 때 바로 답하지 않아 비밀번호를 빠르게 대입해 보는 것을 늦춘다 */
const FAIL_DELAY_MS = 800;

/** POST /api/login { password } → 맞으면 로그인 쿠키 설정 */
export async function POST(req: Request) {
  const password = appPassword();
  if (!password) return Response.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const input = typeof body.password === "string" ? body.password.trim() : "";
  if (!isValidPassword(input, password)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return Response.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  }

  (await cookies()).set(AUTH_COOKIE, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return Response.json({ ok: true });
}
