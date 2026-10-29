/** 작은 SVG 아이콘·썸네일을 data URI로 만든다 (외부 이미지 서버 없이 동작) */
export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch]!);

/** 그라데이션 배경 + 이모지 타일 */
export const emojiTile = (emoji: string, from: string, to: string, size = 120) =>
  svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
      `<rect width="120" height="120" rx="16" fill="url(#g)"/>` +
      `<text x="60" y="62" font-size="54" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`,
  );

/** 배경 없는 이모지 아이콘 (카테고리 카드용) */
export const emojiIcon = (emoji: string, size = 56) =>
  svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">` +
      `<text x="28" y="30" font-size="44" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`,
  );
