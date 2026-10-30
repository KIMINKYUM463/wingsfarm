/**
 * 발주서 도우미 — 마켓 주문 표 → 공급처별 발주서, 공급처 송장 회신 → 마켓 업로드 양식.
 * 마켓 API 없이 파일·붙여넣기만 다룬다 (계정 정보 불필요).
 */
import type { OrderField, Sku, Supplier, TemplateColumn } from "@/types";
import { findHeaderRowBy, matchColumns, normalizeHeader } from "./table.ts";

/** 주문 표에서 읽어 오는 필드 (발주서 양식 필드 + 상세주소) */
export type SourceField = Exclude<OrderField, "bundleGroup" | "supplyPrice" | "constant"> | "addressDetail";

export const SOURCE_FIELDS: { field: SourceField; label: string; required?: boolean; synonyms: string[] }[] = [
  { field: "orderNo", label: "주문번호", required: true, synonyms: ["상품주문번호", "주문번호", "고객주문번호", "orderno", "주문코드"] },
  { field: "receiver", label: "받는 분", required: true, synonyms: ["수취인명", "수취인", "수령인명", "수령인", "수령자", "받는분성명", "받는분", "받는사람", "수하인명"] },
  { field: "phone", label: "연락처", required: true, synonyms: ["수취인연락처1", "수취인연락처", "수령인연락처", "수령인휴대폰", "받는분전화번호", "받는분연락처", "수취인전화번호", "연락처1", "휴대폰번호", "휴대폰", "연락처", "전화번호"] },
  { field: "zipcode", label: "우편번호", synonyms: ["우편번호", "수취인우편번호", "받는분우편번호"] },
  { field: "address", label: "주소", required: true, synonyms: ["통합배송지", "수취인주소", "수령인주소", "받는분주소", "배송지주소", "배송주소", "기본배송지", "배송지", "주소"] },
  { field: "addressDetail", label: "상세주소(따로 있을 때)", synonyms: ["상세배송지", "상세주소", "배송지상세"] },
  { field: "productName", label: "상품명", required: true, synonyms: ["상품명", "노출상품명", "등록상품명", "품목명", "제품명"] },
  { field: "optionName", label: "옵션", synonyms: ["옵션정보", "옵션명", "등록옵션명", "선택옵션", "옵션"] },
  { field: "skuCode", label: "판매자 상품코드", synonyms: ["판매자상품코드", "자체상품코드", "옵션관리코드", "상품코드", "관리코드", "sku"] },
  { field: "qty", label: "수량", required: true, synonyms: ["수량", "주문수량", "구매수량"] },
  { field: "message", label: "배송메시지", synonyms: ["배송메세지", "배송메시지", "배송요청사항", "요청사항"] },
  { field: "orderer", label: "주문자", synonyms: ["구매자명", "주문자명", "주문자", "구매자"] },
  { field: "channel", label: "판매채널", synonyms: ["판매채널", "판매처", "쇼핑몰", "마켓", "채널"] },
  { field: "payAmount", label: "결제금액(장부용)", synonyms: ["최종상품별총주문금액", "상품별총주문금액", "총주문금액", "결제금액", "주문금액", "결제액"] },
];

export type ColumnMapping = Partial<Record<SourceField, number>>;

export interface Order {
  /** 표 안의 행 번호 기반 고유 키 */
  key: string;
  orderNo: string;
  receiver: string;
  phone: string;
  zipcode: string;
  address: string;
  productName: string;
  optionName: string;
  skuCode: string;
  qty: number;
  message: string;
  orderer: string;
  channel: string;
  payAmount: number;
  /** 원본 행 (송장 붙인 원본 양식 내보내기용) */
  raw: string[];
}

/** 머리글로 각 필드의 열을 찾는다 */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = matchColumns(headers, SOURCE_FIELDS);
  // 통합배송지가 있으면 상세배송지를 붙이면 주소가 두 번 들어간다
  if (mapping.address !== undefined && normalizeHeader(headers[mapping.address]) === normalizeHeader("통합배송지")) delete mapping.addressDetail;
  return mapping;
}

