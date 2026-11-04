/**
 * 구성 후보 → 샘플 섹션 프레임 미리보기
 * (실제 카피 전, 레이아웃·색·스타일만 보여 준다)
 */
import type { CompositionCandidate, DraftCut, DraftInput, DraftSection } from '@/shared/types/draft';
import { findSectionType } from '../catalog/sections';
import type { FrameNode } from '../frames/tree';
import { buildSectionFrame, expectedCutCount } from '../templates/sectionLayouts';

const line = (text: string) => ({ text, evidence: ['general'] as string[] });

function sampleCuts(typeCuts: 'none' | 'one' | 'perItem', itemCount: number): DraftCut[] {
  const n = expectedCutCount({ cuts: typeCuts }, itemCount);
  return Array.from({ length: n }, (_, i) => ({
    id: `preview-cut-${i}`,
    scene: '미리보기',
    plan: '',
    role: i === 0 ? 'hero' : 'detail',
    source: 'own' as const,
    photoIndexes: [0],
    modelAllowed: false,
    itemIndex: typeCuts === 'perItem' ? i : null,
  }));
}

function sampleSection(typeId: string, categoryId: string, productName: string, index: number): DraftSection | null {
  const type = findSectionType(categoryId, typeId);
  if (!type) return null;
  const [minItems] = type.items;
  const itemCount = Math.max(minItems, type.cuts === 'perItem' ? 3 : minItems);
  const name = productName.trim() || '샘플 상품';
  return {
    id: `preview-${typeId}-${index}`,
    typeId,
    label: { text: type.name, evidence: ['general'] },
    title: line(index === 0 ? name.slice(0, 22) : `${type.name}`),
    subtitle: line('샘플 문구 · 레이아웃 미리보기'),
    items: Array.from({ length: itemCount }, (_, i) => ({
      title: line(`포인트 ${i + 1}`),
      text: line('실제 문구는 구성 선택 후 채워져요'),
    })),
    cuts: sampleCuts(type.cuts, itemCount),
    referenceImagePath: null,
    warnings: [],
  };
}

/** 후보 1안의 섹션들을 이어 붙인 미리보기 프레임 목록 */
export function buildCandidatePreviewFrames(
  candidate: CompositionCandidate,
  input: Pick<DraftInput, 'categoryId' | 'productName'>,
): FrameNode[] {
  const frames: FrameNode[] = [];
  candidate.sectionTypeIds.forEach((typeId, index) => {
    const type = findSectionType(input.categoryId, typeId);
    const section = sampleSection(typeId, input.categoryId, input.productName, index);
    if (!type || !section) return;
    try {
      frames.push(buildSectionFrame(section, type, candidate.palette, candidate.designStyle));
    } catch (err) {
      console.warn('[lever] composition preview skip', typeId, err);
    }
  });
  return frames;
}

export function withCandidatePreviews(
  candidates: CompositionCandidate[] | null | undefined,
  input: Pick<DraftInput, 'categoryId' | 'productName'>,
): (CompositionCandidate & { previewFrames: FrameNode[] })[] {
  if (!candidates?.length) return [];
  return candidates.map((c) => ({
    ...c,
    previewFrames: buildCandidatePreviewFrames(c, input),
  }));
}
