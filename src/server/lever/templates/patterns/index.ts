import { designStyleOption, type DesignStyleId } from '@/shared/lib/designStyles';
import { derivePalette, TONE_PRESETS } from '@/shared/lib/palette';
import { Canvas } from '../canvas';
import type { DesignTemplate } from '../designTemplates';
import { designTokens, type Surface } from '../designStyles';
import { frameNode, WHITE, withGuide } from '../nodes';
import type { PatternGroup } from './kit';
import { HERO } from './hero';
import { PROBLEM } from './problem';
import { STORY } from './story';
import { POINTS_GROUP } from './points';
import { FEATURES } from './features';
import { INFO } from './info';
import { TRUST } from './trust';
import { PURCHASE } from './purchase';

/**
 * 패턴 템플릿 (구성 8개 × 배치 10종 × 스킨 2종 = 160개)
 *
 * 시중 농수산물 상세(제작사 포트폴리오·7컷 AI템플릿·CS 가이드)에서 반복되는 역할만 뽑아 변형한 배치.
 * 당도·등급·박스구성·보냉·구매전확인 등 농수산 전용 블록 포함. 특정 템플릿 복제 없음.
 * 근거: docs/농수산물-상세템플릿-시중분석.md
 */
export const PATTERN_GROUPS: PatternGroup[] = [HERO, PROBLEM, STORY, POINTS_GROUP, FEATURES, INFO, TRUST, PURCHASE];

interface Skin {
  id: string;
  style: DesignStyleId;
  surface: Surface;
}

/** 스킨: 디자인 스타일(글꼴·정렬·모서리) + 바탕. 패턴마다 2종을 돌려 가며 고른다 */
const SKINS: Skin[] = [
  { id: 'a', style: 'modern', surface: 'white' },
  { id: 'b', style: 'natural', surface: 'bgLight' },
  { id: 'c', style: 'premium', surface: 'main' },
  { id: 'd', style: 'pop', surface: 'bgDark' },
  { id: 'e', style: 'docu', surface: 'white' },
];

export const skinsOf = (index: number) => [SKINS[index % SKINS.length], SKINS[(index + 2) % SKINS.length]];

export function buildPatternTemplates(): DesignTemplate[] {
  return PATTERN_GROUPS.flatMap((group) =>
    group.patterns.flatMap((pattern, index) =>
      skinsOf(index).map((skin) => {
        const slug = `pt-${group.key}-${pattern.key}-${skin.id}`;
        const style = designStyleOption(skin.style);
        const tone = TONE_PRESETS.find((t) => t.id === style.toneId) ?? TONE_PRESETS[0];
        const palette = derivePalette(tone.main);
        const c = new Canvas(slug, palette, designTokens(skin.style), skin.surface);
        const bottom = pattern.draw(c) ?? 110;
        const fill = skin.surface === 'white' ? WHITE : palette[skin.surface];
        const colorVar = skin.surface === 'white' ? undefined : skin.surface;
        const frame = frameNode(`${slug}-root`, `${pattern.name} · ${style.name}`, c.frameHeight(bottom), fill, c.nodes, colorVar);
        return { slug, part2: group.part2, frame: withGuide(frame, slug, pattern.guide) };
      }),
    ),
  );
}
