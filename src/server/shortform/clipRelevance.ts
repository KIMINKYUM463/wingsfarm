/**
 * 가져온 스톡·CC 영상이 입력한 상품 키워드의 실물인지 확인한다.
 * 참치·빵처럼 다른 음식이면 빼고, 애매하면 관련 없음으로 본다.
 */
import 'server-only';
import { mentionsWrongFood, produceIdentity } from '@/server/lever/media/stockQuery';
import { OPENAI_MODEL, openaiClient } from '@/lib/server/openai';

export type ClipCandidate = { id: string; text: string };

function localKeep(productName: string, text: string) {
  if (mentionsWrongFood(productName, text)) return false;
  const blob = text.toLowerCase();
  const ko = productName.replace(/\s+/g, '');
  if (ko.length >= 2 && blob.includes(ko.toLowerCase())) return true;
  const id = produceIdentity(productName);
  if (id) {
    // 'crab' 한 단어만으로는 통과시키지 않는다. 대표 검색어의 핵심 단어가 2개 이상 있어야 한다.
    const words = (id.queries[0] || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    const hits = words.filter((w) => blob.includes(w));
    return hits.length >= Math.min(2, words.length);
  }
  const tokens = productName
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((w) => w.length >= 2);
  return tokens.some((w) => blob.includes(w));
}

/** 관련 있는 후보 id만 돌려준다. AI가 없으면 품목 단어가 들어간 것만. */
export async function relevantClipIds(
  productName: string,
  script: string,
  candidates: ClipCandidate[],
  log?: (m: string) => Promise<void> | void,
): Promise<Set<string>> {
  const pool = candidates.filter((c) => c.id && !mentionsWrongFood(productName, c.text));
  if (!pool.length) return new Set();

  const client = openaiClient();
  if (!client) return new Set(pool.filter((c) => localKeep(productName, c.text)).map((c) => c.id));

  const look = produceIdentity(productName)?.look || '';
  const list = pool.slice(0, 8).map((c) => ({ id: c.id, text: c.text.slice(0, 180) }));
  const prompt = `숏폼에 넣을 영상 후보가 상품 키워드의 실물인지 판단하세요.
상품 키워드: "${productName}"
${look ? `이 상품의 생김새: ${look}` : ''}
이 장면 대본: "${script.replace(/\*/g, '').slice(0, 80)}"

후보:
${JSON.stringify(list)}

규칙:
- 제목·주소의 주인공이 이 키워드와 같은 품목일 때만 keep에 넣으세요.
- 다른 음식(참치, 문어, 새우, 랍스터, 빵, 과자, 연어 등)이면 빼세요.
- 그냥 seafood, crab, food, market처럼 두루뭉술하고 이 품목 이름이 없으면 빼세요.
- 애매하면 빼세요. 빈 배열도 괜찮습니다.

JSON만: {"keep":["id"]}`;

  try {
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}') as { keep?: string[] };
    const allow = new Set(pool.map((c) => c.id));
    const keep = (parsed.keep || []).filter((id) => allow.has(id));
    const dropped = pool.filter((c) => !keep.includes(c.id)).slice(0, 3);
    if (dropped.length) {
      await log?.(`키워드와 다른 영상 제외: ${dropped.map((c) => c.text.slice(0, 42)).join(' · ')}`);
    }
    return new Set(keep);
  } catch (err) {
    await log?.(`관련 영상 확인 실패, 품목 단어가 있는 것만 써요: ${err instanceof Error ? err.message : err}`);
    return new Set(pool.filter((c) => localKeep(productName, c.text)).map((c) => c.id));
  }
}
