"use client";

import { useState } from "react";
import { Button, Notice, TextArea } from "@/components/ui";
import { errorMessage, postJson } from "@/lib/http";
import { MAX_ORDER_TEXT, type ParsedOrders } from "@/lib/orderAi";
import { toDateKey } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import type { LoadedTable } from "./TableLoader";

/** 정리된 주문을 마켓 주문표와 같은 머리글로 바꿔, 이후 단계(열 맞춤·발주서)를 그대로 쓴다 */
const HEADERS = ["주문번호", "수취인명", "수취인연락처1", "우편번호", "통합배송지", "상품명", "옵션정보", "수량", "배송메세지", "구매자명"];

function toTable(parsed: ParsedOrders): LoadedTable {
  const prefix = `문자${toDateKey(new Date()).replaceAll("-", "").slice(2)}`;
  const rows = parsed.orders.map((o, i) => [
    `${prefix}-${String(i + 1).padStart(2, "0")}`,
    o.receiver,
    o.phone,
    o.zipcode,
    o.address,
    o.productName,
    o.optionName,
    String(o.qty || 1),
    o.message,
    o.orderer,
  ]);
  return { name: "문자 주문 (AI 정리)", rows: [HEADERS, ...rows] };
}

export function AiOrderParser({ onLoad }: { onLoad: (table: LoadedTable, warnings: string[]) => void }) {
  const skus = useAppStore((s) => s.skus);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setPending(true);
    setError("");
    try {
      const products = skus.map((s) => `${s.productName} / ${s.optionName}`);
      const parsed = await postJson<ParsedOrders>("/api/orders/parse", { text, products });
      if (parsed.orders.length === 0) throw new Error("글에서 주문을 찾지 못했어요. 받는 분·주소·상품이 들어 있는지 확인해 주세요.");
      onLoad(toTable(parsed), parsed.warnings);
      setText("");
    } catch (err) {
      setError(errorMessage(err, "주문 정리에 실패했어요."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <TextArea
        rows={7}
        value={text}
        maxLength={MAX_ORDER_TEXT}
        onChange={(e) => setText(e.target.value)}
        placeholder={"카톡·문자로 받은 주문을 그대로 붙여넣으세요.\n예) 사과 5키로 2박스요~ 김영희 010-1234-5678 서울 강남구 테헤란로 1 101동 202호 / 경비실에 맡겨주세요"}
      />
      <Notice tone="warn">
        받는 분 이름·연락처·주소가 OpenAI로 전송돼 정리됩니다(API 데이터는 학습에 쓰이지 않지만 오남용 점검용으로 최대 30일 보관될 수 있어요). 고객에게 개인정보 처리 위탁을 안내했는지 확인하세요. 결과는 반드시 눈으로 확인 후 발주하세요.
      </Notice>
      <Button onClick={run} disabled={pending || text.trim().length < 5}>
        {pending ? "정리 중…" : "AI로 주문 정리"}
      </Button>
      {error && <Notice tone="loss">{error}</Notice>}
    </div>
  );
}
