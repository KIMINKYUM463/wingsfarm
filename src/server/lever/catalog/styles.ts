import type { ImageGenerationMajor, ImageGenerationStyle } from '@/features/detail-page/types';
import { emojiTile } from './svg';

/**
 * AI 이미지 연출 스타일 (대분류 → 중분류 → 스타일)
 * - scene: Gemini에 전달하는 장면 설명 (화면에는 노출하지 않음)
 */
interface StyleSeed {
  name: string;
  emoji: string;
  scene: string;
  examples: string[];
}

interface MiddleSeed {
  name: string;
  styles: StyleSeed[];
}

interface MajorSeed {
  name: string;
  description: string;
  emoji: string;
  colors: [string, string];
  middles: MiddleSeed[];
}

const SEEDS: MajorSeed[] = [
  {
    name: '[기본] 스튜디오 & 연출',
    description: '깔끔한 배경에서 상품을 돋보이게',
    emoji: '📸',
    colors: ['#F4F4F5', '#D4D4D8'],
    middles: [
      {
        name: '스튜디오',
        styles: [
          { name: '배경지(누끼용)', emoji: '⬜', scene: 'on a seamless pure white studio backdrop with soft even lighting and a subtle natural shadow, e-commerce cutout style', examples: ['그림자 없이 깔끔하게', '정면 구도로'] },
          { name: '단색 배경', emoji: '🟦', scene: 'on a solid pastel colored studio background that complements the product colors, soft diffused light', examples: ['연한 하늘색 배경', '베이지 톤 배경'] },
          { name: '그라데이션 배경', emoji: '🌈', scene: 'on a smooth gradient studio background with gentle rim light, premium advertising look', examples: ['보라에서 분홍으로', '은은한 회색 그라데이션'] },
        ],
      },
      {
        name: '오브제/전시대',
        styles: [
          { name: '원형 단상', emoji: '⚪', scene: 'placed on a minimal round podium pedestal with geometric props, clean studio lighting', examples: ['흰색 원형 단상', '두 단 높이 단상'] },
          { name: '대리석 테이블', emoji: '🪨', scene: 'placed on a polished marble surface with soft reflections and elegant lighting', examples: ['흰 대리석', '검은 대리석과 금색 소품'] },
          { name: '우드 선반', emoji: '🪵', scene: 'placed on a warm natural wooden shelf with soft daylight and cozy props', examples: ['밝은 원목', '라탄 소품과 함께'] },
        ],
      },
    ],
  },
  {
    name: '[공간] 라이프스타일',
    description: '실제 사용하는 공간 속 연출',
    emoji: '🏠',
    colors: ['#FEF3C7', '#FCD34D'],
    middles: [
      {
        name: '실내',
        styles: [
          { name: '거실', emoji: '🛋️', scene: 'in a bright modern living room interior, natural window light, lifestyle photography', examples: ['소파 옆 협탁 위', '햇살 드는 오후'] },
          { name: '침실', emoji: '🛏️', scene: 'in a calm cozy bedroom with soft linen textures and warm morning light', examples: ['침대 옆 협탁', '아늑한 조명'] },
          { name: '주방', emoji: '🍳', scene: 'on a clean modern kitchen counter with fresh ingredients nearby, bright natural light', examples: ['아일랜드 식탁 위', '요리하는 분위기'] },
          { name: '욕실', emoji: '🛁', scene: 'in a clean spa-like bathroom with white tiles, towels and soft light', examples: ['세면대 위', '호텔 욕실 느낌'] },
          { name: '카페', emoji: '☕', scene: 'on a table in a stylish cafe with blurred background bokeh and warm tones', examples: ['창가 자리', '라떼와 함께'] },
        ],
      },
      {
        name: '야외',
        styles: [
          { name: '공원', emoji: '🌳', scene: 'outdoors in a green park on a sunny day, shallow depth of field', examples: ['피크닉 매트 위', '나무 그늘'] },
          { name: '해변', emoji: '🏖️', scene: 'on a sunny beach with sand and blue sea in the background, summer vibe', examples: ['모래 위', '파도 배경'] },
          { name: '캠핑', emoji: '🏕️', scene: 'at a cozy campsite with tent and warm lantern light, outdoor adventure mood', examples: ['캠핑 테이블 위', '노을 질 때'] },
          { name: '도시 거리', emoji: '🏙️', scene: 'on an urban city street with modern architecture, editorial street style', examples: ['횡단보도 배경', '야경'] },
        ],
      },
    ],
  },
  {
    name: '[스페셜] 감성 연출',
    description: '자연 소재와 계절감으로 분위기 연출',
    emoji: '✨',
    colors: ['#DCFCE7', '#86EFAC'],
    middles: [
      {
        name: '자연 소재',
        styles: [
          { name: '꽃', emoji: '🌸', scene: 'surrounded by fresh flowers and petals, soft romantic light', examples: ['벚꽃잎', '장미 꽃다발'] },
          { name: '물방울/물결', emoji: '💧', scene: 'with splashing water and droplets, fresh and clean high-speed photography', examples: ['물 위에 떠 있는', '물방울이 맺힌'] },
          { name: '나뭇잎/식물', emoji: '🌿', scene: 'surrounded by green leaves and botanical elements, natural daylight shadows', examples: ['몬스테라 잎', '야자수 그림자'] },
        ],
      },
      {
        name: '계절',
        styles: [
          { name: '봄', emoji: '🌷', scene: 'in a fresh spring scene with blossoms and pastel tones', examples: ['튤립 정원', '연두빛 배경'] },
          { name: '여름', emoji: '🍉', scene: 'in a vivid summer scene with bright sunlight, refreshing colors', examples: ['수박과 얼음', '청량한 하늘'] },
          { name: '가을', emoji: '🍂', scene: 'in a warm autumn scene with fallen leaves and golden light', examples: ['단풍잎', '따뜻한 니트'] },
          { name: '겨울', emoji: '❄️', scene: 'in a cozy winter scene with snow and warm ambient light', examples: ['눈 내리는 창가', '따뜻한 머그컵'] },
        ],
      },
    ],
  },
  {
    name: '[테마] 기념일 & 무드',
    description: '이벤트와 브랜드 무드에 맞춘 연출',
    emoji: '🎁',
    colors: ['#FCE7F3', '#F9A8D4'],
    middles: [
      {
        name: '기념일',
        styles: [
          { name: '크리스마스', emoji: '🎄', scene: 'in a festive Christmas setting with ornaments, fairy lights and gift boxes', examples: ['트리 아래', '빨간 리본'] },
          { name: '발렌타인', emoji: '💝', scene: 'in a romantic Valentine setting with hearts and soft pink tones', examples: ['하트 풍선', '초콜릿과 함께'] },
          { name: '명절 선물', emoji: '🧧', scene: 'as a premium holiday gift set with elegant wrapping and traditional Korean patterns', examples: ['보자기 포장', '고급 선물 세트'] },
        ],
      },
      {
        name: '무드',
        styles: [
          { name: '미니멀', emoji: '◽', scene: 'in a minimal composition with lots of negative space and neutral tones', examples: ['흰 배경 한 가지 소품', '그림자 강조'] },
          { name: '럭셔리', emoji: '💎', scene: 'in a luxurious setting with dark tones, gold accents and dramatic lighting', examples: ['검은 실크 위', '금빛 하이라이트'] },
          { name: '내추럴', emoji: '🧺', scene: 'in a natural organic setting with linen, wood and soft daylight', examples: ['린넨 천 위', '햇살 그림자'] },
          { name: '비비드 팝', emoji: '🎨', scene: 'in a bold vivid pop-art color setting with playful props and hard light', examples: ['원색 배경', '컬러 블록'] },
        ],
      },
    ],
  },
  {
    name: '[AI 모델 연출] 사용 장면',
    description: '사람이 사용하는 모습으로 연출',
    emoji: '🙋',
    colors: ['#E0E7FF', '#A5B4FC'],
    middles: [
      {
        name: '모델',
        styles: [
          { name: '손에 든 컷', emoji: '🤲', scene: 'held naturally in a person\'s hands, close-up, clean background', examples: ['한 손으로 들고', '양손으로 감싸서'] },
          { name: '사용하는 모습', emoji: '🙆', scene: 'being used by a Korean model in a realistic everyday situation, natural candid photography', examples: ['20대 여성이 사용', '가족이 함께'] },
          { name: '착용 컷', emoji: '🧥', scene: 'worn by a Korean fashion model, full body editorial shot with clean background', examples: ['전신 정면', '야외 스트릿'] },
        ],
      },
    ],
  },
];

