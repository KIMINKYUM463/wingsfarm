import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blobPath, bubblePath, burstPath, checkPath, clippedCirclePath, cornersOf, diamondPath, roundedRectPath, sparklePath, trapezoidPath, wavePath } from './shapePaths.ts';

/** 경로의 끝점·곡선 손잡이 좌표 (모든 명령이 절대 좌표) */
function points(d: string) {
  const tokens = d.match(/[MLHVQCAZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  const take = (k: number) => tokens.slice(i, (i += k)).map(Number);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') [x, y] = take(2);
    else if (cmd === 'H') [x] = take(1);
    else if (cmd === 'V') [y] = take(1);
    else if (cmd === 'Q') {
      const [cx, cy, ex, ey] = take(4);
      out.push([cx, cy]);
      [x, y] = [ex, ey];
    } else if (cmd === 'C') {
      const v = take(6);
      out.push([v[0], v[1]], [v[2], v[3]]);
      [x, y] = [v[4], v[5]];
    } else if (cmd === 'A') [x, y] = take(7).slice(5);
    else if (cmd === 'Z') continue;
    out.push([x, y]);
  }
  return out;
}

const assertInside = (d: string, width: number, height: number) => {
  for (const [x, y] of points(d)) {
    assert.ok(x >= -0.5 && x <= width + 0.5 && y >= -0.5 && y <= height + 0.5, `(${x}, ${y})가 ${width}×${height} 밖`);
  }
  assert.ok(d.startsWith('M') && d.endsWith('Z'), '닫힌 경로');
};

describe('도형 경로', () => {
  it('모서리 반지름은 도형 크기의 절반을 넘지 않는다', () => {
    assert.deepEqual(cornersOf(500, 200, 100), [50, 50, 50, 50]);
    assert.deepEqual(cornersOf([40, 10], 200, 100), [40, 10, 40, 40]);
    assert.deepEqual(cornersOf(undefined, 10, 10), [0, 0, 0, 0]);
  });

  it('모든 도형이 자기 상자(width × height) 안에 그려진다', () => {
    assertInside(roundedRectPath(300, 200, [80, 20, 80, 20]), 300, 200);
    assertInside(bubblePath(560, 180, 36, { side: 'top', at: 32, size: 18 }), 560, 198);
    assertInside(bubblePath(560, 180, 36, { side: 'bottom', at: 9999, size: 18 }), 560, 198);
    assertInside(checkPath(52), 52, 52);
    assertInside(clippedCirclePath(190, 230), 230, 380);
    assertInside(burstPath(200), 200, 200);
    assertInside(sparklePath(64), 64, 64);
    assertInside(diamondPath(14), 14, 14);
    assertInside(trapezoidPath(740, 120, 70), 740, 120);
    assertInside(wavePath(860, 300, 28, 3), 860, 300);
    assertInside(blobPath(340, 300), 340, 300);
  });

  it('말풍선 꼬리는 둥근 모서리를 피해 몸통 변 위에 붙는다', () => {
    const d = bubblePath(400, 100, 40, { side: 'top', at: 0, size: 16 });
    const tip = points(d).find(([, y]) => y === 0);
    assert.ok(tip && tip[0] >= 40 + 16, `꼬리 끝 x=${tip?.[0]}`);
  });

  it('톱니 스티커는 꼭짓점 수의 두 배만큼 점을 잇는다', () => {
    assert.equal(points(burstPath(120, 12)).length, 24);
  });
});
