import 'server-only';
import { randomBytes } from 'node:crypto';
import { readJson, updateJson } from './store';

const FILE = 'settings.json';

export interface FigmaConfig {
  token: string;
  fileKey: string;
}

interface LeverSettings {
  /** 업로드 URL 서명용 비밀값 (최초 실행 시 생성) */
  secret?: string;
  geminiApiKey?: string;
  figma?: Partial<FigmaConfig>;
}

export const readSettings = () => readJson<LeverSettings>(FILE, {});

export const updateSettings = (mutate: (current: LeverSettings) => LeverSettings) =>
  updateJson<LeverSettings>(FILE, {}, mutate);

export async function getSecret() {
  const { secret } = await readSettings();
  if (secret) return secret;
  return (await updateSettings((s) => ({ ...s, secret: s.secret ?? randomBytes(32).toString('hex') })))
    .secret!;
}

/** 화면에서 등록한 키 우선, 없으면 .env.local의 GEMINI_API_KEY */
export async function getGeminiApiKey(): Promise<string | null> {
  const { geminiApiKey } = await readSettings();
  return geminiApiKey || process.env.GEMINI_API_KEY || null;
}

export const maskKey = (key: string) =>
  key.length <= 8 ? '••••••••' : `${key.slice(0, 4)}${'•'.repeat(12)}${key.slice(-4)}`;

/** GET /settings/api-keys 응답 (미등록이면 null) */
export async function getApiKeyInfo() {
  const key = await getGeminiApiKey();
  return key ? { id: 'gemini', maskedKey: maskKey(key), isActive: true } : null;
}

/** 화면 등록값 우선, 없으면 FIGMA_ACCESS_TOKEN / FIGMA_FILE_ID 환경 변수 */
export async function getFigmaConfig(): Promise<Partial<FigmaConfig>> {
  const { figma } = await readSettings();
  return {
    token: figma?.token || process.env.FIGMA_ACCESS_TOKEN || '',
    fileKey: figma?.fileKey || process.env.FIGMA_FILE_ID || '',
  };
}
