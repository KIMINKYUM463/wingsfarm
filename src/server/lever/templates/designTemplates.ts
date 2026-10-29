import { DEFAULT_DESIGN_STYLE, DESIGN_STYLE_OPTIONS } from '@/shared/lib/designStyles';
import { derivePalette, TONE_PRESETS } from '@/shared/lib/palette';
import type { DraftCut, DraftLine, DraftSection } from '@/shared/types/draft';
import type { SectionLayout } from '../catalog/sections';
import { walk, type FrameNode } from '../frames/tree';
import { textNode } from './nodes';
import { buildSectionFrame } from './sectionLayouts';

/**
 * 편집기 "템플릿" 탭용 스타일 템플릿 (레이아웃 14종 × 디자인 스타일 4종 + 안내문 1종)
 *
 * 초안 생성과 같은 레이아웃 엔진으로 만들기 때문에 모양이 똑같고, 팔레트 색(colorVar)도 연결돼 있다.
 * 후기·인증·배송처럼 사실이어야 하는 문구는 [ ] 자리표시로 남겨 판매자가 직접 채우게 한다.
 */
interface Sample {
  layout: SectionLayout;
  name: string;
  /** 템플릿 탭 구성 (builtin.ts의 PART2_ORDER) */
  part2: string;
  cuts: 'none' | 'one' | 'perItem';
  label?: string;
  title: string;
  subtitle?: string;
  items: [title: string | null, text: string][];
  /** 숨김 prompt 노드 — AI 문구 채우기 가이드 */
  guide: string;
}

