/**
 * Figma 상세페이지 템플릿 분석 (읽기 전용)
 *
 *   node scripts/figma-analyze.mjs <Figma 파일 링크 또는 키> [...]
 *
 * - 토큰: .env.local 의 FIGMA_TOKEN (File content 읽기 권한). 값은 출력하지 않는다.
 * - 페이지마다 세로로 긴 최상위 프레임(상세페이지)을 찾아 섹션·크기·글꼴·색·여백을 숫자로 정리한다.
 * - 결과: .figma-analysis/<파일키>.json + 콘솔 요약 (gitignore — 구매 템플릿 내용이 섞여 있음)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.figma.com/v1';
const OUT_DIR = '.figma-analysis';
/** 상세페이지로 볼 프레임: 폭 500~1500, 세로가 폭의 2배 이상 */
const isDetailPage = (b) => b && b.width >= 500 && b.width <= 1500 && b.height >= b.width * 2;
/** 섹션으로 볼 최소 높이 */
const MIN_SECTION_HEIGHT = 120;
const NODE_BATCH = 5;
/** 이보다 오래 기다리라고 하면(요금제 한도) 멈추고 지금까지 결과만 남긴다 */
const MAX_WAIT_MS = 120_000;

class RateLimitError extends Error {
  constructor(waitMs) {
    super(`Figma 요청 한도 — ${Math.ceil(waitMs / 3_600_000)}시간 뒤에 다시 시도할 수 있어요.`);
  }
}

async function loadToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN.trim();
  const env = await readFile('.env.local', 'utf8').catch(() => '');
  const line = env.split(/\r?\n/).find((l) => /^\s*FIGMA_TOKEN\s*=/.test(l));
  const token = line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  if (!token) throw new Error('.env.local 에 FIGMA_TOKEN 이 없어요.');
  return token;
}

const fileKeyOf = (input) => input.match(/figma\.com\/(?:design|file|proto|board)\/([A-Za-z0-9]+)/)?.[1] ?? (/^[A-Za-z0-9]{10,}$/.test(input) ? input : null);

async function api(token, path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': token } });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 30) * 1000;
      if (wait > MAX_WAIT_MS) throw new RateLimitError(wait);
      console.log(`  ⏳ 요청 한도 — ${wait / 1000}초 대기`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Figma ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error('Figma 요청 한도 초과');
}

// ===== 분석 =====

const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
const visible = (n) => n.visible !== false;
const solidFill = (n) => n.fills?.find((f) => f.type === 'SOLID' && f.visible !== false && (f.opacity ?? 1) > 0.05);
const hasImage = (n) => n.fills?.some((f) => f.type === 'IMAGE' && f.visible !== false);
const count = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

function walk(node, visit, depth = 0) {
  if (!visible(node)) return;
  visit(node, depth);
  for (const child of node.children ?? []) walk(child, visit, depth + 1);
}

/** x 시작점이 다른 덩어리 수 = 단 수 (같은 줄에 나란히 놓인 큰 요소 기준) */
function columnsOf(section) {
  const box = section.absoluteBoundingBox;
  const blocks = (section.children ?? [])
    .filter(visible)
    .map((c) => c.absoluteBoundingBox)
    .filter((b) => b && b.width > box.width * 0.15 && b.width < box.width * 0.9 && b.height > 60);
  let best = 1;
  for (const a of blocks) {
    const row = blocks.filter((b) => Math.abs(b.y - a.y) < 40);
    best = Math.max(best, new Set(row.map((b) => Math.round(b.x / 20))).size);
  }
  return best;
}

function analyzeSection(section, page) {
  const box = section.absoluteBoundingBox;
  const fonts = new Map();
  let texts = 0;
  let images = 0;
  let imageArea = 0;
  let maxFont = 0;
  const lines = [];
  walk(section, (n) => {
    if (n.type === 'TEXT') {
      texts++;
      const s = n.style ?? {};
      maxFont = Math.max(maxFont, s.fontSize ?? 0);
      count(fonts, `${s.fontFamily} ${s.fontWeight} ${s.fontSize}`);
      if (lines.length < 3 && n.characters?.trim()) lines.push({ size: s.fontSize, text: n.characters.trim().replace(/\s+/g, ' ').slice(0, 40) });
    } else if (hasImage(n) && n.absoluteBoundingBox) {
      images++;
      imageArea += n.absoluteBoundingBox.width * n.absoluteBoundingBox.height;
    }
  });
  const bg = solidFill(section);
  return {
    name: section.name,
    y: Math.round(box.y - page.y),
    height: Math.round(box.height),
    background: bg ? hex(bg.color) : null,
    columns: columnsOf(section),
    texts,
    images,
    imageRatio: +(Math.min(1, imageArea / (box.width * box.height))).toFixed(2),
    maxFontSize: maxFont,
    headline: lines.sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0]?.text ?? null,
  };
}

