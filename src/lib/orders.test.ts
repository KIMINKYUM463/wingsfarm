import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Sku, Supplier } from "@/types";
import {
  buildPurchaseSheet,
  buildUploadSheet,
  detectInvoiceMapping,
  detectMapping,
  findHeaderRow,
  groupBySupplier,
  matchInvoices,
  matchSku,
  missingRequired,
  normalizeCourier,
  toOrders,
  type MatchedOrder,
} from "./orders.ts";

const sku = (id: string, productName: string, optionName: string, patch: Partial<Sku> = {}): Sku => ({
  id,
  code: "",
  productName,
  optionName,
  category: "과일",
  supplierId: "farm",
  supplyPrice: 20000,
  extraShippingCost: 0,
  packagingCost: 0,
  taxFree: true,
  fresh: true,
  listings: {},
  aliases: [],
  priceHistory: [],
  ...patch,
});

const supplier = (id: string, name: string): Supplier => ({ id, name, cutoffTime: "14:00", shipWeekdays: [1, 2, 3, 4, 5], freshBlockedWeekdays: [5], template: [] });

const SMARTSTORE_HEADERS = ["상품주문번호", "주문번호", "구매자명", "수취인명", "수취인연락처1", "통합배송지", "상세배송지", "우편번호", "상품명", "옵션정보", "수량", "배송메세지", "최종 상품별 총 주문금액"];

describe("detectMapping", () => {
  it("스마트스토어 머리글을 정확히 맞추고, 통합배송지면 상세배송지를 붙이지 않는다", () => {
    const m = detectMapping(SMARTSTORE_HEADERS);
    assert.equal(m.orderNo, 0);
    assert.equal(m.orderer, 2);
    assert.equal(m.receiver, 3);
    assert.equal(m.phone, 4);
    assert.equal(m.address, 5);
    assert.equal(m.addressDetail, undefined);
    assert.equal(m.zipcode, 7);
    assert.equal(m.productName, 8);
    assert.equal(m.optionName, 9);
    assert.equal(m.qty, 10);
    assert.equal(m.message, 11);
    assert.equal(m.payAmount, 12);
    assert.deepEqual(missingRequired(m), []);
  });

  it("쿠팡식 머리글(수취인이름·수취인전화번호·수취인 주소)도 포함 관계로 찾는다", () => {
    const m = detectMapping(["번호", "주문번호", "등록상품명", "등록옵션명", "구매수(수량)", "수취인이름", "수취인전화번호", "우편번호", "수취인 주소"]);
    assert.equal(m.orderNo, 1);
    assert.equal(m.productName, 2);
    assert.equal(m.optionName, 3);
    assert.equal(m.qty, 4);
    assert.equal(m.receiver, 5);
    assert.equal(m.phone, 6);
    assert.equal(m.address, 8);
  });

  it("엑셀 위쪽 제목 줄을 건너뛰고 머리글 줄을 찾는다", () => {
    assert.equal(findHeaderRow([["주문 목록 (2026-10-30)"], [], SMARTSTORE_HEADERS, ["1"]]), 2);
  });
});

describe("toOrders", () => {
  it("상세주소를 합치고 수량·결제금액을 숫자로", () => {
    const headers = ["주문번호", "받는분", "연락처", "주소", "상세주소", "상품명", "수량", "결제금액"];
    const [o] = toOrders([["A1", "김영희", "010-1234-5678", "서울 강남구 테헤란로 1", "101동", "청송 사과", "2개", "39,800"]], detectMapping(headers));
    assert.equal(o.address, "서울 강남구 테헤란로 1 101동");
    assert.equal(o.qty, 2);
    assert.equal(o.payAmount, 39800);
  });
});

describe("matchSku", () => {
  const skus = [sku("a5", "청송 사과", "5kg"), sku("a15", "청송 사과", "15kg"), sku("m2", "성주 참외", "2kg", { code: "CH-2" })];

  it("판매자 상품코드가 가장 먼저", () => {
    assert.equal(matchSku({ productName: "아무 이름", optionName: "", skuCode: "ch-2" }, skus)?.id, "m2");
  });

  it("옵션이 겹치면(5kg ⊂ 15kg) 더 길게 맞는 옵션", () => {
    assert.equal(matchSku({ productName: "[산지직송] 청송 사과", optionName: "15kg", skuCode: "" }, skus)?.id, "a15");
    assert.equal(matchSku({ productName: "청송 사과", optionName: "5kg", skuCode: "" }, skus)?.id, "a5");
  });

  it("기억된 별칭으로 연결, 애매하면 null", () => {
    const withAlias = [...skus, sku("p", "샤인머스캣", "2kg", { aliases: ["망고포도 / 2키로"] })];
    assert.equal(matchSku({ productName: "망고포도", optionName: "2키로", skuCode: "" }, withAlias)?.id, "p");
    assert.equal(matchSku({ productName: "사과", optionName: "", skuCode: "" }, skus), null);
  });
});

