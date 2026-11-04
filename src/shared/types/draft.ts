/**
 * 상세페이지 초안 (후커블식 "입력 → 무료 기획 초안 → 생성" 흐름)
 *
 * 입력(DraftInput)은 타이핑하는 대로 자동 저장되고,
 * 기획(DraftPlan)은 섹션 카드 목록 + 색 팔레트 + 사진 분석 결과로 이루어진다.
 * 모든 문장은 근거(evidence)를 달고, 근거 없는 주장은 warnings로 표시된다.
 */
import type { DesignStyleId } from '../lib/designStyles';

export type DraftLength = 'short' | 'long' | 'extra';
/** ai: 올린 사진을 참고해 장면별 연출 사진 생성 / blank: 사진 자리를 비워 두고 에디터에서 직접 넣기 */
export type DraftImageMode = 'ai' | 'blank';
/** 맨 위 사진을 움직이는 컷(GIF)으로 — pan: 무료 줌·이동 / video: AI 영상(유료) */
export type HeroMotion = 'off' | 'pan' | 'video';
/** ai: AI가 참고 사진으로 연출 / own: 올린 사진 그대로 / blank: 빈 자리 */
export type CutSource = 'ai' | 'own' | 'blank';
export type DraftStatus =
  | 'editing'
  | 'composing'
  | 'choosing'
  | 'planning'
  | 'plan_failed'
  | 'ready'
  | 'generating'
  | 'generate_failed'
  | 'completed';
export type PaletteRole = 'main' | 'point' | 'bgLight' | 'bgDark';
export type DraftPalette = Record<PaletteRole, string>;

/** AI가 제안하는 상세페이지 구성 후보 (문구 작성 전 목차·스타일) */
export interface CompositionCandidate {
  id: string;
  title: string;
  reason: string;
  /** conversion | trust | story 등 */
  strategy: string;
  sectionTypeIds: string[];
  sectionNames: string[];
  designStyle: DesignStyleId;
  palette: DraftPalette;
  lengthHint: DraftLength;
  /** GET 시 서버가 붙이는 샘플 레이아웃 미리보기 (저장하지 않음) */
  previewFrames?: unknown[];
}

export interface DraftOption {
  name: string;
  spec: string;
}

export interface DraftCertification {
  name: string;
  number: string;
}

export interface DraftInput {
  startMode: 'new' | 'reuse';
  reuseSourceProjectId: string | null;
  productName: string;
  productImagePaths: string[];
  imageMode: DraftImageMode;
  heroMotion: HeroMotion;
  categoryId: string;
  features: string;
  /** 크기·중량·개수 (예: 한 알 300g 내외, 5kg 15과) — 크기 비교 섹션의 근거 */
  sizeInfo: string;
  /** 맛·식감 또는 사용감 — 판매자가 직접 느낀 표현 */
  sensory: string;
  options: DraftOption[];
  model: { enabled: boolean; description: string; imagePaths: string[] };
  length: DraftLength;
  plan: string;
  reviewsText: string;
  reviewImagePaths: string[];
  /** reference: 색감·분위기·구성만 참고 / my_product: 레퍼런스 구도를 내 상품으로 다시 연출 */
  referenceMode: 'reference' | 'my_product';
  referenceImagePaths: string[];
  brandName: string;
  agri: { origin: string; harvest: string; selection: string; producerStory: string; directShipping: boolean };
  certifications: DraftCertification[];
  salesRecord: string;
  promotion: string;
  facility: string;
  shipping: string;
  contact: string;
}

/** 문장 하나 + 근거 */
export interface DraftLine {
  text: string;
  /** 예: product:name, feature:2, option:1, review, certification:0, agri:origin, photo:3, general */
  evidence: string[];
}

export interface DraftItem {
  title: DraftLine | null;
  text: DraftLine;
}

export type CutRole = 'hero' | 'proof' | 'comparison' | 'benefit' | 'detail';

export interface DraftCut {
  id: string;
  scene: string;
  /** 촬영 지시문 (배경·구도·조명) */
  plan: string;
  role: CutRole;
  source: CutSource;
  /** 참고할 상품 사진 (productImagePaths의 인덱스) */
  photoIndexes: number[];
  modelAllowed: boolean;
  /** 이 사진과 짝인 항목 (없으면 섹션 전체) */
  itemIndex: number | null;
}

