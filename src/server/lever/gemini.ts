import 'server-only';
import { canFallback, TEXT_MODELS, type TextTier } from './geminiModels';
import { ApiError } from './http';
import { writeCopyWithOpenAI } from './openaiCopy';
import { getCopyModel, getGeminiApiKey } from './settings';
import { parseVideoResponse, videoRequestBody, type ParsedVideo, type VideoAspect } from './media/motion';
import { loadFile, mimeFromPath, toStoragePath } from './storage';

/**
 * Gemini REST 클라이언트 (레버페이지와 동일하게 사용자가 등록한 Gemini API 키 사용)
 * - 텍스트: JSON 응답 모드 (판매 문구는 copy 등급 — OpenAI 키가 있으면 GPT, 나머지는 fast 등급)
 * - 이미지: 상품 사진을 참조 이미지로 넣어 같은 상품이 유지되도록 생성
 */
const API = 'https://generativelanguage.googleapis.com/v1beta';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

export interface InlineImage {
  mimeType: string;
  data: string;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;

/** 이미지 자리 비율에 가장 가까운 Gemini 지원 비율 */
export function closestAspectRatio(width: number, height: number) {
  const target = width > 0 && height > 0 ? width / height : 1;
  const ratioOf = (r: string) => {
    const [w, h] = r.split(':').map(Number);
    return w / h;
  };
  return ASPECT_RATIOS.reduce((best, r) =>
    Math.abs(Math.log(ratioOf(r) / target)) < Math.abs(Math.log(ratioOf(best) / target)) ? r : best,
  );
}

interface GeminiPart {
  text?: string;
  inlineData?: InlineImage;
  thought?: boolean;
}

interface Fallback {
  model: string;
  generationConfig: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

const toApiError = (status: number, body: GeminiResponse) => {
  const message = body.error?.message ?? '';
  if (status === 400 && /api key/i.test(message)) return new ApiError(400, 'Gemini API 키가 올바르지 않습니다. API 키 설정을 확인해주세요.');
  if (status === 403) return new ApiError(400, 'Gemini API 키에 권한이 없습니다. Google AI Studio에서 키를 확인해주세요.');
  // 429·5xx는 클라이언트가 재시도하도록 503으로 돌려준다
  if (status === 429) return new ApiError(503, 'Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
  if (status >= 500) return new ApiError(503, 'Gemini 서버가 일시적으로 응답하지 않습니다.');
  return new ApiError(400, `Gemini 요청 오류: ${message || status}`);
};

/** 모델 답(```json 감싸기 허용) → 객체, 해석 못 하면 null */
function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } catch {
    return null;
  }
}

export class GeminiClient {
  constructor(private apiKey: string) {}

  private async generate(
    model: string,
    parts: GeminiPart[],
    generationConfig: Record<string, unknown>,
    fallback?: Fallback,
  ): Promise<GeminiPart[]> {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      if (fallback && canFallback(res.status, body.error?.message ?? '')) {
        console.warn(`[lever] ${model} 응답 실패(${res.status}) → ${fallback.model}로 다시 시도`);
        return this.generate(fallback.model, parts, fallback.generationConfig);
      }
      throw toApiError(res.status, body);
    }
    if (body.promptFeedback?.blockReason) {
      throw new ApiError(400, '안전 정책으로 생성이 거절되었습니다. 문구나 이미지를 바꿔 다시 시도해주세요.');
    }
    return body.candidates?.[0]?.content?.parts ?? [];
  }

