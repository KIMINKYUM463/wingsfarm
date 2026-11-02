"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  LANES,
  STAGES,
  farmText,
  findPrice,
  initialLine,
  laneQueue,
  priceText,
  productIcon,
  stageText,
  stepLine,
  type FarmFact,
  type Facts,
  type Lane,
  type LaneState,
  type LineState,
  type Product,
} from "@/lib/aiTeam";
import { FARM_SOURCES, filterParams, type FarmMapResponse } from "@/lib/farmMap";
import type { KamisPrice, KamisResponse } from "@/lib/kamis";

const TICK_MS = 1200;
const FEED_SIZE = 6;
const ROBOT_SIZE = 44;
/** 단계 칸의 가운데 (트랙 기준 %) */
const STAGE_X = STAGES.map((_, i) => ((i + 0.5) / STAGES.length) * 100);
const ALL_SOURCES = FARM_SOURCES.map((s) => s.id);

/** 양 끝 칸에선 말풍선이 잘리지 않게 안쪽으로 편다 */
const bubbleAlign = (stage: number) => (stage === 0 ? "left-0" : stage === STAGES.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2");

type FeedItem = { id: number; lane: number; product: Product; time: string };
type World = { line: LineState; feed: FeedItem[]; seq: number };
type Tick = { queues: Product[][]; time: string };

function tick(world: World, { queues, time }: Tick): World {
  const { state, events } = stepLine(world.line, queues);
  const items = events.map((e, k) => ({ id: world.seq + k, ...e, time })).reverse();
  return { line: state, feed: [...items, ...world.feed].slice(0, FEED_SIZE), seq: world.seq + events.length };
}

const initialWorld = (): World => ({ line: initialLine(), feed: [], seq: 0 });

/** 산지 지도·도매 시세에서 실제 값을 받아 품목명으로 기억한다 */
function useFacts(names: string[]) {
  const [farms, setFarms] = useState<Record<string, FarmFact>>({});
  const [prices, setPrices] = useState<KamisPrice[] | null>(null);
  const requested = useRef(new Set<string>());

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json() as Promise<KamisResponse>)
      .then((body) => setPrices(body.items ?? []))
      .catch(() => setPrices([]));
  }, []);

  const key = names.join(",");
  useEffect(() => {
    for (const name of key ? key.split(",") : []) {
      if (requested.current.has(name)) continue;
      requested.current.add(name);
      fetch(`/api/farm-map?${filterParams({ sources: ALL_SOURCES, item: name, query: "" })}`)
        .then((res) => res.json() as Promise<FarmMapResponse>)
        .then((body): FarmFact => (body.phase === "ready" && body.total > 0 ? { total: body.total, regions: body.regions.length, topRegion: body.regions[0]?.label ?? "" } : null))
        .catch((): FarmFact => null)
        .then((fact) => setFarms((prev) => ({ ...prev, [name]: fact })));
    }
  }, [key]);

  return (name: string): Facts => ({ farm: name in farms ? farms[name] : undefined, price: prices ? findPrice(name, prices) : undefined });
}

