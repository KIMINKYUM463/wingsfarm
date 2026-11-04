/* 모션그래픽 숏폼 (고르는 법·정보형 공용).
 * 파이썬(make_motion.py)이 목소리·단어 타이밍·장면 그림을 준비해 props 로 넘기면
 * 여기서 글자 튀어나오기, 형광펜 강조, TIP 배지, 체크 표시, 진행 점, 가격표 카운트를 그린다. */
import {
  AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from "remotion";

const HL = { yellow: "#FFE14D", green: "#5AE65A", red: "#FF5046" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

export const Main = (p) => {
  let from = 0;
  const tips = p.scenes.filter((s) => s.kind === "TIP").length;
  const hasPriceScene = p.scenes.some((s) => s.kind === "PRICE");
  let tipNo = 0;
  return (
    <AbsoluteFill style={{ background: "#0d0d0d", fontFamily: "Pretendard", color: "white" }}>
      {p.scenes.map((s, i) => {
        if (s.kind === "TIP") tipNo += 1;
        const el = (
          <Sequence key={i} from={from} durationInFrames={s.frames}>
            <Scene s={s} p={p} i={i} tipNo={tipNo} tips={tips} last={i === p.scenes.length - 1} hasPriceScene={hasPriceScene} />
          </Sequence>
        );
        from += s.frames;
        return el;
      })}
      <Header p={p} />
      <InfoBar text={p.info} color={HL[p.highlight] || HL.yellow} />
      {p.aiLabel ? <AiLabel /> : null}
      {p.bgm ? <Audio src={staticFile(p.bgm)} volume={(f) => bgmVolume(f, from, p.bgmVolume ?? 0.12)} /> : null}
    </AbsoluteFill>
  );
};

function bgmVolume(f, total, v) {
  return v * interpolate(f, [0, 15, total - 45, total], [0, 1, 1, 0], clamp);
}

/* ---------- 장면 ---------- */

const Scene = ({ s, p, i, tipNo, tips, last, hasPriceScene }) => {
  const { fps } = useVideoConfig();
  const color = HL[p.highlight] || HL.yellow;
  const lead = Math.round((s.lead ?? 0.2) * fps);
  const side = p.vs && s.kind === "TIP" ? (tipNo === 1 ? "A" : "B") : null;
  const cap = s.textOnly ? <AllText s={s} color={color} lead={lead} /> : <Caption s={s} color={color} lead={lead} />;
  const showPrice = p.price && (s.kind === "PRICE" || (s.kind === "CTA" && last && !hasPriceScene));
  return (
    <AbsoluteFill>
      <Background s={s} i={i} />
      <AbsoluteFill style={{
        background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 48%, rgba(0,0,0,.78) 82%, rgba(0,0,0,.9) 100%)",
      }} />
      {s.kind === "HOOK" ? (s.textOnly ? <AllText s={s} color={color} lead={lead} y={760} size={110} /> : <HookText s={s} color={color} lead={lead} />) : null}
      {s.kind === "TIP" ? (
        <>
          {s.mark ? <Stamp mark={s.mark} /> : <Spotlight color={side === "B" ? "#5AB4FF" : color} />}
          {side ? <SideBadge text={s.label || side} side={side} color={color} /> : s.label ? <TipBadge text={s.label} color={color} /> : null}
          {side === "B" ? <VsFlash /> : null}
          {!side && tips >= 2 ? <Progress n={tipNo} total={tips} color={color} /> : null}
          {cap}
          {!side && !s.mark ? <Check at={Math.round(s.frames * 0.62)} color={color} /> : null}
        </>
      ) : null}
      {s.kind === "REVEAL" ? (<>{s.counter ? <Counter to={s.counter} unit={s.unit} color={color} /> : null}{cap}</>) : null}
      {s.kind === "PRICE" || s.kind === "CTA" ? (
        <>
          {cap}
          {showPrice ? <PriceTag price={p.price} color={color} /> : s.kind === "CTA" && last ? <SaveIcon color={color} /> : null}
        </>
      ) : null}
      {s.audio ? <Sequence from={lead}><Audio src={staticFile(s.audio)} /></Sequence> : null}
      {i > 0 ? <Wipe color={color} /> : null}
    </AbsoluteFill>
  );
};

/* 사진은 장면마다 다른 방향으로 천천히 밀고 당긴다 (같은 사진 한 장이어도 지루하지 않게) */
const MOVES = [
  { s: [1.08, 1.22], x: [0, -40], y: [0, -30] },
  { s: [1.25, 1.1], x: [-50, 30], y: [20, 0] },
  { s: [1.1, 1.28], x: [40, -20], y: [-20, 30] },
  { s: [1.3, 1.12], x: [0, 0], y: [40, -40] },
];

const Background = ({ s, i }) => {
  const frame = useCurrentFrame();
  const m = MOVES[i % MOVES.length];
  const t = interpolate(frame, [0, s.frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const style = {
    width: "100%", height: "100%", objectFit: "cover",
    transform: `scale(${m.s[0] + (m.s[1] - m.s[0]) * t}) translate(${m.x[0] + (m.x[1] - m.x[0]) * t}px, ${m.y[0] + (m.y[1] - m.y[0]) * t}px)`,
  };
  if (!s.bg) return null;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {s.bgType === "video"
        ? (s.bgFrames && s.bgFrames < s.frames  // AI 장면 영상(5초)이 말보다 짧으면 되풀이한다
          ? <Loop durationInFrames={s.bgFrames}><OffthreadVideo src={staticFile(s.bg)} muted style={style} /></Loop>
          : <OffthreadVideo src={staticFile(s.bg)} muted style={style} />)
        : <Img src={staticFile(s.bg)} style={style} />}
    </AbsoluteFill>
  );
};

/* 장면이 바뀔 때 강조색 판이 휙 지나간다 */
const Wipe = ({ color }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 9], [0, 112], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (frame > 10) return null;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}%) skewX(-12deg)`, background: color, width: "130%", left: "-15%" }} />
  );
};

/* ---------- 글자 ---------- */

// 단어들을 1~2어절(최대 10자) 묶음으로 — 지금 엔진의 자막 끊기와 같은 규칙
function chunks(words) {
  const out = [];
  let cur = [];
  for (const w of words) {
    const len = cur.map((x) => x.text).join(" ").length + w.text.length;
    if (cur.length && (cur.length >= 2 || len > 10)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.,?!]$/.test(w.text)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

const Word = ({ w, t, color, size, fps }) => {
  const frame = useCurrentFrame();
  const startF = Math.round(w.start * fps);
  const pop = spring({ frame: frame - startF, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } });
  const marker = interpolate(frame, [startF + 2, startF + 9], [0, 100], clamp);
  return (
    <span style={{
      display: "inline-block", margin: "0 0.16em", position: "relative", fontSize: size,
      transform: `translateY(${(1 - pop) * 36}px) scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.4),
      color: w.hl ? "#111" : "white",
    }}>
      {w.hl ? (
        <span style={{
          position: "absolute", left: "-0.12em", right: "-0.12em", top: "8%", bottom: "4%", background: color,
          borderRadius: 10, transformOrigin: "left center", transform: `scaleX(${marker / 100}) skewX(-6deg)`, zIndex: -1,
        }} />
      ) : null}
      <span style={{ textShadow: w.hl ? "none" : "0 4px 18px rgba(0,0,0,.65), 0 2px 0 rgba(0,0,0,.6)" }}>{w.text}</span>
    </span>
  );
};

