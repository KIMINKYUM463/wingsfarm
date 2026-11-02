import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { ffmpegFailure } = await import('./ffmpeg');

describe('ffmpeg 실패 이유', () => {
  it('시간 초과로 꺼지면 영상 수·길이를 줄이라고 안내한다', () => {
    const err = ffmpegFailure({ killed: true, signal: 'SIGTERM' });
    assert.equal(err?.status, 504);
    assert.match(err!.message, /너무 오래/);
  });

  it('서버가 강제로 끄면(SIGKILL) 메모리 부족으로 안내한다', () => {
    const err = ffmpegFailure({ killed: false, signal: 'SIGKILL' });
    assert.equal(err?.status, 507);
    assert.match(err!.message, /메모리/);
  });

  it('그 밖의 실패는 원래 오류를 그대로 쓴다', () => {
    assert.equal(ffmpegFailure({ code: 1, signal: null }), null);
    assert.equal(ffmpegFailure(undefined), null);
  });
});