/** 윙스팜AI 팀이 잘 팔리는 상품을 계속 찾아 산지·시세를 확인하고 소싱 목록에 담는 연출 */
export function AiTeam({ products, minScore }: { products: Product[]; minScore: number }) {
  const queues = useMemo(() => LANES.map((lane) => laneQueue(lane, products, minScore)), [products, minScore]);
  const [world, dispatch] = useReducer(tick, undefined, initialWorld);
  const factsOf = useFacts([...new Set(queues.flat().map((p) => p.name))]);
  const idle = queues.every((q) => q.length === 0);

  useEffect(() => {
    if (idle || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!document.hidden) dispatch({ queues, time: new Date().toTimeString().slice(0, 5) });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [queues, idle]);

  return (
    <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-6 text-white shadow-2xl md:p-8">
      <div className="pointer-events-none absolute -left-24 top-10 size-80 animate-float rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-80 animate-float rounded-full bg-amber-400/10 blur-3xl [animation-delay:-5s]" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-emerald-300/80">
            Wingsfarm AI Team
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">윙스팜AI 팀이 소싱하는 중</h2>
          <p className="mt-1 text-sm text-white/50">지금 많이 찾는 상품을 골라 산지와 도매 시세를 확인하고 소싱 목록에 담아요.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right backdrop-blur">
          <p className="text-xs text-white/40">소싱한 상품</p>
          <p className="text-2xl font-black tabular-nums text-emerald-300">{world.line.done}</p>
        </div>
      </div>

      <div className="relative mt-6 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="overflow-x-auto rounded-2xl">
          {idle ? (
            <p className="flex h-60 items-center justify-center rounded-2xl border border-white/10 text-sm text-white/40">트렌드 데이터를 불러오면 소싱을 시작해요.</p>
          ) : (
            <Line queues={queues} lanes={world.line.lanes} factsOf={factsOf} />
          )}
        </div>
        <Feed items={world.feed} factsOf={factsOf} />
      </div>
      <p className="relative mt-3 text-xs text-white/30">검색 관심도·산지·도매 시세는 실제 데이터예요. 단계를 누르면 그 도구로 가요.</p>
    </section>
  );
}

function Line({ queues, lanes, factsOf }: { queues: Product[][]; lanes: LaneState[]; factsOf: (name: string) => Facts }) {
  return (
    <div className="min-w-160 rounded-2xl border border-white/10 bg-white/2">
      <div className="grid grid-cols-[9rem_minmax(0,1fr)] border-b border-white/10">
        <div />
        <div className="grid grid-cols-4">
          {STAGES.map((stage, i) => (
            <Link key={stage.id} href={stage.href} className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium text-white/60 transition hover:text-white">
              <span aria-hidden>{stage.icon}</span>
              <span className="text-white/30 tabular-nums">{i + 1}</span>
              {stage.label}
            </Link>
          ))}
        </div>
      </div>
      {LANES.map((lane, i) => (
        <LaneRow key={lane.id} lane={lane} index={i} queue={queues[i]} state={lanes[i]} factsOf={factsOf} />
      ))}
    </div>
  );
}

function LaneRow({ lane, index, queue, state, factsOf }: { lane: Lane; index: number; queue: Product[]; state: LaneState; factsOf: (name: string) => Facts }) {
  const product = queue.length ? queue[state.cursor % queue.length] : null;
  const upcoming = [...new Set([1, 2].map((k) => queue[(state.cursor + k) % queue.length]))].filter((p) => p && p !== product);

  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] border-b border-white/5 last:border-b-0">
      <div className="border-r border-white/5 px-3 py-3">
        <p className="truncate text-xs font-semibold" style={{ color: lane.color }}>
          {lane.name}
        </p>
        <p className="truncate text-[11px] text-white/40">{lane.label}</p>
        {upcoming.length > 0 && <p className="mt-1 truncate text-[11px] text-white/30">다음: {upcoming.map((p) => p.name).join(" · ")}</p>}
      </div>
      <div className="relative h-32 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[25%_100%]">
        <div className="absolute inset-x-[12.5%] top-[62%] h-px bg-linear-to-r from-white/5 via-white/20 to-white/5" />
        {product ? (
          <Robot lane={lane} index={index} stage={state.stage} product={product} text={stageText(state.stage, product, factsOf(product.name))} />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-white/30">지금 이 분야에 뜨는 품목이 없어요</p>
        )}
      </div>
    </div>
  );
}

function Robot({ lane, index, stage, product, text }: { lane: Lane; index: number; stage: number; product: Product; text: string }) {
  const done = stage === STAGES.length - 1;
  return (
    <div className="absolute top-[62%] z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-1000 ease-in-out" style={{ left: `${STAGE_X[stage]}%` }}>
      <span
        key={`${product.name}:${stage}`}
        className={`pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-52 animate-pop-in ${bubbleAlign(stage)} rounded-xl px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug shadow-lg ${
          done ? "bg-emerald-300 text-[#07140f]" : "bg-white text-stone-800"
        }`}
      >
        {text}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="block animate-bob" style={{ animationDelay: `${-index * 0.6}s` }}>
          <Image src={lane.image} alt="" width={ROBOT_SIZE} height={ROBOT_SIZE} draggable={false} className="rounded-full ring-2 ring-white/70" style={{ boxShadow: `0 0 20px ${lane.color}99` }} />
        </span>
        <span
          key={product.name}
          className={`flex animate-pop-in items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold whitespace-nowrap ${done ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-200" : "border-white/15 bg-white/10 text-white"}`}
        >
          <span aria-hidden>{done ? "📦" : productIcon(product)}</span>
          {product.name}
        </span>
      </div>
    </div>
  );
}

function Feed({ items, factsOf }: { items: FeedItem[]; factsOf: (name: string) => Facts }) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-white/40">방금 소싱 목록에 담은 상품</p>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-white/30">첫 상품을 찾는 중…</p>
      ) : (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-1">
          {items.map((item) => {
            const lane = LANES[item.lane];
            const facts = factsOf(item.product.name);
            return (
              <li key={item.id} className="flex animate-fade-in gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm" aria-hidden>
                  {productIcon(item.product)}
                </span>
                <div className="min-w-0 text-xs leading-relaxed">
                  <p>
                    <span className="font-semibold text-white">{item.product.name}</span>
                    <span className="ml-1.5" style={{ color: lane.color }}>
                      {lane.name}
                    </span>
                    <span className="ml-1.5 text-white/30">{item.time}</span>
                  </p>
                  <p className="truncate text-white/60">{farmText(facts.farm)}</p>
                  <p className="truncate text-white/60">{priceText(facts.price)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