const slug = (...parts: (string | number)[]) => parts.join('-');

interface StyleEntry extends ImageGenerationStyle {
  scene: string;
}

const STYLE_INDEX = new Map<string, StyleEntry>();

export const IMAGE_STYLE_MAJORS: ImageGenerationMajor[] = SEEDS.map((major, mi) => ({
  id: slug('major', mi + 1),
  name: major.name,
  description: major.description,
  thumbnailUrl: emojiTile(major.emoji, ...major.colors),
  displayOrder: mi + 1,
  middles: major.middles.map((middle, di) => ({
    id: slug('middle', mi + 1, di + 1),
    name: middle.name,
    displayOrder: di + 1,
    styles: middle.styles.map((style, si) => {
      const entry: StyleEntry = {
        id: slug('style', mi + 1, di + 1, si + 1),
        name: style.name,
        thumbnailUrl: emojiTile(style.emoji, ...major.colors),
        sampleImageUrls: [],
        promptExamples: style.examples,
        price: 1,
        displayOrder: si + 1,
        scene: style.scene,
      };
      STYLE_INDEX.set(entry.id, entry);
      const { scene: _scene, ...publicStyle } = entry;
      return publicStyle;
    }),
  })),
}));

export const findImageStyle = (styleId: string) => STYLE_INDEX.get(styleId);