// 말에 맞춰 1~2어절씩 바뀌는 자막. 강조어는 형광펜이 그어지듯 칠해진다
const Caption = ({ s, color, lead, y = 1250, size = 92 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - lead) / fps;
  const cs = chunks(s.words || []);
  let idx = -1;
  cs.forEach((c, i) => { if (c[0].start <= t) idx = i; });
  if (idx < 0) return null;
  const words = cs[idx].map((w) => ({ ...w, start: w.start + lead / fps }));
  return (
    <div style={{ position: "absolute", top: y, left: 60, right: 60, textAlign: "center", fontWeight: 900, letterSpacing: "-0.02em", isolation: "isolate" }}>
      {words.map((w, i) => <Word key={`${idx}-${i}`} w={w} t={t} color={color} size={size} fps={fps} />)}
    </div>
  );
};

// 첫 장면: 문장 전체를 크게, 말하는 단어부터 차례로 튀어나온다
const HookText = ({ s, color, lead }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (s.words || []).map((w) => ({ ...w, start: w.start + lead / fps }));
  const shake = frame < 14 ? Math.sin(frame * 2.2) * (14 - frame) * 0.6 : 0;
  return (
    <div style={{
      position: "absolute", top: 760, left: 70, right: 70, textAlign: "center", fontWeight: 900,
      lineHeight: 1.28, letterSpacing: "-0.03em", transform: `rotate(${shake * 0.15}deg)`, isolation: "isolate",
    }}>
      {words.map((w, i) => <Word key={i} w={w} color={color} size={116} fps={fps} />)}
    </div>
  );
};

/* ---------- 그래픽 ---------- */

