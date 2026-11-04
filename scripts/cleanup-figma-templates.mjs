/**
 * 이미 동기화된 Figma 템플릿 중 연출·사진·작은 프레임을 제거하고
 * 상세 섹션만 남긴다. (동기화 필터와 같은 기준)
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const idxPath = '.data/detail-page/templates/index.json';
const SKIP_PAGE = /연출|스타일|mood|레퍼런스|참고\s*컷|이미지\s*모음|photo\s*ref/i;
const SKIP_FRAME_NAME = /^(image|no-?bg|사진|img)(\s|$)/i;
const SKIP_AI = /^ai\s*image/i;
const LOOSE = /^Frame(\s|$|\d)/i;
const isSize = (w, h) => w >= 700 && w <= 1100 && h >= 900;

function part2FromName(name, fallback) {
  const slash = name.split('/');
  if (slash.length > 1) return slash[0].trim() || fallback;
  const base = name.replace(/\s*\*+\s*$/, '').trim();
  const m = /^(.*?)(?:\s*[-_]?\s*\d+)\s*$/.exec(base);
  const group = (m?.[1] ?? base).trim();
  if (!group || LOOSE.test(group) || group.length < 2) return fallback;
  return group;
}

const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const kept = [];
const dropped = [];

for (const t of idx.templates) {
  if (t.source !== 'figma') {
    kept.push(t);
    continue;
  }
  const badPage = SKIP_PAGE.test(t.part1 || '');
  const badName =
    !t.name || SKIP_FRAME_NAME.test(t.name.trim()) || SKIP_AI.test(t.name) || LOOSE.test(t.name.trim());
  const badSize = !isSize(Number(t.width) || 0, Number(t.height) || 0);
  if (badPage || badName || badSize) {
    dropped.push(t);
    continue;
  }
  const part2 = part2FromName(t.name, t.part2);
  kept.push({ ...t, part2 });
}

idx.templates = kept;
writeFileSync(idxPath, JSON.stringify(idx));

let removedFiles = 0;
for (const t of dropped) {
  for (const rel of [
    join('.data/detail-page/templates/frames', `${t.id}.json`),
    join('.data/detail-page/templates/thumbs', `${t.id}.png`),
    join('.data/detail-page/templates/thumbs', `${t.id}.svg`),
  ]) {
    if (existsSync(rel)) {
      unlinkSync(rel);
      removedFiles += 1;
    }
  }
}

const figma = kept.filter((t) => t.source === 'figma');
const byPart2 = {};
for (const t of figma) byPart2[t.part2] = (byPart2[t.part2] || 0) + 1;

console.log(
  JSON.stringify(
    {
      keptFigma: figma.length,
      dropped: dropped.length,
      removedFiles,
      part2Top: Object.entries(byPart2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25),
    },
    null,
    2,
  ),
);