const SAMPLES: Sample[] = [
  {
    layout: 'hero',
    name: '메인 비주얼',
    part2: '메인 비주얼',
    cuts: 'one',
    label: 'BRAND NAME',
    title: '고객이 얻는 결과를\n한 줄로 보여 주세요',
    subtitle: '상품을 한 문장으로 소개하는 서브 문구',
    items: [[null, '핵심 혜택 1'], [null, '핵심 혜택 2'], [null, '핵심 혜택 3']],
    guide: '1. 라벨: 브랜드·산지 (10자 이내)\n2. 메인 카피: 기능이 아니라 고객이 얻는 결과 (2줄, 줄당 12자 이내)\n3. 서브 카피 (30자 내외)\n4. 혜택 배지 3개 (각 8자 이내)',
  },
  {
    layout: 'visual',
    name: '공감 비주얼',
    part2: '문제 제기',
    cuts: 'one',
    label: 'WHY',
    title: '이런 고민, 있으셨죠?',
    subtitle: '고객이 겪는 불편을 한 문장으로 짚어 주세요',
    items: [['고민 하나', '고객이 실제로 느끼는 불편을 구체적으로 적어 주세요.'], ['고민 둘', '그 불편 때문에 생기는 상황을 적어 주세요.']],
    guide: '1. 메인 카피: 고객의 고민을 질문형으로 (15자 이내)\n2. 고민 2~3개: 제목 8자 + 설명 1~2문장',
  },
  {
    layout: 'story',
    name: '브랜드 스토리',
    part2: '호기심 유발',
    cuts: 'one',
    label: 'STORY',
    title: '이 상품이 만들어지기까지',
    subtitle: '누가, 어디서, 어떻게 만드는지 들려주세요',
    items: [['시작', '이 상품을 만들게 된 이유를 적어 주세요.'], ['정성', '만드는 과정에서 지키는 원칙을 적어 주세요.']],
    guide: '1. 메인 카피: 스토리 제목 (15자 이내)\n2. 문단 2개: 소제목 + 2~3문장 (확인된 사실만)',
  },
  {
    layout: 'points',
    name: '핵심 포인트',
    part2: '핵심 포인트',
    cuts: 'perItem',
    label: 'POINT',
    title: '꼭 알아야 할 세 가지',
    items: [['첫 번째 강점', '강점이 고객에게 주는 이득을 한두 문장으로 적어 주세요.'], ['두 번째 강점', '사진과 함께 보여 줄 장점을 적어 주세요.'], ['세 번째 강점', '다른 상품과 다른 점을 적어 주세요.']],
    guide: '1. 메인 카피 (15자 이내)\n2. 포인트 3개: 제목 12자 + 설명 1~2문장 + 포인트별 사진',
  },
  {
    layout: 'grid',
    name: '장점 카드',
    part2: '핵심 포인트',
    cuts: 'none',
    label: 'BENEFIT',
    title: '한눈에 보는 장점',
    items: [['장점 1', '짧은 설명'], ['장점 2', '짧은 설명'], ['장점 3', '짧은 설명'], ['장점 4', '짧은 설명']],
    guide: '1. 메인 카피 (12자 이내)\n2. 장점 카드 4개: 제목 8자 + 설명 15자',
  },
  {
    layout: 'compare',
    name: '비교표',
    part2: '상품 특징',
    cuts: 'one',
    label: 'COMPARE',
    title: '무엇이 다를까요?',
    items: [['확인할 점 1', '이 상품의 특징'], ['확인할 점 2', '이 상품의 특징'], ['확인할 점 3', '이 상품의 특징']],
    guide: '1. 메인 카피 (12자 이내)\n2. 비교 항목 3~4개: 왼쪽 확인할 점(8자) / 오른쪽 이 상품의 사실(20자)\n※ 다른 상품을 깎아내리지 말고 이 상품의 사실만',
  },
  {
    layout: 'steps',
    name: '사용 순서',
    part2: '상품 특징',
    cuts: 'none',
    label: 'HOW TO',
    title: '이렇게 사용해요',
    items: [['준비해요', '첫 단계를 적어 주세요.'], ['사용해요', '두 번째 단계를 적어 주세요.'], ['보관해요', '마지막 단계를 적어 주세요.']],
    guide: '1. 메인 카피 (12자 이내)\n2. 단계 3~4개: 제목 8자 + 설명 1문장',
  },
  {
    layout: 'size',
    name: '크기·구성',
    part2: '상세 정보',
    cuts: 'one',
    label: 'SIZE',
    title: '크기와 구성',
    items: [['크기', '[가로 × 세로 × 높이]'], ['무게', '[중량]'], ['구성', '[구성품]']],
    guide: '1. 메인 카피 (10자 이내)\n2. 크기·무게·구성: 입력한 사실 그대로',
  },
  {
    layout: 'table',
    name: '상품 정보표',
    part2: '상세 정보',
    cuts: 'none',
    label: 'INFO',
    title: '상품 정보',
    items: [['상품명', '[상품명]'], ['원산지', '[원산지]'], ['중량·수량', '[중량·수량]'], ['보관 방법', '[보관 방법]'], ['소비기한', '[소비기한]']],
    guide: '1. 메인 카피 (10자 이내)\n2. 표 4~6행: 항목명 / 입력한 사실 그대로',
  },
  {
    layout: 'reviews',
    name: '고객 후기',
    part2: '고객 후기',
    cuts: 'none',
    label: 'REVIEW',
    title: '먼저 써 본 분들의 이야기',
    items: [['[작성자]', '[실제 구매 후기를 그대로 옮겨 적어 주세요]'], ['[작성자]', '[실제 구매 후기를 그대로 옮겨 적어 주세요]']],
    guide: '1. 메인 카피 (15자 이내)\n2. 후기 2~3개: 실제 후기 원문만 (지어내지 않기)',
  },
  {
    layout: 'badges',
    name: '인증',
    part2: '고객 후기',
    cuts: 'none',
    label: 'CERTIFIED',
    title: '믿을 수 있는 인증',
    items: [['[인증명]', '[인증번호]'], ['[인증명]', '[인증번호]']],
    guide: '1. 메인 카피 (12자 이내)\n2. 인증 1~4개: 인증명 / 인증번호 (실제 인증만)',
  },
  {
    layout: 'faq',
    name: '자주 묻는 질문',
    part2: '구매 안내',
    cuts: 'none',
    label: 'FAQ',
    title: '자주 묻는 질문',
    items: [['배송은 얼마나 걸리나요?', '[출고 기준과 배송 기간을 적어 주세요]'], ['교환·환불이 되나요?', '[교환·환불 조건을 적어 주세요]'], ['보관은 어떻게 하나요?', '[보관 방법을 적어 주세요]']],
    guide: '1. 메인 카피 (10자 이내)\n2. 질문 3~5개: 질문 20자 / 답변 1~2문장 (판매 정보 그대로)',
  },
  {
    layout: 'cta',
    name: '구매 유도',
    part2: '구매 안내',
    cuts: 'one',
    label: 'NOW',
    title: '지금 만나 보세요',
    subtitle: '마지막으로 한 번 더 핵심 혜택을 알려 주세요',
    items: [[null, '[혜택 1]'], [null, '[혜택 2]']],
    guide: '1. 메인 카피: 구매를 권하는 한 줄 (12자 이내)\n2. 서브 카피 (25자 내외)\n3. 혜택 1~3개 (실제 혜택만)',
  },
  {
    layout: 'contact',
    name: '고객센터',
    part2: '구매 안내',
    cuts: 'none',
    label: 'CONTACT',
    title: '궁금한 점은 언제든 물어보세요',
    items: [['전화', '[000-0000-0000]'], ['운영 시간', '[평일 09:00 ~ 18:00]'], ['채팅 상담', '[채널 이름]']],
    guide: '1. 메인 카피 (15자 이내)\n2. 연락처 2~4줄: 항목 / 판매 정보 그대로',
  },
  {
    layout: 'notice',
    name: '구매 전 확인',
    part2: '구매 안내',
    cuts: 'none',
    title: '구매 전 꼭 확인해 주세요',
    items: [[null, '[상품 특성상 생길 수 있는 차이를 적어 주세요]'], [null, '[교환·반품이 어려운 경우를 적어 주세요]']],
    guide: '안내 문구 2~4줄 (작은 글씨, 판매 정보 그대로)',
  },
];