describe("발주서", () => {
  const farm = supplier("farm", "청송농장");
  const other = supplier("other", "성주농원");
  const base = { orderNo: "", receiver: "김영희", phone: "010-1111-2222", zipcode: "", address: "서울 1", productName: "사과", optionName: "", skuCode: "", qty: 1, message: "", orderer: "", channel: "", payAmount: 0, raw: [] };
  const orders: MatchedOrder[] = [
    { ...base, key: "r0", orderNo: "1", sku: sku("a5", "청송 사과", "5kg") },
    { ...base, key: "r1", orderNo: "2", qty: 2, sku: sku("a10", "청송 사과", "10kg") },
    { ...base, key: "r2", orderNo: "3", receiver: "박민수", phone: "010-3333-4444", sku: sku("m2", "성주 참외", "2kg", { supplierId: "other" }) },
    { ...base, key: "r3", orderNo: "4", sku: null },
  ];

  it("공급처별로 나누고 연결 안 된 주문을 따로 모은다", () => {
    const { batches, unmatched } = groupBySupplier(orders, [farm, other]);
    assert.deepEqual(
      batches.map((b) => [b.supplier.id, b.orders.length]),
      [
        ["farm", 2],
        ["other", 1],
      ],
    );
    assert.deepEqual(
      unmatched.map((o) => o.orderNo),
      ["4"],
    );
  });

  it("양식대로 열을 만들고, 같은 받는 분은 같은 묶음번호·내 상품 기준 이름·공급가 합계", () => {
    const sheet = buildPurchaseSheet(orders.slice(0, 2), [
      { header: "묶음", field: "bundleGroup" },
      { header: "상품", field: "productName" },
      { header: "옵션", field: "optionName" },
      { header: "공급가", field: "supplyPrice" },
      { header: "비고", field: "constant", value: "윙스팜" },
    ]);
    assert.deepEqual(sheet, [
      ["묶음", "상품", "옵션", "공급가", "비고"],
      ["1", "청송 사과", "5kg", "20000", "윙스팜"],
      ["1", "청송 사과", "10kg", "40000", "윙스팜"],
    ]);
  });

  it("양식이 비어 있으면 기본 양식", () => {
    assert.equal(buildPurchaseSheet(orders.slice(0, 1), [])[0][0], "주문번호");
  });
});

describe("송장 회신", () => {
  const base = { zipcode: "", address: "", productName: "사과", optionName: "", skuCode: "", qty: 1, message: "", orderer: "", channel: "", payAmount: 0 };
  const orders = [
    { ...base, key: "r0", orderNo: "1001", receiver: "김영희", phone: "010-1111-2222", raw: ["1001", "김영희"] },
    { ...base, key: "r1", orderNo: "1002", receiver: "박민수", phone: "010-3333-4444", raw: ["1002", "박민수"] },
    { ...base, key: "r2", orderNo: "1003", receiver: "이수진", phone: "010-5555-6666", raw: ["1003", "이수진"] },
    { ...base, key: "r3", orderNo: "1004", receiver: "최하나", phone: "010-7777-8888", raw: ["1004", "최하나"] },
  ];
  const headers = ["주문번호", "수취인", "택배사", "운송장번호", "연락처"];
  const mapping = detectInvoiceMapping(headers);

  it("주문번호·이름+연락처 뒷자리로 맞추고, 이름 다름·중복 회신·회신 없음을 걸러 낸다", () => {
    const { results, orphans } = matchInvoices(
      orders,
      [
        ["1001", "김영희", "대한통운", "6000-1111-2222", ""],
        ["", "박민수", "롯데", "2222", "01033334444"],
        ["1003", "이수지", "한진", "3333", ""],
        ["1001", "김영희", "CJ대한통운", "6000-1111-9999", ""],
        ["9999", "모르는분", "한진", "4444", ""],
      ],
      mapping,
    );
    const byNo = Object.fromEntries(results.map((r) => [r.order.orderNo, r]));
    assert.equal(byNo["1001"].status, "check");
    assert.equal(byNo["1001"].invoice, "6000-1111-9999");
    assert.equal(byNo["1001"].courier, "CJ대한통운");
    assert.equal(byNo["1002"].status, "ok");
    assert.equal(byNo["1002"].courier, "롯데택배");
    assert.equal(byNo["1003"].status, "check");
    assert.match(byNo["1003"].reason, /받는 분이 다름/);
    assert.equal(byNo["1004"].status, "missing");
    assert.equal(orphans.length, 1);

    const upload = buildUploadSheet(results, "smartstore", []);
    assert.deepEqual(upload, [
      ["상품주문번호", "배송방법", "택배사", "송장번호"],
      ["1002", "택배,등기,소포", "롯데택배", "2222"],
    ]);
    const original = buildUploadSheet(results, "original", ["주문번호", "이름"]);
    assert.deepEqual(original[1], ["1002", "박민수", "롯데택배", "2222"]);
  });

  it("택배사 이름을 마켓 표기로", () => {
    assert.equal(normalizeCourier("CJ"), "CJ대한통운");
    assert.equal(normalizeCourier("우체국"), "우체국택배");
    assert.equal(normalizeCourier("새로운택배"), "새로운택배");
  });
});
