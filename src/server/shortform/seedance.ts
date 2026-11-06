/**
 * 농부 소개 영상 — ByteDance Seedance 2.5 (Replicate).
 * 1) 상품 사진으로 산지 농부 스틸을 만들고
 * 2) 그 스틸을 첫 프레임으로 농부가 대사하는 세로 영상을 만든다.
 * 목소리는 모델이 같이 만든다. 호출측은 이 오디오를 지우지 않는다.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { produceIdentity } from '@/server/lever/media/stockQuery';
import { REPLICATE_IMAGE, runReplicate, replicateToken } from '@/server/shortform/aiScene';

const SEEDANCE = 'bytedance/seedance-2.5';
/** 이미지 입력 기준 480p가 이 모델의 가장 싼 해상도(초당 약 $0.10). 720p는 약 $0.23. */
const SEEDANCE_RESOLUTION = '480p';

function clipDir(folder: string) {
  return path.join(process.cwd(), 'shortform', 'products', folder, '_clips');
}

function asUrl(output: unknown): string {
  if (typeof output === 'string' && /^https?:\/\//.test(output)) return output;
  if (output && typeof output === 'object' && 'url' in output) {
    const url = String((output as { url?: unknown }).url || '');
    if (/^https?:\/\//.test(url)) return url;
  }
  throw new Error('시댄스 결과 주소를 읽지 못했어요');
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`영상 다운로드 실패 ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function lookOf(product: Record<string, unknown>) {
  const name = String(product.name || '');
  return produceIdentity(name)?.look || name || 'fresh Korean farm produce';
}

/** 시댄스는 4~15초 정수를 받는다. 장면 나레이션에 맞춰 그 안으로 자른다. */
export function seedanceSeconds(seconds: number) {
  return Math.max(4, Math.min(8, Math.round(seconds || 5)));
}

/**
 * 농부가 이 장면 대사를 말하는 클립.
 * 실패하면 null — 호출측이 산지 사진 영상으로 넘어간다.
 */
export async function generateFarmerScene(
  product: Record<string, unknown>,
  productFolder: string,
  photo: Buffer,
  script: string,
  seconds: number,
  sceneIndex: number,
  log?: (m: string) => Promise<void> | void,
  extra?: Buffer | null,
): Promise<{ path: string; seconds: number } | null> {
  if (!replicateToken()) {
    await log?.('REPLICATE_API_TOKEN이 없어 농부 소개(시댄스 2.5)를 만들 수 없어요');
    return null;
  }
  const line = script.replace(/\*/g, '').trim().slice(0, 80) || '오늘 수확한 거예요.';
  const dur = seedanceSeconds(seconds);
  const sig = createHash('sha1').update(`${line}|${dur}`).digest('hex').slice(0, 8);
  const dir = clipDir(productFolder);
  await mkdir(dir, { recursive: true });
  const still = path.join(dir, `farmer_s${sceneIndex}_${sig}.jpg`);
  const out = path.join(dir, `farmer_s${sceneIndex}_${sig}_480.mp4`);
  if (existsSync(out)) {
    await log?.(`농부 소개 캐시: 장면${sceneIndex + 1}`);
    return { path: out, seconds: dur };
  }

  const produce = lookOf(product);
  const images = [`data:image/jpeg;base64,${photo.toString('base64')}`];
  if (extra?.length) images.push(`data:image/jpeg;base64,${extra.toString('base64')}`);

  try {
    if (!existsSync(still)) {
      await log?.(`농부 스틸 생성 (장면${sceneIndex + 1}) · 상품 생김새를 유지`);
      const stillUrl = asUrl(
        await runReplicate(REPLICATE_IMAGE, {
          prompt:
            `Photorealistic vertical smartphone photo of a Korean farmer in their 50s at a real farm, ` +
            `holding this exact produce: ${produce}. Weathered hands, work clothes, natural daylight, soil and leaves. ` +
            `The farmer looks at the camera, mouth closed. No text, no logo, no watermark. ` +
            `Do not change the produce into a different variety.`,
          image_input: images.slice(0, 2),
          aspect_ratio: '9:16',
          resolution: '2K',
          output_format: 'jpg',
        }),
      );
      await download(stillUrl, still);
    }

    const start = `data:image/jpeg;base64,${(await readFile(still)).toString('base64')}`;
    const prompt =
      `The same farmer looks into the phone camera and says in Korean, with matching lip movement, only this line: "${line}". ` +
      `Slight handheld motion, breeze in the leaves, they lift the produce a little. No subtitles, no watermark, no background music sting.`;
    await log?.(`시댄스 2.5 농부 소개 ${dur}초 · 480p (장면${sceneIndex + 1}, 수 분 걸릴 수 있어요)`);

    const input = {
      prompt,
      image: start,
      duration: dur,
      aspect_ratio: '9:16',
      resolution: SEEDANCE_RESOLUTION,
      generate_audio: true,
    };
    let videoUrl: string;
    try {
      videoUrl = asUrl(await runReplicate(SEEDANCE, input, 150));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log?.(`시댄스 첫 호출 실패, 참고 이미지 방식으로 다시 시도: ${msg.slice(0, 180)}`);
      videoUrl = asUrl(
        await runReplicate(
          SEEDANCE,
          {
            prompt,
            reference_images: [start],
            duration: dur,
            aspect_ratio: 'adaptive',
            resolution: SEEDANCE_RESOLUTION,
            generate_audio: true,
          },
          150,
        ),
      );
    }
    await download(videoUrl, out);
    return { path: out, seconds: dur };
  } catch (err) {
    await log?.(`농부 소개 실패: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export type UccWho = 'man' | 'woman';
export type UccRole = 'farmer' | 'fisher';

/** 한 편은 15초. 30초·720p는 초당 요금이 커서 쓰지 않는다. */
const UCC_SECONDS = 15;

/**
 * UCC 한 편. 한국 시니어 농부 또는 어부가 상품을 소개한다.
 * 길이는 15초, 해상도는 480p.
 */
export async function generateUccVideo(
  product: Record<string, unknown>,
  productFolder: string,
  photo: Buffer,
  script: string,
  who: UccWho,
  role: UccRole,
  log?: (m: string) => Promise<void> | void,
  extra?: Buffer | null,
): Promise<{ path: string; seconds: number } | null> {
  if (!replicateToken()) {
    await log?.('REPLICATE_API_TOKEN이 없어 UCC(시댄스 2.5)를 만들 수 없어요');
    return null;
  }
  const line = script.replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || '오늘 나온 상품을 소개할게요.';
  const person = who === 'woman' ? 'Korean woman in her 60s with grey hair tied back' : 'Korean man in his 60s with short grey hair';
  const place = role === 'fisher'
    ? 'a fisherman on a small fishing boat at a Korean harbor, wearing a work jacket'
    : 'a farmer in a Korean field or orchard, wearing work clothes';
  const sig = createHash('sha1').update(`${who}|${role}|${line}`).digest('hex').slice(0, 8);
  const dir = clipDir(productFolder);
  await mkdir(dir, { recursive: true });
  const still = path.join(dir, `ucc_${sig}.jpg`);
  const out = path.join(dir, `ucc_${sig}_${UCC_SECONDS}_480.mp4`);
  if (existsSync(out)) {
    await log?.(`UCC 캐시 ${UCC_SECONDS}초 · 480p`);
    return { path: out, seconds: UCC_SECONDS };
  }

  const produce = lookOf(product);
  const images = [`data:image/jpeg;base64,${photo.toString('base64')}`];
  if (extra?.length) images.push(`data:image/jpeg;base64,${extra.toString('base64')}`);

  try {
    if (!existsSync(still)) {
      await log?.(`UCC 스틸 · ${who === 'woman' ? '여자' : '남자'} 시니어 ${role === 'fisher' ? '어부' : '농부'}`);
      const stillUrl = asUrl(
        await runReplicate(REPLICATE_IMAGE, {
          prompt:
            `Photorealistic vertical smartphone photo of a ${person}, ${place}, holding this exact produce: ${produce}. ` +
            `Weathered face, natural daylight, looking at the camera, mouth closed. No text, no logo. Do not change the produce.`,
          image_input: images.slice(0, 2),
          aspect_ratio: '9:16',
          resolution: '2K',
          output_format: 'jpg',
        }),
      );
      await download(stillUrl, still);
    }
    const start = `data:image/jpeg;base64,${(await readFile(still)).toString('base64')}`;
    const prompt =
      `The same senior ${role === 'fisher' ? 'fisherman' : 'farmer'} looks into the phone and introduces the product in Korean for the full clip, with matching lip movement. ` +
      `They say: "${line}". If the line is short, keep introducing where it was caught or grown and how fresh it looks until the video ends. ` +
      `Handheld, daylight, no subtitles, no logo, no music sting.`;

    await log?.(`시댄스 2.5 UCC ${UCC_SECONDS}초 · 480p (수 분 걸릴 수 있어요)`);
    const videoUrl = asUrl(
      await runReplicate(
        SEEDANCE,
        {
          prompt,
          image: start,
          duration: UCC_SECONDS,
          aspect_ratio: '9:16',
          resolution: SEEDANCE_RESOLUTION,
          generate_audio: true,
        },
        150,
      ),
    );
    await download(videoUrl, out);
    return { path: out, seconds: UCC_SECONDS };
  } catch (err) {
    await log?.(`UCC 실패: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
