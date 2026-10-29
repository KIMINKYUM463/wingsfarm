"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, ChannelId, ClaimRecord, CostDefaults, LedgerEntry, Sku, SourcingCandidate, Supplier } from "@/types";
import { DEFAULT_CHANNELS } from "@/lib/data/channels";
import { DEFAULT_HOLIDAYS } from "@/lib/data/holidays";
import { DEFAULT_COSTS, DEFAULT_CS_POLICY } from "@/lib/data/defaults";
import type { CsTone } from "@/lib/csAi";
import { toDateKey } from "@/lib/format";

const RECENT_KEYWORD_LIMIT = 12;
const STORE_VERSION = 6;

export interface AppData {
  channels: Channel[];
  suppliers: Supplier[];
  skus: Sku[];
  costs: CostDefaults;
  holidays: Record<string, string>;
  csPolicy: string;
  csTone: CsTone;
  recentKeywords: string[];
  /** 운영 체크리스트·로드맵·명절 준비·콘텐츠 캘린더 완료 상태 — key = `${접두어}:${itemId}` */
  opsChecks: Record<string, boolean>;
  /** 상품명·태그·썸네일·마케팅 화면이 함께 쓰는 "작업 중인 상품" */
  workingProduct: string;
  ledger: LedgerEntry[];
  claims: ClaimRecord[];
  sourcing: SourcingCandidate[];
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
  /** 주문 파일의 상품명·옵션 표기를 SKU에 기억시켜 다음부터 자동 매칭 */
  addSkuAlias: (skuId: string, alias: string) => void;
  setWorkingProduct: (name: string) => void;
  setHoliday: (date: string, name: string | null) => void;
  setCsSettings: (patch: Partial<Pick<AppData, "csPolicy" | "csTone">>) => void;
  addRecentKeyword: (keyword: string) => void;
  clearRecentKeywords: () => void;
  toggleOpsCheck: (key: string) => void;
  resetOpsCadence: (periodKey: string, itemIds: string[]) => void;
  addLedgerEntries: (entries: LedgerEntry[]) => void;
  updateLedgerEntry: (entry: LedgerEntry) => void;
  removeLedgerEntry: (id: string) => void;
  upsertClaim: (claim: ClaimRecord) => void;
  removeClaim: (id: string) => void;
  upsertSourcing: (candidate: SourcingCandidate) => void;
  removeSourcing: (id: string) => void;
  importData: (data: AppData) => void;
  resetAll: () => void;
}

const initialData = (): AppData => ({
  channels: DEFAULT_CHANNELS,
  suppliers: [],
  skus: [],
  costs: DEFAULT_COSTS,
  holidays: DEFAULT_HOLIDAYS,
  csPolicy: DEFAULT_CS_POLICY,
  csTone: "warm",
  recentKeywords: [],
  opsChecks: {},
  workingProduct: "",
  ledger: [],
  claims: [],
  sourcing: [],
});

/** v1까지 기본 탑재됐던 샘플 데이터의 ID (사용자가 만든 항목은 UUID라 겹치지 않음) */
const SAMPLE_ID = /^(sku-|sup-)/;
/** v3에서 삭제된 기능의 데이터. claims는 v6에서 새 형식으로 다시 생겨서 v6 미만 데이터만 버린다 */
const REMOVED_KEYS = ["orderLogs"];

const withoutRemovedKeys = (data: AppData) => Object.fromEntries(Object.entries(data).filter(([key]) => !REMOVED_KEYS.includes(key))) as AppData;

function migrateData(data: AppData, version: number): AppData {
  const keep = <T extends { id: string }>(items: T[] = []) => items.filter((item) => !SAMPLE_ID.test(item.id));
  const cleaned = withoutRemovedKeys(data);
  const filled: AppData = {
    ...cleaned,
    opsChecks: cleaned.opsChecks ?? {},
    workingProduct: cleaned.workingProduct ?? "",
    ledger: cleaned.ledger ?? [],
    claims: version < 6 ? [] : (cleaned.claims ?? []),
    sourcing: cleaned.sourcing ?? [],
  };
  return version < 2 ? { ...filled, suppliers: keep(filled.suppliers), skus: keep(filled.skus) } : filled;
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

      addSkuAlias: (skuId, alias) =>
        set((s) => {
          const value = alias.trim();
          if (!value) return {};
          return {
            skus: s.skus.map((x) => {
              // 같은 표기가 다른 SKU에 기억돼 있으면 옮긴다 (한 표기 = 한 SKU)
              const others = x.aliases.filter((a) => a !== value);
              return x.id === skuId ? { ...x, aliases: [...others, value] } : others.length === x.aliases.length ? x : { ...x, aliases: others };
            }),
          };
        }),

      setWorkingProduct: (name) => set({ workingProduct: name }),

      setHoliday: (date, name) =>
        set((s) => {
          const holidays = { ...s.holidays };
          if (name === null) delete holidays[date];
          else holidays[date] = name;
          return { holidays };
        }),

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

      addLedgerEntries: (entries) => set((s) => ({ ledger: [...s.ledger, ...entries] })),

      updateLedgerEntry: (entry) => set((s) => ({ ledger: upsertById(s.ledger, entry) })),

      removeLedgerEntry: (id) => set((s) => ({ ledger: s.ledger.filter((x) => x.id !== id) })),

      upsertClaim: (claim) => set((s) => ({ claims: upsertById(s.claims, claim) })),

      removeClaim: (id) => set((s) => ({ claims: s.claims.filter((x) => x.id !== id) })),

      upsertSourcing: (candidate) => set((s) => ({ sourcing: upsertById(s.sourcing, candidate) })),

      removeSourcing: (id) => set((s) => ({ sourcing: s.sourcing.filter((x) => x.id !== id) })),

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
  holidays: s.holidays,
  csPolicy: s.csPolicy,
  csTone: s.csTone,
  recentKeywords: s.recentKeywords,
  opsChecks: s.opsChecks ?? {},
  workingProduct: s.workingProduct ?? "",
  ledger: s.ledger ?? [],
  claims: s.claims ?? [],
  sourcing: s.sourcing ?? [],
});