export interface DraftSection {
  id: string;
  typeId: string;
  label: DraftLine | null;
  title: DraftLine;
  subtitle: DraftLine | null;
  items: DraftItem[];
  cuts: DraftCut[];
  /** 이 섹션만 참고할 디자인 이미지 */
  referenceImagePath: string | null;
  /** 근거 없는 주장 경고 (사실 검사 결과) */
  warnings: string[];
}

export interface PhotoAnalysis {
  index: number;
  label: string;
  usable: boolean;
  hasPerson: boolean;
  note: string;
}

export interface DraftAnalysis {
  identity: { scale: string; usage: string; material: string; structure: string; colorFinish: string };
  photos: PhotoAnalysis[];
  confirmedFacts: string[];
  coverageNotes: string[];
  /** 리뷰 스크린샷에서 옮겨 적은 실제 후기 문장 */
  reviewQuotes: string[];
}

export interface DraftPlan {
  sections: DraftSection[];
  palette: DraftPalette;
  paletteReason: string;
  /** 디자인 스타일 (이전에 만든 초안에는 없을 수 있음 → 모던) */
  designStyle?: DesignStyleId;
  analysis: DraftAnalysis | null;
}

export interface DraftProgress {
  step: 'photos' | 'colors' | 'facts' | 'matching' | 'copy' | 'done';
  message: string;
  current: number;
  total: number;
  /** 기획 중 먼저 보여줄 섹션 목차 */
  outline: { typeId: string; name: string }[];
}

export interface GenerateProgress {
  current: number;
  total: number;
  message: string;
}

export interface DraftRecord {
  id: string;
  status: DraftStatus;
  input: DraftInput;
  plan: DraftPlan | null;
  /** 구성 후보 5안 (choosing 단계에서 선택) */
  candidates: CompositionCandidate[] | null;
  selectedCandidateId: string | null;
  progress: DraftProgress | null;
  generateProgress: GenerateProgress | null;
  projectId: string | null;
  errorMessage: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftSummary {
  id: string;
  productName: string;
  categoryId: string;
  status: DraftStatus;
  thumbnailUrl: string | null;
  sectionCount: number;
  updatedAt: string;
}

/** 섹션 추가 패널용 섹션 종류 */
export interface SectionTypeInfo {
  id: string;
  name: string;
  description: string;
  group: string;
  layout: string;
  cuts: 'none' | 'one' | 'perItem';
  modelCapable: boolean;
  /** 근거 자료가 없어 지금은 추가할 수 없으면 이유 */
  lockedReason: string | null;
}

export interface PalettePreset {
  palette: DraftPalette;
  reason: string;
}

export interface TonePreset {
  id: string;
  name: string;
  palette: DraftPalette;
}

export interface DraftEstimate {
  sectionCount: number;
  heightPx: number;
  aiCutCount: number;
  ownCutCount: number;
  blankCutCount: number;
  /** 실제로 만들 움직이는 컷 (맨 위 사진 자리가 비면 off) */
  heroMotion: HeroMotion;
  /** Gemini 예상 비용 (달러) */
  costUsd: number;
}

export const emptyDraftInput = (): DraftInput => ({
  startMode: 'new',
  reuseSourceProjectId: null,
  productName: '',
  productImagePaths: [],
  imageMode: 'ai',
  heroMotion: 'pan',
  categoryId: '',
  features: '',
  sizeInfo: '',
  sensory: '',
  options: [],
  model: { enabled: false, description: '', imagePaths: [] },
  length: 'short',
  plan: '',
  reviewsText: '',
  reviewImagePaths: [],
  referenceMode: 'reference',
  referenceImagePaths: [],
  brandName: '',
  agri: { origin: '', harvest: '', selection: '', producerStory: '', directShipping: false },
  certifications: [],
  salesRecord: '',
  promotion: '',
  facility: '',
  shipping: '',
  contact: '',
});

export const DRAFT_LIMITS = {
  productName: 200,
  productImages: 10,
  features: 4000,
  sizeInfo: 300,
  sensory: 500,
  options: 10,
  modelDescription: 80,
  plan: 3000,
  reviewsText: 20000,
  referenceImages: 10,
  sectionTitle: 200,
} as const;
