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

  it('실행 권한·파일 없음·ffmpeg 종료 코드는 안내 메시지로 바꾼다', () => {
    assert.equal(ffmpegFailure({ code: 'EACCES' })?.status, 503);
    assert.equal(ffmpegFailure({ code: 'ENOENT' })?.status, 503);
    assert.equal(ffmpegFailure({ code: 1, stderr: 'Error while filtering' })?.status, 502);
    assert.equal(ffmpegFailure(undefined), null);
  });
});
