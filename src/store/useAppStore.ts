"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, ChannelId, CostDefaults, Sku, Supplier } from "@/types";
import { DEFAULT_CHANNELS } from "@/lib/data/channels";
import { DEFAULT_COSTS, DEFAULT_CS_POLICY } from "@/lib/data/defaults";
import type { CsTone } from "@/lib/csAi";
import { samePeriod, withFollowup, withReport, type AdFollowup, type AdReportSnapshot } from "@/lib/adFollowup";
import type { ReportPeriod } from "@/lib/adInsights";
import { toDateKey } from "@/lib/format";

const RECENT_KEYWORD_LIMIT = 12;
const STORE_VERSION = 9;

export interface AppData {
  channels: Channel[];
  suppliers: Supplier[];
  skus: Sku[];
  costs: CostDefaults;
  csPolicy: string;
  csTone: CsTone;
  recentKeywords: string[];
  /** 운영 체크리스트·로드맵·콘텐츠 캘린더 완료 상태 — key = `${접두어}:${itemId}` */
  opsChecks: Record<string, boolean>;
  /** 상품명·태그·썸네일·마케팅 화면이 함께 쓰는 "작업 중인 상품" */
  workingProduct: string;
  /** 광고 분석에서 "실행했어요"로 기록한 조치 (최근 것부터) */
  adFollowups: AdFollowup[];
  /** 올린 광고 보고서 요약 (기간 순) */
  adReports: AdReportSnapshot[];
}

interface AppActions {
  updateChannel: (id: ChannelId, patch: Partial<Channel>) => void;
  setCosts: (patch: Partial<CostDefaults>) => void;
  upsertSupplier: (supplier: Supplier) => void;
  removeSupplier: (id: string) => void;
  upsertSku: (sku: Sku) => void;
  removeSku: (id: string) => void;
  setSupplyPrice: (skuId: string, price: number) => void;
  /** price가 null이면 해당 채널 판매 중지 */
  setListing: (skuId: string, channelId: ChannelId, price: number | null) => void;
  setWorkingProduct: (name: string) => void;
  setCsSettings: (patch: Partial<Pick<AppData, "csPolicy" | "csTone">>) => void;
  addRecentKeyword: (keyword: string) => void;
  clearRecentKeywords: () => void;
  toggleOpsCheck: (key: string) => void;
  resetOpsCadence: (periodKey: string, itemIds: string[]) => void;
  addAdFollowup: (followup: AdFollowup) => void;
  removeAdFollowup: (id: string) => void;
  saveAdReport: (snapshot: AdReportSnapshot) => void;
  removeAdReport: (period: ReportPeriod) => void;
  importData: (data: AppData) => void;
  resetAll: () => void;
}

const initialData = (): AppData => ({
  channels: DEFAULT_CHANNELS,
  suppliers: [],
  skus: [],
  costs: DEFAULT_COSTS,
  csPolicy: DEFAULT_CS_POLICY,
  csTone: "warm",
  recentKeywords: [],
  opsChecks: {},
  workingProduct: "",
  adFollowups: [],
  adReports: [],
});

/** v1까지 기본 탑재됐던 샘플 데이터의 ID (사용자가 만든 항목은 UUID라 겹치지 않음) */
const SAMPLE_ID = /^(sku-|sup-)/;
/** 삭제된 기능의 데이터 (orderLogs: v3, sourcing: v7, ledger·claims·holidays: v8) */
const REMOVED_KEYS = ["orderLogs", "sourcing", "ledger", "claims", "holidays"];

const withoutRemovedKeys = (data: AppData) => Object.fromEntries(Object.entries(data).filter(([key]) => !REMOVED_KEYS.includes(key))) as AppData;

/** v8에서 발주·출고 설정(마감시각·출고요일·발주서 양식)과 신선상품 표시가 빠졌다 */
const slimSupplier = ({ id, name, contact }: Supplier): Supplier => (contact ? { id, name, contact } : { id, name });
const slimSku = (sku: Sku): Sku => {
  const { fresh: _fresh, ...rest } = sku as Sku & { fresh?: boolean };
  return rest;
};