const line = (text: string): DraftLine => ({ text, evidence: ['general'] });

const sampleCut = (id: string, itemIndex: number | null): DraftCut => ({
  id,
  scene: '',
  plan: '',
  role: 'detail',
  source: 'own',
  photoIndexes: [],
  modelAllowed: false,
  itemIndex,
});

function toSection(sample: Sample, slug: string): DraftSection {
  const cuts =
    sample.cuts === 'one' ? [sampleCut(`${slug}-cut`, null)] : sample.cuts === 'perItem' ? sample.items.map((_, i) => sampleCut(`${slug}-cut-${i}`, i)) : [];
  return {
    id: slug,
    typeId: sample.layout,
    label: sample.label ? line(sample.label) : null,
    title: line(sample.title),
    subtitle: sample.subtitle ? line(sample.subtitle) : null,
    items: sample.items.map(([title, text]) => ({ title: title ? line(title) : null, text: line(text) })),
    cuts,
    referenceImagePath: null,
    warnings: [],
  };
}

/** 초안 전용 연결 정보(cutId·sectionTypeId)를 지우고, 숨김 prompt 가이드를 붙인다 */
function finalize(frame: FrameNode, slug: string, guide: string): FrameNode {
  for (const node of walk(frame)) {
    delete node.cutId;
    delete node.sectionTypeId;
  }
  const prompt: FrameNode = {
    ...textNode(`${slug}-prompt`, guide, 30, 30, 800, 28, { color: 'rgba(255, 0, 0, 1)', align: 'left', lines: guide.split('\n').length }),
    name: 'prompt',
    visible: false,
  };
  return { ...frame, children: [...(frame.children ?? []), prompt] };
}

export interface DesignTemplate {
  slug: string;
  part2: string;
  frame: FrameNode;
}

export function buildDesignTemplates(): DesignTemplate[] {
  return DESIGN_STYLE_OPTIONS.flatMap((style) => {
    const tone = TONE_PRESETS.find((t) => t.id === style.toneId) ?? TONE_PRESETS[0];
    const palette = derivePalette(tone.main);
    // 작은 안내문(notice)은 스타일과 상관없이 같은 모양이라 기본 스타일에만 둔다
    return SAMPLES.filter((sample) => sample.layout !== 'notice' || style.id === DEFAULT_DESIGN_STYLE).map((sample) => {
      const slug = `ds-${style.id}-${sample.layout}`;
      const type = { id: sample.layout, name: `${style.name} · ${sample.name}`, layout: sample.layout, cuts: sample.cuts };
      const frame = buildSectionFrame(toSection(sample, slug), type, palette, style.id);
      return { slug, part2: sample.part2, frame: finalize(frame, slug, sample.guide) };
    });
  });
}
