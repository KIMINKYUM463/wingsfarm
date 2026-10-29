import { NextResponse, type NextRequest } from "next/server";

/**
 * APP_PASSWORD가 설정된 경우에만 사이트 전체(페이지 + API)에 브라우저 기본 인증을 건다.
 * 인터넷에 배포했을 때 남이 내 OpenAI 키로 AI를 돌리는 것을 막기 위함. 아이디는 아무거나 입력해도 된다.
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const decoded = decodeBasic(request.headers.get("authorization"));
  if (decoded !== null && decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();

  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Wingsfarm AI", charset="UTF-8"' },
  });
}

/** "Basic base64(id:pw)" → "id:pw" (UTF-8이라 한글 비밀번호도 가능) */
function decodeBasic(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
