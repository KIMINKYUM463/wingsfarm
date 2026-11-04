/**
 * 템플릿 id → 색감 세트(톤) id
 * designStyles / patterns 스킨 매핑과 같아야 한다 (프레임을 읽지 않고도 판별).
 */

const DS_TONE: Record<string, string> = {
  modern: 'mono',
  natural: 'forest',
  premium: 'navy',
  pop: 'coral',
  docu: 'mocha',
};

/** patterns/index.ts SKINS a~e */
const PT_SKIN_TONE: Record<string, string> = {
  a: 'mono',
  b: 'forest',
  c: 'navy',
  d: 'coral',
  e: 'mocha',
};

export function toneIdFromTemplateId(id: string): string | undefined {
  const ds = /^builtin-ds-([a-z]+)-/.exec(id)?.[1];
  if (ds && DS_TONE[ds]) return DS_TONE[ds];
  const skin = /^builtin-pt-.+-([a-e])$/.exec(id)?.[1];
  if (skin) return PT_SKIN_TONE[skin];
  return undefined;
}
