"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useEffect, useState } from "react";
import { Button, Card, Notice, PageHeader, Tabs, TextInput, Toggle } from "@/components/ui";
import { RegionDetail, RegionRanking } from "@/components/farmMap/FarmPanels";
import type { HeightMetric } from "@/components/farmMap/FarmMap3D";
import { FARM_SOURCES, filterParams, type FarmFilter, type FarmMapResponse, type FarmSource } from "@/lib/farmMap";
import { num } from "@/lib/format";
import { errorMessage } from "@/lib/http";

/** deck.gl은 WebGL(브라우저 전용)이라 서버에서 그리지 않는다 */
const FarmMap3D = dynamic(() => import("@/components/farmMap/FarmMap3D"), {
  ssr: false,
  loading: () => <div className="flex h-[68vh] min-h-[420px] items-center justify-center rounded-2xl bg-slate-950 text-sm text-slate-400">3D 지도 준비 중…</div>,
});

const METRICS = [
  { id: "sites", label: "산지 수" },
  { id: "farms", label: "등록 농가 수" },
] as const;

const POLL_MS = 3000;

function SetupGuide({ sources }: { sources: FarmMapResponse["sources"] }) {
  return (
    <Card title="공공데이터 연결하기 (무료, 키 하나)">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
        <li>
          <a href="https://www.data.go.kr" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            공공데이터포털(data.go.kr)
          </a>{" "}
          회원가입 후 로그인
        </li>
        <li>
          아래 3개 페이지에서 각각 <b>활용신청</b> (모두 자동승인):{" "}
          {sources.map((s, i) => (
            <span key={s.id}>
              {i > 0 && " · "}
              <a href={s.applyUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                {s.label}
              </a>
            </span>
          ))}
        </li>
        <li>마이페이지 → 개발계정 → 아무 API나 눌러 <b>일반 인증키(Decoding)</b> 복사 (세 API 모두 같은 키)</li>
        <li>
          프로젝트 폴더 <code className="rounded bg-stone-100 px-1">.env.local</code>에 한 줄 추가: <code className="rounded bg-stone-100 px-1">DATA_GO_KR_KEY=복사한키</code>
        </li>
        <li>서버를 다시 켜고 이 화면을 열면 전국 데이터를 1~3분 동안 받아요 (그 뒤 7일마다 자동 갱신)</li>
      </ol>
      <p className="mt-3 text-xs text-stone-500">키를 막 발급받았으면 포털에 반영되기까지 1시간쯤 걸릴 수 있어요.</p>
    </Card>
  );
}

export default function FarmMapPage() {
  const [sources, setSources] = useState<FarmSource[]>(FARM_SOURCES.map((s) => s.id));
  const [item, setItem] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [metric, setMetric] = useState<HeightMetric>("sites");
  const [selected, setSelected] = useState("");
  const [focus, setFocus] = useState<{ code: string; at: number } | null>(null);
  const [data, setData] = useState<FarmMapResponse | null>(null);
  const [failed, setFailed] = useState("");
  const [tick, setTick] = useState(0);

  const filter: FarmFilter = { sources, item, query: deferredQuery.trim() };
  const params = filterParams(filter).toString();

  useEffect(() => {
    let alive = true;
    fetch(`/api/farm-map?${params}`)
      .then((res) => res.json() as Promise<FarmMapResponse>)
      .then((body) => {
        if (!alive) return;
        setData(body);
        setFailed("");
      })
      .catch((err) => {
        if (alive) setFailed(errorMessage(err, "산지 데이터를 불러오지 못했어요."));
      });
    return () => {
      alive = false;
    };
  }, [params, tick]);

  const loading = data?.phase === "loading";
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setTick((t) => t + 1), POLL_MS);
    return () => clearInterval(timer);
  }, [loading]);

  const refresh = async () => {
    await fetch("/api/farm-map", { method: "POST" }).catch(() => undefined);
    setTick((t) => t + 1);
  };

  const select = (code: string, fly = false) => {
    setSelected(code);
    if (fly) setFocus({ code, at: Date.now() });
  };

  const toggleSource = (id: FarmSource, on: boolean) => setSources((prev) => (on ? [...prev, id] : prev.filter((s) => s !== id)));
  const sourceErrors = data?.sources.filter((s) => s.error) ?? [];

  return (
    <>
      <PageHeader
        title="전국 산지 지도"
        description="GAP·친환경 인증 생산자와 산지유통센터(APC)를 3D 지도로 보고, 품목별로 어디서 소싱할 수 있는지 찾으세요. 시군구를 누르면 생산자 목록과 공개 연락처가 나와요."
        actions={
          data?.phase === "ready" && (
            <Button variant="secondary" onClick={() => void refresh()}>
              데이터 새로 받기
            </Button>
          )
        }
      />

      {failed && <Notice tone="loss">{failed}</Notice>}
      {data?.phase === "missingKey" && <SetupGuide sources={data.sources} />}
      {loading && (
        <Notice tone="info" className="mb-4">
          전국 산지 데이터를 받는 중이에요{data.progress ? ` — ${data.progress}` : ""}. 처음 한 번만 1~3분 걸려요.
        </Notice>
      )}
      {data?.phase === "error" && (
        <Notice tone="loss" className="mb-4">
          데이터를 받지 못했어요: {data.error}{" "}
          <button type="button" onClick={() => void refresh()} className="underline">
            다시 시도
          </button>
        </Notice>
      )}
      {data?.phase === "ready" &&
        sourceErrors.map((s) => (
          <Notice key={s.id} tone="warn" className="mb-2">
            {s.label}을(를) 받지 못했어요: {s.error}{" "}
            <a href={s.applyUrl} target="_blank" rel="noreferrer" className="underline">
              활용신청 페이지
            </a>
          </Notice>
        ))}

      <div className="mt-4 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {FARM_SOURCES.map((s) => (
          <Toggle key={s.id} checked={sources.includes(s.id)} onChange={(on) => toggleSource(s.id, on)} label={s.label} />
        ))}
        <TextInput className="w-56!" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="생산자·지역·품목 검색" aria-label="산지 검색" />
        <Tabs tabs={METRICS} value={metric} onChange={setMetric} />
        {data?.updatedAt && <span className="text-xs text-stone-400">기준 {data.updatedAt.slice(0, 10)}</span>}
      </div>

      {(data?.items.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="품목">
          {item && !data?.items.some((i) => i.name === item) && <Chip active label={item} onClick={() => setItem("")} />}
          {data?.items.map((i) => (
            <Chip key={i.name} active={item === i.name} label={`${i.name} ${num(i.count)}`} onClick={() => setItem(item === i.name ? "" : i.name)} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <FarmMap3D regions={data?.regions ?? []} points={data?.points ?? []} metric={metric} selected={selected} focus={focus} onSelect={(code) => select(code)} />
          <p className="mt-2 text-xs text-stone-500">
            {data?.phase === "ready"
              ? `조건에 맞는 산지 ${num(data.total)}곳 · ${num(data.regions.length)}개 시군구${data.unlocated ? ` · 위치 미확인 ${num(data.unlocated)}곳` : ""}`
              : "데이터를 연결하면 시군구마다 기둥이 올라와요."}
          </p>
        </div>
        <Card title={selected ? undefined : item ? `'${item}' 산지가 많은 곳` : "산지가 많은 시군구"}>
          {selected ? (
            <RegionDetail code={selected} filter={filter} onClose={() => setSelected("")} />
          ) : data?.phase !== "ready" ? (
            <p className="text-sm text-stone-500">{loading ? "데이터를 받는 중이에요…" : "공공데이터를 연결하면 품목별로 산지가 많은 시군구 순위가 여기에 나와요."}</p>
          ) : (
            <RegionRanking regions={data?.regions ?? []} unlocated={data?.unlocated ?? 0} onSelect={(code) => select(code, true)} />
          )}
        </Card>
      </div>

      <Notice tone="warn" className="mt-6">
        <b>쓰기 전에 꼭 읽어 주세요.</b> 전국의 모든 농가가 아니라 <b>국가 인증(GAP·친환경)을 받은 생산자와 산지유통센터</b>만 나와요. 개인 생산자 이름은 국립농산물품질관리원이 인증 확인용으로
        공개한 정보이고, 개인 전화번호는 원자료에서 가려져 있어 보여 주지 않아요. 연락은 거래 문의에만 쓰고, 동의 없는 광고성 연락은 하지 마세요(정보통신망법 제50조). 단체·농협·APC를 먼저 접촉하는
        것이 가장 빨라요.
      </Notice>
      <p className="mt-2 text-xs text-stone-400">출처: 공공데이터포털 — 국립농산물품질관리원 GAP·친환경 인증정보, 전국농산물산지유통센터 표준데이터 / 경계: 통계청 2018 센서스용 행정구역경계</p>
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs ${active ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"}`}
    >
      {label}
    </button>
  );
}
