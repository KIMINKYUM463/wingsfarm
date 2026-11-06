/**
 * 장면 끝의 '픽'은 소리가 0이 되기 전에 잘려서 난다.
 * 끝과 시작을 0으로 내리고, 끝부분의 튀는 파형은 지운다.
 */
const RATE = 48000;

function cosineToZero(samples: Float32Array, from: number, to: number) {
  const n = to - from;
  if (n <= 1) return;
  for (let i = from; i < to && i < samples.length; i++) {
    const t = (i - from) / (n - 1);
    samples[i] *= Math.cos((Math.PI / 2) * Math.min(1, Math.max(0, t)));
  }
  for (let i = to; i < samples.length; i++) samples[i] = 0;
}

function cosineFromZero(samples: Float32Array, from: number, to: number) {
  const n = to - from;
  if (n <= 1) return;
  for (let i = 0; i < from; i++) samples[i] = 0;
  for (let i = from; i < to && i < samples.length; i++) {
    const t = (i - from) / (n - 1);
    samples[i] *= Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, t)));
  }
}

/** 연속으로 크게 튀면 클릭이다. 말소리의 한 샘플 차이로는 자르지 않는다. */
function findBurst(samples: Float32Array, from: number, to: number): number {
  let run = 0;
  let start = -1;
  const begin = Math.max(1, from);
  for (let i = begin; i < to; i++) {
    if (Math.abs(samples[i]! - samples[i - 1]!) > 0.28) {
      if (run === 0) start = i;
      run += 1;
      if (run >= 6) return start;
    } else {
      run = 0;
      start = -1;
    }
  }
  return -1;
}

export function declickSamples(input: Float32Array, rate = RATE): Float32Array {
  const samples = new Float32Array(input);
  if (samples.length < 8) return samples;

  const look = Math.min(samples.length - 1, Math.round(0.2 * rate));
  const tailBurst = findBurst(samples, samples.length - look, samples.length);
  if (tailBurst > 0) {
    const from = Math.max(0, tailBurst - Math.round(0.02 * rate));
    cosineToZero(samples, from, tailBurst);
  }
  const headBurst = findBurst(samples, 1, look);
  if (headBurst > 0) {
    const to = Math.min(samples.length, headBurst + Math.round(0.02 * rate));
    cosineFromZero(samples, headBurst, to);
  }

  const tail = Math.min(samples.length, Math.max(2, Math.round(0.04 * rate)));
  const head = Math.min(samples.length, Math.max(2, Math.round(0.012 * rate)));
  cosineToZero(samples, samples.length - tail, samples.length);
  cosineFromZero(samples, 0, head);
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}
