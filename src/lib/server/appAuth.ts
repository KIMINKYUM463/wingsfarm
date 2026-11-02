/**
 * APP_PASSWORD 로그인 — 비밀번호를 맞히면 30일짜리 쿠키를 준다.
 * 쿠키에는 비밀번호가 아니라 비밀번호로 서명한 값을 넣으므로, 쿠키가 새어도 비밀번호는 드러나지 않고
 * 비밀번호를 바꾸면 기존 쿠키가 모두 무효가 된다.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "wf-auth";
export const AUTH_MAX_AGE = 30 * 24 * 60 * 60;
const SESSION_LABEL = "wingsfarm-session-v1";

export const appPassword = () => process.env.APP_PASSWORD?.trim() || "";

export const sessionToken = (password: string) => createHmac("sha256", password).update(SESSION_LABEL).digest("hex");

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const isValidPassword = (input: string, password: string) => Boolean(password) && sameText(input, password);

export const isValidSession = (token: string | undefined, password: string) => Boolean(password && token) && sameText(token!, sessionToken(password));
