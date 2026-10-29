import httpClient from '@/shared/lib/httpClient';
import type {
  DraftEstimate,
  DraftInput,
  DraftPalette,
  DraftPlan,
  DraftRecord,
  DraftSummary,
  PalettePreset,
  SectionTypeInfo,
  TonePreset,
} from '@/shared/types/draft';
/** 초안 API (`/api/lever/functions/v1/drafts/...`) */
const BASE = '/functions/v1';

export interface DraftDto extends DraftRecord {
  imageUrls: Record<string, string>;
  previews: Record<string, PreviewNode>;
  estimate: DraftEstimate;
  sectionTypes: SectionTypeInfo[];
}

/** 섹션 미리보기용 프레임 (서버 레이아웃 결과) */
export interface PreviewNode {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  letterSpacing?: number;
  align?: string;
  lineHeight?: number;
  cornerRadius?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cutId?: string;
  children?: PreviewNode[];
}

export interface ReuseSource {
  id: string;
  title: string;
  categoryId: string;
  sectionCount: number;
  palette: DraftPalette;
  thumbnailUrl: string | null;
  updatedAt: string;
}

export interface PaletteCatalog {
  roles: { role: keyof DraftPalette; label: string; description: string }[];
  presets: PalettePreset[];
  tones: TonePreset[];
}

type Wrapped<T> = { data: T };
const unwrap = <T>(promise: Promise<Wrapped<T>>) => promise.then((res) => res.data);
const opts = { withAuth: true } as const;

export const draftApi = {
  list: () => unwrap(httpClient.get<Wrapped<{ drafts: DraftSummary[] }>>(`${BASE}/drafts`, opts)),
  create: (input: Partial<DraftInput>) => unwrap(httpClient.post<Wrapped<DraftDto>>(`${BASE}/drafts`, { input }, opts)),
  get: (id: string) => unwrap(httpClient.get<Wrapped<DraftDto>>(`${BASE}/drafts/${id}`, opts)),
  patch: (id: string, body: { input?: DraftInput; plan?: DraftPlan }) =>
    unwrap(httpClient.patch<Wrapped<DraftDto>>(`${BASE}/drafts/${id}`, body, opts)),
  remove: (id: string) => unwrap(httpClient.delete<Wrapped<{ id: string }>>(`${BASE}/drafts/${id}`, opts)),
  autofill: (id: string) => unwrap(httpClient.post<Wrapped<DraftDto>>(`${BASE}/drafts/${id}/autofill`, {}, opts)),
  planGuide: (id: string) => unwrap(httpClient.get<Wrapped<{ prompt: string }>>(`${BASE}/drafts/${id}/plan-guide`, opts)),
  plan: (id: string) => unwrap(httpClient.post<Wrapped<DraftDto>>(`${BASE}/drafts/${id}/plan`, {}, opts)),
  addSection: (id: string, typeId: string, index: number) =>
    unwrap(httpClient.post<Wrapped<DraftDto>>(`${BASE}/drafts/${id}/sections`, { typeId, index }, opts)),
  shufflePalettes: (id: string) =>
    unwrap(httpClient.post<Wrapped<{ presets: PalettePreset[] }>>(`${BASE}/drafts/${id}/palette/shuffle`, {}, opts)),
  generate: (id: string) => unwrap(httpClient.post<Wrapped<DraftDto>>(`${BASE}/drafts/${id}/generate`, {}, opts)),
  reuseSources: (categoryId?: string) =>
    unwrap(
      httpClient.get<Wrapped<{ projects: ReuseSource[] }>>(`${BASE}/drafts/reuse-sources`, {
        ...opts,
        queryParams: categoryId ? { categoryId } : undefined,
      }),
    ),
  palettes: (categoryId: string) =>
    unwrap(httpClient.get<Wrapped<PaletteCatalog>>(`${BASE}/palettes`, { ...opts, queryParams: { categoryId } })),
};