const Header = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 14 } });
  const b = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const color = HL[p.highlight] || HL.yellow;
  return (
    <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", fontWeight: 900, letterSpacing: "-0.03em" }}>
      <div style={{ fontSize: 76, transform: `translateY(${(1 - a) * -80}px)`, opacity: a, textShadow: "0 4px 20px rgba(0,0,0,.7)" }}>{p.title1}</div>
      <div style={{ display: "inline-block", marginTop: 14, transform: `scale(${b})`, opacity: b }}>
        <span style={{ fontSize: 70, color: "#111", background: color, padding: "6px 26px", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>{p.title2}</span>
      </div>
    </div>
  );
};

const TipBadge = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 3, fps, config: { damping: 9, stiffness: 160 } });
  return (
    <div style={{
      position: "absolute", top: 1080, left: 0, right: 0, display: "flex", justifyContent: "center",
      transform: `scale(${a}) rotate(${(1 - a) * -18}deg)`,
    }}>
      <div style={{ background: color, color: "#111", fontWeight: 900, fontSize: 64, padding: "8px 34px", borderRadius: 999, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
        {text}
      </div>
    </div>
  );
};

// 비교형: A는 왼쪽에서, B는 오른쪽에서 이름표가 미끄러져 들어온다
const SideBadge = ({ text, side, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 2, fps, config: { damping: 13 } });
  const bg = side === "A" ? color : "#5AB4FF";
  return (
    <div style={{
      position: "absolute", top: 1060, [side === "A" ? "left" : "right"]: 60,
      transform: `translateX(${(1 - a) * (side === "A" ? -700 : 700)}px)`,
    }}>
      <div style={{ background: bg, color: "#111", fontWeight: 900, fontSize: 70, padding: "10px 40px", borderRadius: 20, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
        <span style={{ fontSize: 44, opacity: 0.7, marginRight: 14 }}>{side}</span>{text}
      </div>
    </div>
  );
};

// 두 번째 비교 대상이 나올 때 VS 가 쾅 찍힌다
const VsFlash = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const fade = interpolate(frame, [18, 30], [1, 0], clamp);
  if (frame > 30) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fade }}>
      <div style={{
        fontSize: 300, fontWeight: 900, fontStyle: "italic", color: "white", letterSpacing: "-0.05em",
        transform: `scale(${2.4 - 1.4 * a}) rotate(-8deg)`, textShadow: "0 0 40px #FF5046, 0 10px 0 #FF5046",
      }}>VS</div>
    </AbsoluteFill>
  );
};

// 보관 경고형: 빨간 X / 초록 O 도장이 쾅 찍히고 화면이 살짝 흔들린다
const Stamp = ({ mark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 220 } });
  const shake = frame > 4 && frame < 14 ? Math.sin(frame * 3) * (14 - frame) : 0;
  const c = mark === "O" ? "#3CC85A" : "#EB3232";
  return (
    <div style={{
      position: "absolute", left: 540 - 210, top: 520, width: 420, height: 420, borderRadius: "50%",
      border: `22px solid ${c}`, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center",
      transform: `translate(${shake}px, 0) scale(${2.2 - 1.2 * a}) rotate(${(1 - a) * -25}deg)`, opacity: Math.min(1, a * 1.5),
      boxShadow: `0 0 60px ${c}88`,
    }}>
      <span style={{ fontSize: 300, fontWeight: 900, color: c, lineHeight: 1 }}>{mark}</span>
    </div>
  );
};

