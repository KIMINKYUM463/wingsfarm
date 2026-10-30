import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { GIF_STEPS, heroGifArgs, panClipArgs, parseVideoResponse, videoAspect, videoClipArgs, videoRequestBody } = await import('./motion.ts');

describe('AI 영상 요청·응답', () => {
  it('세로 사진 자리는 9:16, 가로는 16:9', () => {
    assert.equal(videoAspect(860, 980), '9:16');
    assert.equal(videoAspect(860, 480), '16:9');
  });

  it('요청 본문: 사진 → 영상, 720p, 바로 받기', () => {
    const body = videoRequestBody({ data: 'AAA', mimeType: 'image/png' }, '천천히', '9:16');
    assert.deepEqual(body.input[0], { type: 'image', data: 'AAA', mime_type: 'image/png' });
    assert.deepEqual(body.response_format, { type: 'video', aspect_ratio: '9:16', resolution: '720p' });
    assert.equal(body.background, false);
    assert.equal(body.store, false);
  });

  it('영상 데이터를 바로 받는 응답', () => {
    const body = { status: 'completed', steps: [{ type: 'thought', content: [] }, { type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: 'BASE64' }] }] };
    assert.deepEqual(parseVideoResponse(body), { kind: 'data', data: 'BASE64' });
  });

  it('주소로 받는 응답 (output_video 포함)', () => {
    assert.deepEqual(parseVideoResponse({ output_video: { type: 'video', uri: 'https://x/files/a:download' } }), { kind: 'uri', uri: 'https://x/files/a:download' });
  });

  it('오류·빈 응답은 이유와 함께 실패', () => {
    assert.throws(() => parseVideoResponse({ error: { message: 'blocked' } }), /blocked/);
    assert.throws(() => parseVideoResponse({ status: 'failed', steps: [] }), /거절/);
    assert.throws(() => parseVideoResponse(null), /만들어지지/);
  });
});

describe('ffmpeg 인자', () => {
  it('클립은 사진 자리 크기(짝수)·무음·5초', () => {
    const args = panClipArgs('in.png', 'out.mp4', 861, 979);
    const filter = args[args.indexOf('-vf') + 1];
    assert.match(filter, /s=862x980/);
    assert.ok(args.includes('-an'));
    assert.equal(args[args.indexOf('-frames:v') + 1], '120');
    assert.equal(args.at(-1), 'out.mp4');
  });

  it('AI 영상은 가운데 잘라 사진 자리에 맞춘다', () => {
    const args = videoClipArgs('raw.mp4', 'clip.mp4', 860, 980);
    assert.match(args[args.indexOf('-vf') + 1], /crop=860:980/);
  });

  it('GIF: 아래 레이어 → 클립 → 위 레이어 순서로 합성하고 단계마다 줄인다', () => {
    const layers = { below: 'b.png', clip: 'c.mp4', above: 'a.png', output: 'o.gif', rect: { x: 0, y: 120.4, width: 860, height: 980 }, outWidth: 860 };
    const first = heroGifArgs(layers, GIF_STEPS[0]).join(' ');
    assert.match(first, /overlay=0:120:shortest=1/);
    assert.match(first, /scale=860:-2/);
    const last = heroGifArgs(layers, GIF_STEPS.at(-1)!).join(' ');
    assert.match(last, /scale=560:-2/);
    assert.match(last, /max_colors=128/);
  });
});
