import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { authorization, signedDate } from "./coupangWing.ts";

describe("쿠팡 윙 HMAC 서명", () => {
  const now = new Date(Date.UTC(2026, 9, 31, 3, 5, 9));

  it("서명 시각은 UTC yyMMdd'T'HHmmss'Z'", () => {
    assert.equal(signedDate(now), "261031T030509Z");
  });

  it("시각 + 메서드 + 경로 + 쿼리(물음표 없이)를 SHA256으로 서명한다", () => {
    const path = "/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets";
    const query = "createdAtFrom=2026-10-01%2B09:00&createdAtTo=2026-10-14%2B09:00&status=ACCEPT&maxPerPage=50";
    const header = authorization("GET", path, query, "access", "secret", now);
    const expected = createHmac("sha256", "secret").update(`261031T030509ZGET${path}${query}`).digest("hex");
    assert.equal(header, `CEA algorithm=HmacSHA256, access-key=access, signed-date=261031T030509Z, signature=${expected}`);
  });
});