// 물량 리빌: 숫자가 0부터 빠르게 올라가다 멈추며 튄다
const Counter = ({ to, unit, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [6, 42], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const done = spring({ frame: frame - 42, fps, config: { damping: 6, stiffness: 200 } });
  const n = Math.round(to * t);
  return (
    <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center", fontWeight: 900 }}>
      <span style={{
        display: "inline-block", fontSize: 300, color, letterSpacing: "-0.05em", lineHeight: 1,
        transform: `scale(${1 + 0.15 * done * (frame > 42 ? 1 : 0)})`, textShadow: "0 12px 40px rgba(0,0,0,.6)",
      }}>{n}</span>
      <span style={{ fontSize: 120, marginLeft: 12, textShadow: "0 8px 30px rgba(0,0,0,.6)" }}>{unit}</span>
    </div>
  );
};

// 자막만 나오는 장면: 문장 전체가 어절마다 차례로 튀어나온다
const AllText = ({ s, color, lead, y = 1210, size = 86 }) => {
  const { fps } = useVideoConfig();
  const words = (s.words || []).map((w) => ({ ...w, start: w.start + lead / fps }));
  return (
    <div style={{ position: "absolute", top: y, left: 60, right: 60, textAlign: "center", fontWeight: 900, lineHeight: 1.3, letterSpacing: "-0.02em", isolation: "isolate" }}>
      {words.map((w, i) => <Word key={i} w={w} color={color} size={size} fps={fps} />)}
    </div>
  );
};

const Progress = ({ n, total, color }) => (
  <div style={{ position: "absolute", top: 400, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
    {Array.from({ length: total }, (_, i) => (
      <ProgressDot key={i} on={i < n} now={i === n - 1} color={color} />
    ))}
  </div>
);

const ProgressDot = ({ on, now, color }) => {
  const frame = useCurrentFrame();
  const fill = now ? interpolate(frame, [4, 16], [0, 1], clamp) : on ? 1 : 0;
  return (
    <div style={{ width: 96, height: 14, borderRadius: 8, background: "rgba(255,255,255,.3)", overflow: "hidden" }}>
      <div style={{ width: `${fill * 100}%`, height: "100%", background: color }} />
    </div>
  );
};

// 상품 위에 숨 쉬듯 커졌다 작아지는 링 — "여기를 보세요"
const Spotlight = ({ color }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 14], [0, 1], clamp);
  const pulse = 1 + Math.sin(frame / 7) * 0.035;
  return (
    <div style={{
      position: "absolute", left: 540 - 230, top: 700 - 230, width: 460, height: 460, borderRadius: "50%",
      border: `10px solid ${color}`, opacity: a * 0.9, transform: `scale(${(0.6 + 0.4 * a) * pulse})`,
      boxShadow: `0 0 0 4000px rgba(0,0,0,${0.28 * a})`,
    }} />
  );
};

// 체크 표시가 그려진다
const Check = ({ at, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = interpolate(frame, [at, at + 10], [1, 0], clamp);
  const pop = spring({ frame: frame - at, fps, config: { damping: 10 } });
  if (frame < at) return null;
  return (
    <svg width="170" height="170" viewBox="0 0 100 100" style={{ position: "absolute", right: 80, top: 520, transform: `scale(${pop})` }}>
      <circle cx="50" cy="50" r="46" fill="#111" opacity=".75" />
      <path d="M27 52 L44 68 L74 34" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"
        pathLength="1" strokeDasharray="1" strokeDashoffset={d} />
    </svg>
  );
};

// 마지막 장면: 가격표가 올라오고 숫자가 원래 가격에서 판매가로 내려간다
const PriceTag = ({ price, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({ frame: frame - 4, fps, config: { damping: 12 } });
  const t = interpolate(frame, [14, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const before = price.before || price.now;
  const n = Math.round((before + (price.now - before) * t) / 100) * 100;
  const strike = interpolate(frame, [10, 20], [0, 100], clamp);
  return (
    <div style={{
      position: "absolute", left: 90, right: 90, top: 560, transform: `translateY(${(1 - up) * 500}px) rotate(${(1 - up) * 8}deg)`,
      background: "white", color: "#111", borderRadius: 36, padding: "36px 40px", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.5)",
    }}>
      {price.unit ? <div style={{ fontSize: 50, fontWeight: 700, color: "#555" }}>{price.unit}</div> : null}
      {price.before && price.before > price.now ? (
        <div style={{ position: "relative", display: "inline-block", fontSize: 54, fontWeight: 700, color: "#999", marginTop: 6 }}>
          {price.before.toLocaleString("ko-KR")}원
          <div style={{ position: "absolute", left: 0, top: "52%", height: 7, width: `${strike}%`, background: "#FF5046", borderRadius: 4 }} />
        </div>
      ) : null}
      <div style={{ fontSize: 130, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        {n.toLocaleString("ko-KR")}<span style={{ fontSize: 70 }}>원</span>
      </div>
      <div style={{ display: "inline-block", marginTop: 10, background: color, padding: "8px 26px", borderRadius: 999, fontSize: 44, fontWeight: 800 }}>
        주문은 프로필 링크
      </div>
    </div>
  );
};

const SaveIcon = ({ color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 4, fps, config: { damping: 7, stiffness: 140 } });
  return (
    <svg width="260" height="260" viewBox="0 0 100 100" style={{ position: "absolute", left: 410, top: 640, transform: `scale(${a}) rotate(${(1 - a) * 30}deg)` }}>
      <path d="M26 12 H74 V90 L50 72 L26 90 Z" fill={color} stroke="#111" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
};

const InfoBar = ({ text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  if (!text) return null;
  return (
    <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `translateY(${(1 - a) * 200}px)` }}>
      <div style={{ background: color, color: "#111", fontWeight: 800, fontSize: 46, padding: "14px 40px", borderRadius: 999, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>{text}</div>
    </div>
  );
};

const AiLabel = () => (
  <div style={{ position: "absolute", top: 40, right: 40, background: "rgba(0,0,0,.55)", color: "white", fontSize: 30, fontWeight: 700, padding: "8px 18px", borderRadius: 10 }}>
    AI 생성 장면 포함
  </div>
);
