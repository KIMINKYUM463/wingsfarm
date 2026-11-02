import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../auth.ts";
import { isValidPassword, isValidSession, sessionToken } from "./appAuth.ts";

describe("비밀번호 로그인", () => {
  it("비밀번호가 정확히 같을 때만 통과한다", () => {
    assert.equal(isValidPassword("wingsfarm2026!", "wingsfarm2026!"), true);
    assert.equal(isValidPassword("wingsfarm2026", "wingsfarm2026!"), false);
    assert.equal(isValidPassword("", ""), false);
  });

  it("쿠키에는 비밀번호가 아닌 서명이 들어가고, 비밀번호를 바꾸면 무효가 된다", () => {
    const token = sessionToken("old-pass");
    assert.ok(!token.includes("old-pass"));
    assert.equal(isValidSession(token, "old-pass"), true);
    assert.equal(isValidSession(token, "new-pass"), false);
    assert.equal(isValidSession(undefined, "old-pass"), false);
    assert.equal(isValidSession("garbage", "old-pass"), false);
  });

  it("로그인 뒤에는 이 사이트 안의 주소로만 돌아간다", () => {
    assert.equal(safeNext("/ads?tab=1"), "/ads?tab=1");
    assert.equal(safeNext("//evil.com"), "/");
    assert.equal(safeNext("https://evil.com"), "/");
    assert.equal(safeNext("/login"), "/");
    assert.equal(safeNext(null), "/");
  });
});