/** 앞쪽 몇 줄 중 필드 이름이 가장 많이 들어 있는 줄을 머리글로 본다 (제목 줄이 있는 엑셀 대응) */
export const findHeaderRow = (rows: string[][], scanRows = 5) =>
  findHeaderRowBy(rows, (row) => Object.keys(detectMapping(row)).length, scanRows);

export const missingRequired = (mapping: ColumnMapping) => SOURCE_FIELDS.filter((f) => f.required && mapping[f.field] === undefined);

export function toOrders(rows: string[][], mapping: ColumnMapping, keyPrefix = "r"): Order[] {
  const get = (row: string[], field: SourceField) => {
    const index = mapping[field];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  return rows
    .map((row, i): Order => {
      const qty = Number(get(row, "qty").replace(/[^\d.]/g, ""));
      return {
        key: `${keyPrefix}${i}`,
        orderNo: get(row, "orderNo"),
        receiver: get(row, "receiver"),
        phone: get(row, "phone"),
        zipcode: get(row, "zipcode"),
        address: [get(row, "address"), get(row, "addressDetail")].filter(Boolean).join(" "),
        productName: get(row, "productName"),
        optionName: get(row, "optionName"),
        skuCode: get(row, "skuCode"),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        message: get(row, "message"),
        orderer: get(row, "orderer"),
        channel: get(row, "channel"),
        payAmount: Number(get(row, "payAmount").replace(/[^\d.-]/g, "")) || 0,
        raw: row,
      };
    })
    .filter((o) => o.productName || o.receiver);
}

/** 주문 파일에 찍히는 "상품명 + 옵션" — SKU 별칭으로 기억하는 단위 */
export const orderLabel = (o: Pick<Order, "productName" | "optionName">) => [o.productName, o.optionName].filter(Boolean).join(" / ");

const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 주문 → SKU 매칭 순서: 판매자 상품코드 → 기억된 별칭 → 상품명·옵션 포함 관계(후보가 하나일 때만).
 * 애매하면 null을 돌려 판매자가 직접 고르게 한다.
 */
export function matchSku(order: Pick<Order, "productName" | "optionName" | "skuCode">, skus: Sku[]): Sku | null {
  if (order.skuCode) {
    const byCode = skus.find((s) => s.code && compact(s.code) === compact(order.skuCode));
    if (byCode) return byCode;
  }
  const label = orderLabel(order);
  const byAlias = skus.find((s) => s.aliases.includes(label));
  if (byAlias) return byAlias;

  const haystack = compact(`${order.productName} ${order.optionName}`);
  const candidates = skus.filter((s) => {
    const name = compact(s.productName);
    const option = compact(s.optionName);
    return name !== "" && haystack.includes(name) && (option === "" || haystack.includes(option));
  });
  if (candidates.length === 1) return candidates[0];
  // 옵션까지 맞는 후보가 하나면 그것으로 (예: 5kg·10kg 중 10kg)
  const withOption = candidates.filter((s) => compact(s.optionName) !== "");
  if (withOption.length === 1) return withOption[0];
  // 옵션이 길게 맞는 후보가 유일하게 가장 길면 선택 (예: "5kg"과 "15kg"이 모두 포함될 때 15kg)
  const longest = Math.max(...withOption.map((s) => compact(s.optionName).length));
  const top = withOption.filter((s) => compact(s.optionName).length === longest);
  return top.length === 1 ? top[0] : null;
}

/** 같은 공급처 안에서 받는 분·연락처·주소가 같으면 한 상자로 묶을 수 있다 (합포장 번호) */
export function bundleGroups(orders: Order[]) {
  const groups = new Map<string, number>();
  const result = new Map<string, number>();
  for (const o of orders) {
    const key = `${compact(o.receiver)}|${o.phone.replace(/\D/g, "")}|${compact(o.address)}`;
    if (!groups.has(key)) groups.set(key, groups.size + 1);
    result.set(o.key, groups.get(key)!);
  }
  return result;
}

export const DEFAULT_TEMPLATE: TemplateColumn[] = [
  { header: "주문번호", field: "orderNo" },
  { header: "받는분", field: "receiver" },
  { header: "연락처", field: "phone" },
  { header: "우편번호", field: "zipcode" },
  { header: "주소", field: "address" },
  { header: "상품명", field: "productName" },
  { header: "옵션", field: "optionName" },
  { header: "수량", field: "qty" },
  { header: "배송메시지", field: "message" },
];

export const TEMPLATE_PRESETS: { id: string; label: string; columns: TemplateColumn[] }[] = [
  { id: "basic", label: "기본 (주문번호·받는분·주소·상품·수량)", columns: DEFAULT_TEMPLATE },
  {
    id: "bundle",
    label: "합포장·공급가 포함",
    columns: [
      { header: "묶음번호", field: "bundleGroup" },
      ...DEFAULT_TEMPLATE,
      { header: "상품코드", field: "skuCode" },
      { header: "공급가(합계)", field: "supplyPrice" },
    ],
  },
];

/** 발주서 칸에 고를 수 있는 필드와 이름 */
export const TEMPLATE_FIELD_LABEL: Record<OrderField, string> = {
  orderNo: "주문번호",
  channel: "판매채널",
  orderer: "주문자",
  receiver: "받는 분",
  phone: "연락처",
  zipcode: "우편번호",
  address: "주소",
  productName: "상품명(내 상품 기준)",
  optionName: "옵션(내 상품 기준)",
  skuCode: "상품코드",
  qty: "수량",
  message: "배송메시지",
  bundleGroup: "합포장 묶음번호",
  supplyPrice: "공급가 합계",
  payAmount: "결제금액",
  constant: "고정 문구",
};

export interface MatchedOrder extends Order {
  sku: Sku | null;
}

/** 공급처 양식에 맞춘 발주서 표 (첫 줄 = 머리글) */
export function buildPurchaseSheet(orders: MatchedOrder[], template: TemplateColumn[]): string[][] {
  const columns = template.length ? template : DEFAULT_TEMPLATE;
  const bundles = bundleGroups(orders);
  const value = (o: MatchedOrder, col: TemplateColumn): string => {
    switch (col.field) {
      case "constant":
        return col.value ?? "";
      case "bundleGroup":
        return String(bundles.get(o.key) ?? "");
      case "supplyPrice":
        return o.sku ? String(o.sku.supplyPrice * o.qty) : "";
      case "productName":
        return o.sku?.productName || o.productName;
      case "optionName":
        return o.sku ? o.sku.optionName : o.optionName;
      case "skuCode":
        return o.sku?.code || o.skuCode;
      case "qty":
        return String(o.qty);
      case "payAmount":
        return o.payAmount ? String(o.payAmount) : "";
      default:
        return o[col.field];
    }
  };
  return [columns.map((c) => c.header), ...orders.map((o) => columns.map((c) => value(o, c)))];
}

export interface SupplierBatch {
  supplier: Supplier;
  orders: MatchedOrder[];
}

export function groupBySupplier(orders: MatchedOrder[], suppliers: Supplier[]) {
  const batches: SupplierBatch[] = suppliers
    .map((supplier) => ({ supplier, orders: orders.filter((o) => o.sku?.supplierId === supplier.id) }))
    .filter((b) => b.orders.length > 0);
  const unmatched = orders.filter((o) => !o.sku || !suppliers.some((s) => s.id === o.sku!.supplierId));
  return { batches, unmatched };
}

// ── 송장 회신 ─────────────────────────────────────────────

export const INVOICE_FIELDS = {
  orderNo: SOURCE_FIELDS.find((f) => f.field === "orderNo")!.synonyms,
  invoice: ["운송장번호", "송장번호", "운송장", "송장", "등기번호"],
  courier: ["택배사명", "택배사", "배송사", "택배회사"],
  receiver: SOURCE_FIELDS.find((f) => f.field === "receiver")!.synonyms,
  phone: SOURCE_FIELDS.find((f) => f.field === "phone")!.synonyms,
};

export type InvoiceMapping = Partial<Record<keyof typeof INVOICE_FIELDS, number>>;

const INVOICE_FIELD_LIST = (Object.entries(INVOICE_FIELDS) as [keyof typeof INVOICE_FIELDS, string[]][]).map(([field, synonyms]) => ({ field, synonyms }));

export const detectInvoiceMapping = (headers: string[]): InvoiceMapping => matchColumns(headers, INVOICE_FIELD_LIST);

const COURIERS: [RegExp, string][] = [
  [/cj|대한통운/i, "CJ대한통운"],
  [/롯데/, "롯데택배"],
  [/한진/, "한진택배"],
  [/우체국|우정/, "우체국택배"],
  [/로젠/, "로젠택배"],
  [/경동/, "경동택배"],
  [/대신/, "대신택배"],
  [/일양/, "일양로지스"],
  [/합동/, "합동택배"],
];

export const normalizeCourier = (name: string) => COURIERS.find(([re]) => re.test(name))?.[1] ?? name.trim();

export type InvoiceStatus = "ok" | "check" | "missing";

export interface InvoiceResult {
  order: Order;
  courier: string;
  invoice: string;
  status: InvoiceStatus;
  /** 확인이 필요한 이유 */
  reason: string;
}

const last4 = (phone: string) => phone.replace(/\D/g, "").slice(-4);

/**
 * 공급처 회신을 주문과 맞춘다.
 * - 주문번호로 먼저, 없으면 받는 분 + 연락처 뒷자리로
 * - 같은 주문에 회신이 여러 번 오면 마지막(정정본)을 쓰고 확인 표시
 * - 받는 분 이름이 다르면 마켓에 올리기 전에 확인하도록 멈춘다
 */
export function matchInvoices(orders: Order[], replyRows: string[][], mapping: InvoiceMapping, defaultCourier = ""): { results: InvoiceResult[]; orphans: string[][] } {
  const get = (row: string[], field: keyof InvoiceMapping) => (mapping[field] === undefined ? "" : (row[mapping[field]!] ?? "").trim());
  const found = new Map<string, { courier: string; invoice: string; count: number; receiver: string }>();
  const orphans: string[][] = [];

  for (const row of replyRows) {
    const invoice = get(row, "invoice").replace(/[^\dA-Za-z-]/g, "");
    if (!invoice) continue;
    const orderNo = get(row, "orderNo");
    const receiver = get(row, "receiver");
    const phone = get(row, "phone");
    const order =
      (orderNo && orders.find((o) => o.orderNo === orderNo)) ||
      (receiver && phone ? orders.find((o) => compact(o.receiver) === compact(receiver) && last4(o.phone) === last4(phone)) : undefined);
    if (!order) {
      orphans.push(row);
      continue;
    }
    const prev = found.get(order.key);
    found.set(order.key, { courier: normalizeCourier(get(row, "courier") || defaultCourier), invoice, count: (prev?.count ?? 0) + 1, receiver });
  }

  const results = orders.map((order): InvoiceResult => {
    const hit = found.get(order.key);
    if (!hit) return { order, courier: "", invoice: "", status: "missing", reason: "회신 없음" };
    const reasons: string[] = [];
    if (hit.receiver && compact(hit.receiver) !== compact(order.receiver)) reasons.push(`받는 분이 다름(${hit.receiver})`);
    if (hit.count > 1) reasons.push(`회신 ${hit.count}번 — 마지막 값 사용`);
    if (!hit.courier) reasons.push("택배사 없음");
    return { order, courier: hit.courier, invoice: hit.invoice, status: reasons.length ? "check" : "ok", reason: reasons.join(", ") };
  });
  return { results, orphans };
}

export const UPLOAD_FORMATS = [
  { id: "smartstore", label: "스마트스토어 발송처리 (상품주문번호·배송방법·택배사·송장번호)" },
  { id: "original", label: "원본 주문표 + 택배사·송장번호 열 (쿠팡 등 다른 마켓)" },
] as const;

export type UploadFormat = (typeof UPLOAD_FORMATS)[number]["id"];

/** 송장 확인이 끝난(ok) 주문만 마켓 업로드 양식으로 */
export function buildUploadSheet(results: InvoiceResult[], format: UploadFormat, originalHeaders: string[]): string[][] {
  const ready = results.filter((r) => r.status === "ok");
  if (format === "smartstore") {
    return [["상품주문번호", "배송방법", "택배사", "송장번호"], ...ready.map((r) => [r.order.orderNo, "택배,등기,소포", r.courier, r.invoice])];
  }
  return [[...originalHeaders, "택배사", "송장번호"], ...ready.map((r) => [...originalHeaders.map((_, i) => r.order.raw[i] ?? ""), r.courier, r.invoice])];
}