function migrateData(data: AppData, version: number): AppData {
  const keep = <T extends { id: string }>(items: T[] = []) => items.filter((item) => !SAMPLE_ID.test(item.id));
  const cleaned = withoutRemovedKeys(data);
  const filled: AppData = {
    ...cleaned,
    opsChecks: cleaned.opsChecks ?? {},
    workingProduct: cleaned.workingProduct ?? "",
    adFollowups: cleaned.adFollowups ?? [],
    adReports: cleaned.adReports ?? [],
  };
  const sampled = version < 2 ? { ...filled, suppliers: keep(filled.suppliers), skus: keep(filled.skus) } : filled;
  return version < 8 ? { ...sampled, suppliers: (sampled.suppliers ?? []).map(slimSupplier), skus: (sampled.skus ?? []).map(slimSku) } : sampled;
}

/** 공급가 변경 시 같은 날 이력은 덮어쓰고, 다른 날이면 추가 */
export function withPrice(sku: Sku, price: number): Sku {
  const today = toDateKey(new Date());
  const history = sku.priceHistory.filter((p) => p.date !== today);
  return { ...sku, supplyPrice: price, priceHistory: [...history, { date: today, price }].slice(-30) };
}

/** id가 같으면 교체, 없으면 추가 */
const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];

export const useAppStore = create<AppData & AppActions>()(
  persist(
    (set) => ({
      ...initialData(),

      updateChannel: (id, patch) => set((s) => ({ channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      setCosts: (patch) => set((s) => ({ costs: { ...s.costs, ...patch } })),

      upsertSupplier: (supplier) => set((s) => ({ suppliers: upsertById(s.suppliers, supplier) })),

      removeSupplier: (id) => set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) })),

      upsertSku: (sku) => set((s) => ({ skus: upsertById(s.skus, sku) })),

      removeSku: (id) => set((s) => ({ skus: s.skus.filter((x) => x.id !== id) })),

      setSupplyPrice: (skuId, price) =>
        set((s) => ({ skus: s.skus.map((x) => (x.id === skuId && x.supplyPrice !== price ? withPrice(x, price) : x)) })),

      setListing: (skuId, channelId, price) =>
        set((s) => ({
          skus: s.skus.map((x) => {
            if (x.id !== skuId) return x;
            const listings = { ...x.listings };
            if (price === null || price <= 0) delete listings[channelId];
            else listings[channelId] = price;
            return { ...x, listings };
          }),
        })),

      setWorkingProduct: (name) => set({ workingProduct: name }),

      setCsSettings: (patch) => set(patch),

      addRecentKeyword: (keyword) =>
        set((s) => ({ recentKeywords: [keyword, ...s.recentKeywords.filter((k) => k !== keyword)].slice(0, RECENT_KEYWORD_LIMIT) })),

      clearRecentKeywords: () => set({ recentKeywords: [] }),

      toggleOpsCheck: (key) =>
        set((s) => {
          const opsChecks = { ...s.opsChecks };
          if (opsChecks[key]) delete opsChecks[key];
          else opsChecks[key] = true;
          return { opsChecks };
        }),

      resetOpsCadence: (periodKey, itemIds) =>
        set((s) => {
          const opsChecks = { ...s.opsChecks };
          for (const id of itemIds) delete opsChecks[`${periodKey}:${id}`];
          return { opsChecks };
        }),

      addAdFollowup: (followup) => set((s) => ({ adFollowups: withFollowup(s.adFollowups, followup) })),

      removeAdFollowup: (id) => set((s) => ({ adFollowups: s.adFollowups.filter((f) => f.id !== id) })),

      saveAdReport: (snapshot) => set((s) => ({ adReports: withReport(s.adReports, snapshot) })),

      removeAdReport: (period) => set((s) => ({ adReports: s.adReports.filter((r) => !samePeriod(r, period)) })),

      importData: (data) => set(migrateData({ ...initialData(), ...data }, STORE_VERSION)),

      resetAll: () => set(initialData()),
    }),
    {
      name: "wingsfarm-office",
      version: STORE_VERSION,
      migrate: (persisted, version) => migrateData(persisted as AppData, version),
    },
  ),
);

export const pickAppData = (s: AppData): AppData => ({
  channels: s.channels,
  suppliers: s.suppliers,
  skus: s.skus,
  costs: s.costs,
  csPolicy: s.csPolicy,
  csTone: s.csTone,
  recentKeywords: s.recentKeywords,
  opsChecks: s.opsChecks ?? {},
  workingProduct: s.workingProduct ?? "",
  adFollowups: s.adFollowups ?? [],
  adReports: s.adReports ?? [],
});
