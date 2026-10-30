"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer } from "react";
import { AI_TEAM, botOf, bubbleOf, initialTeam, positionOf, stepTeam, type Bot, type BotId, type BotState, type TeamState } from "@/lib/aiTeam";

const TICK_MS = 1400;
const ROLLS_PER_TICK = AI_TEAM.length * 3;
const FEED_SIZE = 7;
const ROBOT_SIZE = 52;
/** 장면 가장자리 근처에선 말풍선이 잘리지 않게 안쪽으로 편다. */
const EDGE = 30;

const bubbleAlign = (x: number) => (x > 100 - EDGE ? "right-0" : x < EDGE ? "left-0" : "left-1/2 -translate-x-1/2");

type FeedItem = { id: number; botId: BotId; text: string; time: string };
type World = { team: TeamState; feed: FeedItem[]; seq: number };
type Tick = { rolls: number[]; time: string };

function tick(world: World, { rolls, time }: Tick): World {
  let i = 0;
  const { state, events } = stepTeam(world.team, () => rolls[i++ % rolls.length]);
  const items = events.map((e, k) => ({ id: world.seq + k, ...e, time })).reverse();
  return { team: state, feed: [...items, ...world.feed].slice(0, FEED_SIZE), seq: world.seq + events.length };
}

const initialWorld = (): World => ({ team: initialTeam(), feed: [], seq: 0 });

export function AiTeam() {
  const [world, dispatch] = useReducer(tick, undefined, initialWorld);
  const { bots, done } = world.team;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      dispatch({ rolls: Array.from({ length: ROLLS_PER_TICK }, Math.random), time: new Date().toTimeString().slice(0, 5) });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-6 text-white shadow-2xl md:p-8">
      <div className="pointer-events-none absolute -left-24 top-10 size-80 animate-float rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-80 animate-float rounded-full bg-sky-400/10 blur-3xl [animation-delay:-5s]" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-sky-300/80">
            Wingsfarm AI Team
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">윙스팜AI 팀이 일하는 중</h2>
          <p className="mt-1 text-sm text-white/50">로봇마다 맡은 도구가 있어요. 누르면 그 도구로 바로 가요.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right backdrop-blur">
          <p className="text-xs text-white/40">끝낸 일</p>
          <p className="text-2xl font-black tabular-nums text-emerald-300">{done}</p>
        </div>
      </div>

      <div className="relative mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="overflow-x-auto rounded-2xl">
          <Office bots={bots} />
        </div>
        <Feed items={world.feed} />
      </div>
      <p className="relative mt-3 text-xs text-white/30">각 AI가 하는 일을 보여 주는 연출 화면이에요. 실제 작업은 각 도구에서 실행돼요.</p>
    </section>
  );
}

function Office({ bots }: { bots: BotState[] }) {
  return (
    <div className="relative h-100 min-w-160 overflow-hidden rounded-2xl border border-white/10 bg-white/2 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-size-[40px_40px]">
      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {bots
          .filter((s) => s.to && s.phase !== "back")
          .map((s) => {
            const from = botOf(s.id).desk;
            const to = botOf(s.to!).desk;
            return (
              <line
                key={s.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={botOf(s.id).color}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                vectorEffect="non-scaling-stroke"
                className="animate-dash"
              />
            );
          })}
      </svg>

      {AI_TEAM.map((bot) => (
        <Desk key={bot.id} bot={bot} state={bots.find((s) => s.id === bot.id)!} />
      ))}
      {bots.map((s, i) => (
        <Robot key={s.id} index={i} state={s} bots={bots} />
      ))}
    </div>
  );
}

function Desk({ bot, state }: { bot: Bot; state: BotState }) {
  const away = state.phase !== "work";
  return (
    <div
      className="absolute w-32 -translate-x-1/2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 backdrop-blur"
      style={{ left: `${bot.desk.x}%`, top: `calc(${bot.desk.y}% + ${ROBOT_SIZE / 2 + 8}px)` }}
    >
      <p className="truncate text-xs font-semibold" style={{ color: bot.color }}>
        {bot.name}
      </p>
      <p className="truncate text-[11px] text-white/40">{away ? "자리 비움" : bot.role}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${away ? 0 : state.progress}%`, backgroundColor: bot.color }} />
      </div>
    </div>
  );
}

function Robot({ index, state, bots }: { index: number; state: BotState; bots: BotState[] }) {
  const bot = botOf(state.id);
  const pos = positionOf(state);
  const bubble = bubbleOf(state, bots);
  const replying = state.phase === "work" && bots.some((o) => o.to === state.id && o.phase === "meet");
  const walking = state.phase === "go" || state.phase === "back";

  return (
    <Link
      href={bot.href}
      aria-label={`${bot.name} — ${bot.role} 도구 열기`}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-2600 ease-in-out"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <span
        key={bubble}
        className={`pointer-events-none absolute z-20 w-max max-w-44 animate-pop-in ${bubbleAlign(pos.x)} rounded-xl px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug shadow-lg ${
          replying ? "top-full mt-1.5 bg-emerald-300 text-[#07140f]" : "bottom-full mb-2 bg-white text-stone-800"
        }`}
      >
        {bubble}
      </span>
      <span className={`block ${walking ? "animate-bounce" : "animate-bob"}`} style={{ animationDelay: `${-index * 0.45}s` }}>
        <Image
          src={bot.image}
          alt=""
          width={ROBOT_SIZE}
          height={ROBOT_SIZE}
          draggable={false}
          className="rounded-full ring-2 ring-white/70 transition group-hover:scale-110"
          style={{ boxShadow: `0 0 22px ${bot.color}99` }}
        />
      </span>
    </Link>
  );
}

function Feed({ items }: { items: FeedItem[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-white/40">실시간 업무 기록</p>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-white/30">팀이 출근하는 중…</p>
      ) : (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
          {items.map((item) => {
            const bot = botOf(item.botId);
            return (
              <li key={item.id} className="flex animate-fade-in gap-2.5">
                <Image src={bot.image} alt="" width={24} height={24} className="mt-0.5 size-6 shrink-0 rounded-full" />
                <div className="min-w-0 text-xs leading-relaxed">
                  <p>
                    <span className="font-semibold" style={{ color: bot.color }}>
                      {bot.name}
                    </span>
                    <span className="ml-1.5 text-white/30">{item.time}</span>
                  </p>
                  <p className="text-white/70">{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