  /**
   * JSON으로 답하게 하고 파싱해서 반환
   * @param tier 'copy'면 판매 문구용 — 설정에서 GPT를 골랐고 OpenAI 키가 있으면 GPT가 먼저 쓰고,
   *   Gemini를 골랐거나 GPT가 실패하면 Gemini 최상위 모델 → fast 모델 순으로 시도한다
   */
  async generateJson<T>(prompt: string, images: InlineImage[] = [], tier: TextTier = 'fast'): Promise<T> {
    if (tier === 'copy' && (await getCopyModel()) === 'gpt') {
      const written = await writeCopyWithOpenAI(prompt, images);
      const parsed = written === null ? null : parseJson<T>(written);
      if (parsed !== null) return parsed;
    }
    const { model, generationConfig } = TEXT_MODELS[tier];
    const fast = TEXT_MODELS.fast;
    const parts = await this.generate(
      model,
      [{ text: prompt }, ...images.map((inlineData) => ({ inlineData }))],
      generationConfig,
      model === fast.model ? undefined : fast,
    );
    const parsed = parseJson<T>(
      parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join(''),
    );
    if (parsed === null) throw new ApiError(503, 'AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
    return parsed;
  }

  async generateImage(prompt: string, references: InlineImage[], aspectRatio: string) {
    const parts = await this.generate(
      IMAGE_MODEL,
      [...references.map((inlineData) => ({ inlineData })), { text: prompt }],
      { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
    );
    const image = parts.find((p) => p.inlineData?.data)?.inlineData;
    if (!image) throw new ApiError(503, '이미지가 생성되지 않았습니다. 다시 시도해주세요.');
    return { mimeType: image.mimeType || 'image/png', data: Buffer.from(image.data, 'base64') };
  }

  /** 사진 → 짧은 영상 (Gemini Omni, Interactions API · 1~3분 걸림) → MP4 */
  async generateVideo(image: InlineImage, prompt: string, aspect: VideoAspect) {
    const res = await fetch(`${API}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(videoRequestBody(image, prompt, aspect)),
      cache: 'no-store',
      signal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw toApiError(res.status, body);
    let video: ParsedVideo;
    try {
      video = parseVideoResponse(body);
    } catch (err) {
      throw new ApiError(503, `AI 영상: ${err instanceof Error ? err.message : '응답을 해석하지 못했어요'}`);
    }
    return video.kind === 'data' ? Buffer.from(video.data, 'base64') : this.downloadVideo(video.uri);
  }

  /** 큰 영상은 주소로 오고, 처리가 끝날 때까지 잠깐 기다려야 받을 수 있다 */
  private async downloadVideo(uri: string) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const res = await fetch(uri, { headers: { 'x-goog-api-key': this.apiKey }, cache: 'no-store', signal: AbortSignal.timeout(60_000) });
      if (res.ok && res.headers.get('content-type')?.startsWith('video/')) return Buffer.from(await res.arrayBuffer());
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    throw new ApiError(503, 'AI 영상을 내려받지 못했어요. 다시 시도해주세요.');
  }
}

/** undici 기본 응답 대기(300초)보다 조금 짧게 — 넘으면 실패로 처리하고 줌·이동으로 대신한다 */
const VIDEO_TIMEOUT_MS = 290_000;

export async function requireGemini() {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new ApiError(400, 'Gemini API 키를 먼저 등록해주세요. (프로필 메뉴 → API 키 설정)');
  return new GeminiClient(apiKey);
}

/** 키 저장 전 유효성 확인 (모델 목록 조회) */
export async function isValidGeminiKey(apiKey: string) {
  const res = await fetch(`${API}/models?pageSize=1`, {
    headers: { 'x-goog-api-key': apiKey },
    cache: 'no-store',
  });
  return res.ok;
}

/** 저장소 이미지(경로 또는 /api/lever/storage URL) → Gemini inline 이미지 */
export async function loadInlineImage(urlOrPath: string): Promise<InlineImage | null> {
  const storagePath = toStoragePath(urlOrPath);
  const data = await loadFile(storagePath);
  return data ? { mimeType: mimeFromPath(storagePath), data: data.toString('base64') } : null;
}

export async function loadInlineImages(paths: string[], max: number) {
  const images = await Promise.all(paths.slice(0, max).map(loadInlineImage));
  return images.filter((image): image is InlineImage => image !== null);
}
