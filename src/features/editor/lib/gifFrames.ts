/**
 * GIF 용량 줄이기 — 모든 장이 같은 색표를 쓰고, 앞 장과 같은 픽셀은 투명으로 둔다
 * (GIF는 앞 장 위에 다음 장을 겹쳐 그리므로 바뀐 픽셀만 저장하면 된다)
 */
export function diffIndexes(previous: Uint8Array | null, next: Uint8Array, transparentIndex: number) {
  if (!previous) return { indexes: next, changed: true };
  const indexes = new Uint8Array(next.length);
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    if (next[i] === previous[i]) {
      indexes[i] = transparentIndex;
    } else {
      indexes[i] = next[i];
      changed = true;
    }
  }
  return { indexes, changed };
}
