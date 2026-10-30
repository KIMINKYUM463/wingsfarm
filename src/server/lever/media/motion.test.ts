import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  GIF_STEPS,
  heroGifArgs,
  panClipArgs,
  parseVideoResponse,
  stockClipArgs,
  stockClipStart,
  stockOrientation,
  videoAspect,
  videoClipArgs,
  videoRequestBody,
} = await import('./motion.ts');
const { interleave, isStockSource, pexelsClipSource, pexelsToStock, pickVideoFile, pixabayClipSource, pixabayToStock, preferOrientation } =
  await import('./stockSources.ts');

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

describe('무료 영상 (Pexels·Pixabay)', () => {
  const file = (width: number, height: number, file_type = 'video/mp4') => ({ link: `https://videos.pexels.com/${width}.mp4`, file_type, width, height });
  const pexelsVideo = (video_files: ReturnType<typeof file>[] = []) => ({
    id: 7,
    width: 1920,
    height: 1080,
    duration: 12,
    url: 'https://www.pexels.com/video/7/',
    image: 'https://images.pexels.com/7.jpg',
    user: { name: '김작가', url: 'u' },
    video_files,
  });
  const rendition = (width: number, height: number) => ({
    url: `https://cdn.pixabay.com/video/${width}.mp4`,
    width,
    height,
    size: 1,
    thumbnail: `https://cdn.pixabay.com/video/${width}.jpg`,
  });
  const pixabayVideo = (videos: Record<string, ReturnType<typeof rendition>>) => ({ id: 125, pageURL: 'https://pixabay.com/videos/id-125/', duration: 12, user: '', videos });

  it('가운데 5초를 쓰고, 짧은 영상은 처음부터', () => {
    assert.equal(stockClipStart(20), 7.5);
    assert.equal(stockClipStart(3), 0);
    const args = stockClipArgs('in.mp4', 'out.mp4', 860, 980, 20);
    assert.equal(args[args.indexOf('-ss') + 1], '7.5');
    assert.equal(args[args.indexOf('-t') + 1], '5');
    assert.match(args[args.indexOf('-vf') + 1], /crop=860:980/);
    assert.ok(args.includes('-an'));
  });

  it('사진 자리를 흐리지 않게 덮는 가장 작은 MP4를 고르고, 4K·다른 형식은 뺀다', () => {
    const { files } = pexelsClipSource(pexelsVideo([file(3840, 2160), file(1920, 1080), file(1280, 720), file(640, 360), file(1920, 1080, 'video/webm')]));
    assert.equal(files.length, 4);
    assert.equal(pickVideoFile(files, 860, 480)?.width, 1280);
    assert.equal(pickVideoFile(files, 860, 980)?.width, 1920);
    assert.equal(pickVideoFile(pexelsClipSource(pexelsVideo([file(3840, 2160)])).files, 860, 980), null);
  });

  it('사진 자리 모양으로 검색 방향을 정한다', () => {
    assert.equal(stockOrientation(860, 480), 'landscape');
    assert.equal(stockOrientation(860, 1100), 'portrait');
    assert.equal(stockOrientation(860, 860), 'square');
  });

  it('Pexels 검색 결과를 화면용으로 줄이고 출처를 남긴다', () => {
    assert.deepEqual(pexelsToStock(pexelsVideo()), {
      source: 'pexels',
      id: 7,
      thumbnail: 'https://images.pexels.com/7.jpg',
      duration: 12,
      width: 1920,
      height: 1080,
      author: '김작가',
      pageUrl: 'https://www.pexels.com/video/7/',
    });
    assert.deepEqual(pexelsClipSource(pexelsVideo()).credit, { source: 'pexels', author: '김작가', url: 'https://www.pexels.com/video/7/' });
  });

  it('Pixabay: 빈 large는 빼고, 작은 썸네일·가장 큰 크기를 쓰며, 작가가 없으면 Pixabay', () => {
    const video = pixabayVideo({ large: { ...rendition(0, 0), url: '' }, medium: rendition(1920, 1080), small: rendition(1280, 720), tiny: rendition(960, 540) });
    assert.deepEqual(pixabayToStock(video), {
      source: 'pixabay',
      id: 125,
      thumbnail: 'https://cdn.pixabay.com/video/1280.jpg',
      duration: 12,
      width: 1920,
      height: 1080,
      author: 'Pixabay',
      pageUrl: 'https://pixabay.com/videos/id-125/',
    });
    const clip = pixabayClipSource(video);
    assert.deepEqual(clip.files.map((f) => f.width), [1920, 1280, 960]);
    assert.equal(pickVideoFile(clip.files, 860, 480)?.width, 1280);
    assert.equal(pixabayToStock(pixabayVideo({})), null);
  });

  it('방향 필터가 없는 결과는 같은 방향을 앞으로, 사이트별 결과는 번갈아 섞는다', () => {
    const wide = { ...pexelsToStock(pexelsVideo()), id: 1 };
    const tall = { ...wide, id: 2, width: 1080, height: 1920 };
    assert.deepEqual(preferOrientation([wide, tall], 'portrait').map((v) => v.id), [2, 1]);
    assert.deepEqual(interleave<number | string>([[1, 2, 3], ['a']]), [1, 'a', 2, 3]);
    assert.deepEqual(interleave([]), []);
  });

  it('출처 값 검사', () => {
    assert.ok(isStockSource('pixabay'));
    assert.ok(!isStockSource('toString'));
    assert.ok(!isStockSource(undefined));
  });
});