/** 섹션 = 프레임 바로 아래의 큰 덩어리. 하나뿐이면(감싸는 그룹) 한 단계 더 내려간다 */
function sectionsOf(frame) {
  let parent = frame;
  for (let i = 0; i < 3; i++) {
    const big = (parent.children ?? []).filter((c) => visible(c) && c.absoluteBoundingBox?.height >= MIN_SECTION_HEIGHT);
    if (big.length === 1 && big[0].children?.length) parent = big[0];
    else break;
  }
  return (parent.children ?? [])
    .filter((c) => visible(c) && c.absoluteBoundingBox?.height >= MIN_SECTION_HEIGHT && c.absoluteBoundingBox.width >= frame.absoluteBoundingBox.width * 0.6)
    .sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y);
}

function analyzePage(frame) {
  const box = frame.absoluteBoundingBox;
  const fonts = new Map();
  const families = new Map();
  const sizes = new Map();
  const colors = new Map();
  walk(frame, (n) => {
    if (n.type === 'TEXT' && n.style) {
      count(families, n.style.fontFamily);
      count(sizes, n.style.fontSize);
      count(fonts, `${n.style.fontFamily} ${n.style.fontWeight}`);
      const c = solidFill(n);
      if (c) count(colors, `text ${hex(c.color)}`);
    } else {
      const c = solidFill(n);
      const b = n.absoluteBoundingBox;
      if (c && b) count(colors, `fill ${hex(c.color)}`, Math.round((b.width * b.height) / 1e4));
    }
  });
  const sections = sectionsOf(frame).map((s) => analyzeSection(s, box));
  const lefts = new Map();
  walk(frame, (n) => {
    if (n.type === 'TEXT' && n.absoluteBoundingBox) count(lefts, Math.round(n.absoluteBoundingBox.x - box.x));
  });
  return {
    name: frame.name,
    width: Math.round(box.width),
    height: Math.round(box.height),
    sectionCount: sections.length,
    sections,
    fontFamilies: top(families, 4),
    fontSizes: top(sizes, 10).sort((a, b) => b[0] - a[0]),
    fontWeights: top(fonts, 6),
    colors: top(colors, 12),
    textLeftMargins: top(lefts, 4),
  };
}

// ===== 실행 =====

async function analyzeFile(token, key) {
  const shallow = await api(token, `/files/${key}?depth=2`);
  const candidates = shallow.document.children.flatMap((page) =>
    (page.children ?? []).filter((n) => ['FRAME', 'COMPONENT', 'SECTION', 'GROUP'].includes(n.type) && isDetailPage(n.absoluteBoundingBox)).map((n) => ({ page: page.name, id: n.id })),
  );
  console.log(`\n📄 ${shallow.name} — 상세페이지 후보 ${candidates.length}개`);
  const pages = [];
  const save = () => writeFile(`${OUT_DIR}/${key}.json`, JSON.stringify({ key, name: shallow.name, lastModified: shallow.lastModified, total: candidates.length, pages }, null, 2));
  await mkdir(OUT_DIR, { recursive: true });
  for (let i = 0; i < candidates.length; i += NODE_BATCH) {
    const batch = candidates.slice(i, i + NODE_BATCH);
    const { nodes } = await api(token, `/files/${key}/nodes?ids=${encodeURIComponent(batch.map((c) => c.id).join(','))}`);
    for (const c of batch) {
      const doc = nodes[c.id]?.document;
      if (!doc) continue;
      const result = { page: c.page, ...analyzePage(doc) };
      pages.push(result);
      console.log(`  - [${c.page}] ${result.name} ${result.width}×${result.height} 섹션 ${result.sectionCount} · 글꼴 ${result.fontFamilies.map(([f]) => f).join('/')}`);
    }
    await save();
  }
  return pages.length;
}

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.log('사용법: node scripts/figma-analyze.mjs <Figma 링크 또는 파일키> [...]');
  process.exit(1);
}
const token = await loadToken();
let total = 0;
for (const input of inputs) {
  const key = fileKeyOf(input);
  if (!key) {
    console.log(`⚠️  링크에서 파일 키를 못 찾았어요: ${input}`);
    continue;
  }
  try {
    total += await analyzeFile(token, key);
  } catch (error) {
    console.log(`⚠️  ${key}: ${error.message}`);
    if (error instanceof RateLimitError) break;
  }
}
console.log(`\n✅ 상세페이지 ${total}개 분석 → ${OUT_DIR}/`);
