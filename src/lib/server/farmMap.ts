/**
 * 전국 산지 지도 데이터 — 공공데이터포털 3종을 전부 받아 `.data/farm-map/sites.json`에 7일 보관한다.
 * 키: 공공데이터포털 일반 인증키 하나(DATA_GO_KR_KEY)로 세 API를 모두 부른다. API마다 "활용신청"은 따로 눌러야 한다.
 * 한 번 받는 데 1~3분(약 50번 호출) — 처음엔 백그라운드로 받고 화면은 진행률을 보여 준다. 기한이 지나면 옛 데이터를 보여 주면서 다시 받는다.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  describeUnknownShape,
  fromApcRow,
  fromEcoRow,
  fromGapRow,
  isCurrent,
  matchRegion,
  parsePage,
  xmlError,
  type FarmSite,
  type FarmSource,
  type Row,
  type SourceStatus,
} from "@/lib/farmMap";

const DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "farm-map");
const FILE = path.join(DIR, "sites.json");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 80;

interface SourceConfig {
  id: FarmSource;
  label: string;
  url: string;
  /** 활용신청 페이지 */
  applyUrl: string;
  toSite: (row: Row) => Omit<FarmSite, "region"> | null;
}

export const SOURCE_CONFIGS: SourceConfig[] = [
  {
    id: "gap",
    label: "GAP 인증정보",
    url: "https://apis.data.go.kr/1543145/GAPCERTINFO/getCertDataList",
    applyUrl: "https://www.data.go.kr/data/15141807/openapi.do",
    toSite: fromGapRow,
  },
  {
    id: "eco",
    label: "친환경 인증정보",
    url: "https://apis.data.go.kr/1543145/ECFRDCERTINFO/getCertDataList",
    applyUrl: "https://www.data.go.kr/data/15141827/openapi.do",
    toSite: fromEcoRow,
  },
  {
    id: "apc",
    label: "산지유통센터(APC) 표준데이터",
    url: "https://api.data.go.kr/openapi/tn_pubr_public_agric_dist_cent_api",
    applyUrl: "https://www.data.go.kr/data/15114142/standard.do",
    toSite: fromApcRow,
  },
];

interface Snapshot {
  updatedAt: string;
  sources: SourceStatus[];
  sites: FarmSite[];
}

export interface LoadState {
  phase: "missingKey" | "loading" | "ready" | "error";
  /** 받는 중일 때 "GAP 인증정보 3/14쪽" */
  progress: string;
  snapshot: Snapshot | null;
  error: string;
}

/** 포털이 주는 "Encoding" 키를 넣어도 동작하게 한 번 풀어 둔다 */
function serviceKey() {
  const raw = process.env.DATA_GO_KR_KEY?.trim() ?? "";
  if (!/%[0-9A-F]{2}/i.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const farmMapConfigured = () => Boolean(serviceKey());

let memory: Snapshot | null = null;
let loading: Promise<void> | null = null;
let progress = "";
let lastError = "";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(config: SourceConfig, page: number) {
  const url = new URL(config.url);
  url.search = new URLSearchParams({ serviceKey: serviceKey(), pageNo: String(page), numOfRows: String(PAGE_SIZE), type: "json" }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  const text = await res.text();
  const xml = text.trimStart().startsWith("<") ? xmlError(text) : null;
  if (xml) throw new Error(xml);
  if (!res.ok) throw new Error(`응답 오류(${res.status})`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("JSON이 아닌 응답이 왔어요. 잠시 후 다시 받아 보세요.");
  }
  const parsed = parsePage(json);
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}

async function loadSource(config: SourceConfig, today: string): Promise<{ status: SourceStatus; sites: FarmSite[] }> {
  const status: SourceStatus = { id: config.id, label: config.label, applyUrl: config.applyUrl, count: 0, error: "" };
  const sites: FarmSite[] = [];
  try {
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
      progress = `${config.label} ${page}/${pages}쪽`;
      const { rows, total } = await fetchPage(config, page);
      if (total) pages = Math.ceil(total / PAGE_SIZE);
      const parsed = rows.map(config.toSite).filter((s) => s !== null);
      const unknown = describeUnknownShape(rows, parsed.length);
      if (unknown) throw new Error(unknown);
      for (const site of parsed) {
        if (isCurrent(site, today)) sites.push({ ...site, region: matchRegion(site.address) });
      }
      if (rows.length < PAGE_SIZE) break;
      await sleep(250);
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
    console.error(`[farm-map] ${config.id}`, status.error);
  }
  status.count = sites.length;
  return { status, sites };
}

async function readDisk(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

async function reload() {
  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const config of SOURCE_CONFIGS) results.push(await loadSource(config, today));
  progress = "";
  const sites = dedupe(results.flatMap((r) => r.sites));
  const sources = results.map((r) => r.status);
  if (sites.length === 0) {
    lastError = sources.map((s) => `${s.label}: ${s.error || "0건"}`).join(" / ");
    return;
  }
  lastError = "";
  memory = { updatedAt: new Date().toISOString(), sources, sites };
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(memory));
}

/** 같은 인증번호가 여러 쪽에 걸쳐 오는 경우 */
function dedupe(sites: FarmSite[]) {
  const map = new Map<string, FarmSite>();
  for (const site of sites) map.set(site.id, site);
  return [...map.values()];
}

function startReload() {
  loading ??= reload()
    .catch((err) => {
      lastError = err instanceof Error ? err.message : String(err);
    })
    .finally(() => {
      loading = null;
    });
}

/** 지금 가진 데이터와 상태 — 없거나 오래됐으면 백그라운드로 받기 시작한다 */
export async function getFarmMapState(options: { refresh?: boolean } = {}): Promise<LoadState> {
  if (!farmMapConfigured()) return { phase: "missingKey", progress: "", snapshot: null, error: "" };
  memory ??= await readDisk();
  const stale = !memory || Date.now() - Date.parse(memory.updatedAt) > MAX_AGE_MS;
  if (options.refresh) {
    lastError = "";
    startReload();
  } else if (stale && !lastError) {
    startReload();
  }
  if (loading && !memory) return { phase: "loading", progress, snapshot: null, error: "" };
  if (!memory) return { phase: "error", progress: "", snapshot: null, error: lastError || "데이터를 받지 못했어요." };
  return { phase: loading ? "loading" : "ready", progress: loading ? progress : "", snapshot: memory, error: lastError };
}
