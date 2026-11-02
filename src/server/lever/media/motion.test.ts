import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  GIF_STEPS,
  heroGifArgs,
  panClipArgs,
  parseVideoResponse,
  cleanCaption,
  fallbackPlan,
  frameGrabArgs,
  montageArgs,
  normalizePlan,
  sampleTimes,
  stockOrientation,
  totalSeconds,
  videoAspect,
  videoClipArgs,
  videoRequestBody,
} = await import('./motion.ts');
const { interleave, isStockSource, parseStockPicks, pexelsClipSource, pexelsToStock, pickVideoFile, pixabayClipSource, pixabayToStock, preferOrientation } =
  await import('./stockSources.ts');

describe('무료 영상 컷 편집', () => {
  const clips = [{ duration: 12 }, { duration: 8 }, { duration: 20 }];

  it('AI가 볼 장면은 앞뒤 5%를 빼고 고르게 6장', () => {
    const times = sampleTimes(10);
    assert.equal(times.length, 6);
    assert.ok(times[0] >= 0.5 && times.at(-1)! <= 9.5);
    assert.deepEqual([...times].sort((a, b) => a - b), times);
  });

  it('기본 편집: 고른 영상을 번갈아 쓰고, 모든 컷이 영상 안에 들어가며, 첫 자막은 상품명', () => {
    for (const n of [1, 2, 3]) {
      const cuts = fallbackPlan(clips.slice(0, n), '영덕 홍게');
      assert.ok(cuts.length >= 4, `${n}개면 컷 4개 이상`);
      assert.ok(totalSeconds(cuts) >= 4 && totalSeconds(cuts) <= 8);
      for (let i = 0; i < n; i++) assert.ok(cuts.some((c) => c.clip === i), `${i + 1}번 영상 사용`);
      for (const c of cuts) assert.ok(c.start >= 0 && c.start + c.duration <= clips[c.clip].duration - 0.1 + 1e-9);
      assert.deepEqual(cuts.map((c) => c.caption), ['영덕 홍게', ...cuts.slice(1).map(() => null)]);
    }
    assert.deepEqual(fallbackPlan([{ duration: 0.5 }]), []);
  });

  it('AI 답(1부터 번호)을 영상 길이·컷 길이·총 길이에 맞게 고치고 자막을 정리한다', () => {
    const cuts = normalizePlan(
      {
        cuts: [
          { clip: 1, start: 11.5, duration: 2, caption: ' 산지에서\n바로 온 🦀 ' },
          { clip: 2, start: 1, duration: 9, caption: '' },
          { clip: 3, start: -3, duration: 0.2, caption: 7 },
          { clip: 9, start: 0, duration: 2 },
        ],
      },
      clips,
    );
    assert.deepEqual(cuts, [
      { clip: 0, start: 9.9, duration: 2, caption: '산지에서 바로 온' },
      { clip: 1, start: 1, duration: 2.5, caption: null },
      { clip: 2, start: 0, duration: 0.8, caption: null },
    ]);
  });

  it('자막은 한 줄·글자 수 제한·이모지 제거', () => {
    assert.equal(cleanCaption('가나다라마바사아자차카타파하거너'), '가나다라마바사아자차카타파하');
    assert.equal(cleanCaption('  달콤한\t참외  '), '달콤한 참외');
    assert.equal(cleanCaption('🍈'), null);
    assert.equal(cleanCaption(null), null);
  });

  it('규칙을 못 지킨 AI 답은 버린다 (영상 빠짐·너무 짧음·형식 오류)', () => {
    assert.equal(normalizePlan({ cuts: [{ clip: 1, start: 0, duration: 2.5 }, { clip: 1, start: 3, duration: 2.5 }] }, clips.slice(0, 2)), null);
    assert.equal(normalizePlan({ cuts: [{ clip: 1, start: 0, duration: 1 }] }, clips.slice(0, 1)), null);
    assert.equal(normalizePlan('엉뚱한 답', clips), null);
  });

  it('총 길이가 넘치면 뒤 컷을 버린다 (완성 길이는 전환만큼 겹친다)', () => {
    const cuts = normalizePlan({ cuts: Array.from({ length: 6 }, (_, i) => ({ clip: 1, start: i, duration: 2 })) }, [{ duration: 30 }]);
    assert.equal(cuts!.length, 4);
    assert.equal(totalSeconds(cuts!), 7.1);
  });

  describe('컷 편집 ffmpeg 인자', () => {
    const cuts = [
      { path: 'a.mp4', start: 1.5, duration: 1.2, caption: '산지에서 바로 온' },
      { path: 'b.mp4', start: 0, duration: 2, caption: null },
      { path: 'c.mp4', start: 3, duration: 1.5, caption: '지금 만나보세요' },
    ];
    const render = { cuts, output: 'out.mp4', width: 860, height: 640, withText: true, tag: '영덕 홍게' };
    const filterOf = (args: string[]) => args[args.indexOf('-filter_complex') + 1];

    it('컷마다 구간을 빠르게 찾고(끝 0.1초 여유) 완성 길이로 자른다', () => {
      const args = montageArgs(render);
      assert.deepEqual(args.slice(1, 9), ['-threads', '2', '-ss', '1.5', '-t', '1.3', '-i', 'a.mp4']);
      assert.equal(args[args.indexOf('-t', args.indexOf('-filter_complex')) + 1], String(totalSeconds(cuts)));
      assert.ok(args.includes('-an'));
    });

    it('줌(번갈아 확대·축소) → 전환 효과로 잇고 → 진행 막대', () => {
      const filter = filterOf(montageArgs(render));
      assert.match(filter, /\[0:v\]scale=1720:1280:force_original_aspect_ratio=increase,crop=1720:1280/);
      assert.match(filter, /zoompan=z='1\+0\.08\*on\/29'/);
      assert.match(filter, /zoompan=z='1\.08-0\.08\*on\/48'/);
      assert.match(filter, /\[v0\]\[v1\]xfade=transition=fade:duration=0\.3:offset=0\.9\[x1\]/);
      assert.match(filter, /\[x1\]\[v2\]xfade=transition=slideleft:duration=0\.3:offset=2\.6\[x2\]/);
      assert.match(filter, /overlay=x=-w\+w\*t\/4\.1:y=H-h/);
    });

    it('자막·상품명 태그는 상대 경로 파일로 (글꼴이 없으면 빼고 만든다)', () => {
      const filter = filterOf(montageArgs(render));
      assert.match(filter, /fontfile=font\.otf:textfile=caption-0\.txt:expansion=none/);
      assert.ok(!filter.includes('caption-1.txt'), '자막 없는 컷은 글자 없음');
      assert.match(filter, /textfile=caption-2\.txt/);
      assert.match(filter, /textfile=tag\.txt/);
      const plain = filterOf(montageArgs({ ...render, withText: false }));
      assert.ok(!plain.includes('drawtext'));
    });

    it('컷 하나면 전환 없이', () => {
      const filter = filterOf(montageArgs({ ...render, cuts: cuts.slice(0, 1) }));
      assert.ok(!filter.includes('xfade'));
      assert.match(filter, /\[v0\]drawtext/);
    });
  });

  it('장면 캡처는 한 번에 여러 시각을 작은 JPG로', () => {
    const args = frameGrabArgs('a.mp4', [0.5, 2], ['f0.jpg', 'f1.jpg']);
    assert.deepEqual(args.slice(0, 9), ['-y', '-ss', '0.5', '-i', 'a.mp4', '-ss', '2', '-i', 'a.mp4']);
    assert.equal(args.at(-1), 'f1.jpg');
    assert.ok(args.includes('1:v:0'));
  });

  it('고른 영상: 1~3개, 같은 영상은 하나로, 예전 형식도 받는다', () => {
    assert.deepEqual(parseStockPicks({ source: 'pexels', videoId: 7 }), [{ source: 'pexels', videoId: 7 }]);
    assert.deepEqual(
      parseStockPicks({ videos: [{ source: 'pexels', videoId: 7 }, { source: 'pexels', videoId: 7 }, { source: 'pixabay', videoId: '9' }] }),
      [{ source: 'pexels', videoId: 7 }, { source: 'pixabay', videoId: 9 }],
    );
    assert.equal(parseStockPicks({ videos: [1, 2, 3, 4].map((videoId) => ({ source: 'pexels', videoId })) }), null);
    assert.equal(parseStockPicks({ videos: [{ source: 'youtube', videoId: 1 }] }), null);
    assert.equal(parseStockPicks({ videos: [] }), null);
  });
});

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

  it('GIF: 클립을 상세페이지 폭으로, 용량이 크면 단계마다 줄인다', () => {
    const first = heroGifArgs('c.mp4', 'o.gif', 860, GIF_STEPS[0]);
    assert.deepEqual(first.slice(0, 3), ['-y', '-i', 'c.mp4']);
    assert.match(first.join(' '), /fps=12,scale=860:-2/);
    assert.equal(first.at(-1), 'o.gif');
    const last = heroGifArgs('c.mp4', 'o.gif', 860, GIF_STEPS.at(-1)!).join(' ');
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
