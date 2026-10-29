import { useId, type ReactNode } from "react";

interface Point {
  x: number;
  y: number;
}

interface Scale {
  width: number;
  height: number;
  padding: number;
  /** 값 범위 (여러 선을 같은 잣대로 그릴 때 지정) */
  min?: number;
  max?: number;
  /** x축 칸 수 (값 개수보다 긴 축에 일부만 그릴 때 지정) */
  slots?: number;
}

function toPoints(values: number[], { width, height, padding, min = Math.min(...values), max = Math.max(...values), slots = values.length }: Scale): Point[] {
  const range = max - min || 1;
  return values.map((v, i) => ({
    x: slots === 1 ? width / 2 : (i / (slots - 1)) * width,
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));
}

/** Catmull-Rom 스플라인을 베지어 곡선으로 변환해 부드러운 선을 만든다 */
function smoothLine(points: Point[]) {
  if (points.length < 2) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

const WIDTH = 600;

function Gradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity="0.35" />
      <stop offset="100%" stopColor={color} stopOpacity="0" />
    </linearGradient>
  );
}

function MarkerLine({ x, height }: { x: number; height: number }) {
  return <line x1={x} x2={x} y1={0} y2={height} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />;
}

/** 값이 바뀌면 key가 바뀌어 다시 왼쪽부터 그려진다 */
const chartKey = (...series: number[][]) => series.map((s) => s.map((v) => v.toFixed(1)).join()).join("|");

/**
 * "지금" 위치에서 깜빡이는 점.
 * SVG가 preserveAspectRatio="none"으로 늘어나 원이 찌그러지므로 HTML로 위에 겹친다.
 */
function NowDot({ point, height, color }: { point: Point; height: number; color: string }) {
  return (
    <span
      className="pointer-events-none absolute animate-pop-in [animation-delay:1.2s]"
      style={{ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / height) * 100}%` }}
      aria-hidden
    >
      <span className="absolute -left-2.5 -top-2.5 size-5 animate-ping rounded-full opacity-70" style={{ backgroundColor: color }} />
      <span className="absolute -left-1.5 -top-1.5 size-3 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} />
    </span>
  );
}

function ChartFrame({ chartKey, height, className, now, color, children }: { chartKey: string; height: number; className?: string; now: Point; color: string; children: ReactNode }) {
  return (
    <div key={chartKey} className={`relative ${className ?? ""}`}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" className="block w-full animate-reveal" style={{ height }}>
        {children}
      </svg>
      <NowDot point={now} height={height} color={color} />
    </div>
  );
}

export function AreaChart({
  values,
  height = 160,
  color = "#34d399",
  markerIndex,
  nowIndex,
  className,
}: {
  values: number[];
  height?: number;
  color?: string;
  /** 세로 점선으로 강조할 지점 (예: 작년 이맘때) */
  markerIndex?: number;
  /** 깜빡이는 "지금" 점 위치 (기본: 마지막 값) */
  nowIndex?: number;
  className?: string;
}) {
  const id = useId();
  if (values.length < 2) return null;
  const points = toPoints(values, { width: WIDTH, height, padding: 12 });
  const line = smoothLine(points);
  const marker = markerIndex !== undefined ? points[markerIndex] : undefined;
  const now = points[nowIndex ?? points.length - 1];

  return (
    <ChartFrame chartKey={chartKey(values)} height={height} className={className} now={now} color={color}>
      <defs>
        <Gradient id={id} color={color} />
      </defs>
      <path d={`${line} L${WIDTH},${height} L0,${height} Z`} fill={`url(#${id})`} />
      {marker && <MarkerLine x={marker.x} height={height} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {marker && marker !== now && <circle cx={marker.x} cy={marker.y} r="3.5" fill={color} fillOpacity="0.6" vectorEffect="non-scaling-stroke" />}
    </ChartFrame>
  );
}

/** 작년 흐름(점선) 위에 올해 흐름(실선)을 같은 잣대로 겹쳐 그린다 */
export function CompareChart({
  lastYear,
  thisYear,
  nowIndex,
  height = 200,
  color = "#10b981",
  className,
}: {
  lastYear: number[];
  thisYear: number[];
  /** 작년·올해가 겹치는 "지금" 위치 */
  nowIndex: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const id = useId();
  if (lastYear.length < 2 || thisYear.length < 2) return null;
  const scale: Scale = { width: WIDTH, height, padding: 14, min: 0, max: Math.max(1, ...lastYear, ...thisYear), slots: lastYear.length };
  const past = toPoints(lastYear, scale);
  const current = toPoints(thisYear, scale);
  const currentLine = smoothLine(current);
  const now = current.at(-1)!;

  return (
    <ChartFrame chartKey={chartKey(lastYear, thisYear)} height={height} className={className} now={now} color={color}>
      <defs>
        <Gradient id={id} color={color} />
      </defs>
      <path d={smoothLine(past)} fill="none" stroke="#a8a29e" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <MarkerLine x={past[nowIndex].x} height={height} />
      <path d={`${currentLine} L${now.x},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={currentLine} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </ChartFrame>
  );
}

/** 월별 막대 미니 차트 — 최고 달은 금색, 마지막 달(최근)은 초록 */
export function MonthBars({ values, labels, width = 108, height = 28 }: { values: number[]; labels: string[]; width?: number; height?: number }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const peak = values.indexOf(max);
  const gap = 2;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg key={chartKey(values)} width={width} height={height} className="inline-block animate-reveal overflow-visible">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        const fill = i === peak ? "#f59e0b" : i === values.length - 1 ? "#10b981" : "#d6d3d1";
        return (
          <rect key={labels[i]} x={i * (barWidth + gap)} y={height - h} width={barWidth} height={h} rx={1.5} fill={fill}>
            <title>{`${labels[i]} · ${Math.round(v)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function Sparkline({ values, width = 72, height = 24, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const rising = values.at(-1)! >= values[0];
  const stroke = color ?? (rising ? "#10b981" : "#f43f5e");
  return (
    <svg key={chartKey(values)} width={width} height={height} className="inline-block animate-reveal overflow-visible">
      <path d={smoothLine(toPoints(values, { width, height, padding: 3 }))} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
