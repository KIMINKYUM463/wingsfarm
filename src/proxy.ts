import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, appPassword, isValidSession } from "@/lib/server/appAuth";

/** 로그인 화면이 쓰는 주소는 로그인 없이 열린다 */
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/assistant-robot.webp"]);

/**
 * APP_PASSWORD가 설정된 경우에만 사이트 전체(페이지 + API)를 잠근다.
 * 인터넷에 배포했을 때 남이 내 OpenAI·Gemini 키로 AI를 돌리는 것을 막기 위함.
 * 로그인 안 된 페이지 요청은 /login으로 보내고, API 요청은 401을 돌려준다.
 */
export function proxy(request: NextRequest) {
  const password = appPassword();
  const { pathname, search } = request.nextUrl;
  if (!password || PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (isValidSession(request.cookies.get(AUTH_COOKIE)?.value, password)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
