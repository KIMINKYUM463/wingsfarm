/**
 * 웹형 숏폼 카피라이터 — OpenAI로 초안을 쓰고, 실패하면 규칙 기본 문구를 쓴다.
 */
import 'server-only';
import { OPENAI_MODEL, openaiClient } from '@/lib/server/openai';

const RULES = `규칙:
- 제목·이름·단위 칸을 뺀 모든 칸은 끝맺은 해요체 문장(…해요, …하세요, …인가요?)으로 씁니다.
  배열 칸의 항목 하나하나도 15자 이상의 문장입니다. '노지재배'처럼 명사 하나로 쓰지 않습니다(카드 템플릿만 예외).
- 문장은 TTS가 읽고 자막으로도 나오므로 한 문장 15~32자, 영어 단어·이모지 금지.
- 판매자는 산지 상품을 받아 파는 위탁판매자입니다. 메모에 직접 재배·어획이라고 적혀 있지 않으면 '직접 키운', '저희 농장' 표현을 쓰지 않습니다.
- 판매자 정보에 없는 사람·경력·숫자를 지어내지 않습니다. 없으면 null 또는 일반 표현.
- 각 문장의 핵심어 1~2개를 *별표*로 감싸면 화면에서 강조됩니다(카드 템플릿 제외).
- 건강·효능 주장, 과장 수치, 특정 업체 비방은 쓰지 않습니다.
- 레퍼런스는 훅 공식과 말투만 빌리고 문장을 베끼지 않습니다.`;

/** 숏폼 대본: 후킹 + 스토리/소개 흐름 */
const STORY_HOOK_RULES = `대본 스타일 (필수):
- 1장면(훅)은 스크롤을 멈추게 만드세요. 질문·반전·구체적 숫자·'이것만은' 중 하나로 시작.
  예: '이 *오렌지*, 껍질만 보고 고르면 실패해요.' / '산지에서 *당일* 따서 보내는 이유.'
- 전체는 '스토리형' 또는 '소개형' 중 하나로 통일하세요.
  · 스토리형: 문제(고르기 실패) → 산지/이유 → 맛·모습 → 보관·주문 마무리
  · 소개형: 한 줄 후킹 → 산지·특징 → 이렇게 먹어요 → CTA
- 장면마다 말이 바뀌되, 한 사람이 쉬지 않고 이어서 말하는 나레이션이어야 합니다.
  2장면부터는 앞 문장을 받아 '그래서/근데/그러니까/이때/막상'처럼 이어지거나, 같은 주어가 다음 행동으로 넘어가야 합니다.
  장면마다 주제가 리셋되거나 서로 안 붙는 문장 나열은 금지입니다.
- 추상어('신선해요','좋아요')만 쓰지 말고, 보이는 장면이 떠오르게 쓰세요(껍질·자르기·한 입·박스·밭).
- 각 장면 say와 함께 shot·visual을 꼭 주세요. 영상이 그 말에 맞게 붙습니다.
  shot 후보: hook(자르기·대표컷) | detail(클로즈업) | crave(먹는장면) | origin(산지) | hold(손에들기) | pack(포장) | prep(손질) | hero(진열) | store(보관) | photo(상품사진)`;

/** 문장 내용으로 장면 유형 추정 — 영상이 대본과 맞게 */
export function inferShotFromSay(say: string, fallback = 'hero'): string {
  const t = say.replace(/\*/g, '');
  if (/산지|농장|밭|수확|과수원|바다|어장|직송|따서|캐서/.test(t)) return 'origin';
  if (/씻|헹구|썰|손질|다듬|필렛|껍질\s*벗/.test(t)) return 'prep';
  if (/먹|한\s*입|시식|달콤|즙|맛보|드셔|입에/.test(t)) return 'crave';
  if (/자르|반\s*가르|칼|깎/.test(t)) return 'hook';
  if (/클로즈|자세히|표면|무늬|결|광택|알갱이/.test(t)) return 'detail';
  if (/박스|포장|담아|출고|보내/.test(t) && !/산지|직송/.test(t)) return 'pack';
  if (/손(?:에|으로)|들어\s*보|보여\s*드릴/.test(t)) return 'hold';
  if (/보관|냉장고|베란다|두지\s*마/.test(t)) return 'store';
  if (/진열|한\s*박스|가득|쌓여|시장/.test(t)) return 'hero';
  if (/주문|프로필|저장해|링크|장\s*볼/.test(t)) return 'photo';
  return fallback;
}

function sourceFromShot(shot: string) {
  if (shot === 'origin') return 'stock:origin';
  if (shot === 'photo') return 'photo:1';
  return `ai:${shot}`;
}

type FieldDef = {
  key: string;
  label: string;
  type: string;
  max?: number;
  min?: number;
  count?: number;
  hint?: string;
  default?: string;
  sources?: string[];
};

type Template = {
  name?: string;
  when?: string;
  output?: string;
  engine?: string;
  fields?: FieldDef[];
};

function fieldBrief(tpl: Template) {
  return (tpl.fields ?? [])
    .filter((f) => f.type !== 'source')
    .map((f) => {
      let desc = `- ${f.key} (${f.label})`;
      if (f.type === 'list') desc += `: 문자열 배열 ${f.count ?? 3}개`;
      else if (f.type === 'number') desc += ': 숫자. 없으면 null';
      else desc += ': 문자열';
      if (f.max) desc += `, ${f.max}자 이내`;
      if (f.hint) desc += `. ${f.hint}`;
      return desc;
    })
    .join('\n');
}

function parseJsonObject(text: string): Record<string, unknown> {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence?.[1] ?? text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('JSON 파싱 실패');
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function josa(name: string, a: string, b: string) {
  const ch = name.charCodeAt(name.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return b;
  return (ch - 0xac00) % 28 ? a : b;
}

export function preset(tplName: string, p: Record<string, unknown>) {
  const n = String(p.name || '상품');
  const iGa = josa(n, '이', '가');
  const count = p.count;
  const unit = String(p.unit_word || '개');
  const base: Record<string, Record<string, unknown>> = {
    고르는법: {
      title1: `${n} 고르는 법`,
      title2: '딱 3가지만 보세요',
      hook: `${n} 살 때 이것만 보면 *실패* 없어요.`,
      items: [
        '색이 *선명*하고 윤기가 나는 걸 고르세요.',
        '겉에 *흠집*이나 무른 곳이 없는지 보세요.',
        '크기에 비해 *묵직*한 게 좋아요.',
      ],
      outro: '*저장*해 두고 장 볼 때 꺼내 보세요.',
      info: `이렇게 고른 ${n}, 프로필 링크에`,
    },
    보관경고: {
      title1: `${n} 이렇게 두면`,
      title2: '금방 상해요',
      hook: `${n}, 받자마자 *아무 데나* 두셨나요?`,
      wrong: ['상자째 *실온*에 두면 금방 상할 수 있어요.'],
      right: ['하나씩 *감싸서* 냉장 보관해 주세요.', '씻는 건 *먹기 직전*에 하세요.'],
      outro: '*저장*해 두고 택배 받는 날 꺼내 보세요.',
      info: `산지에서 바로 보내는 ${n}`,
    },
    손질법: {
      title1: `${n} 손질법`,
      title2: '세 번이면 끝',
      hook: `${n} 손질, *생각보다* 쉬워요.`,
      steps: ['흐르는 물에 *깨끗이* 씻어 주세요.', '먹기 좋게 *손질*해 주세요.', '*한입 크기*로 썰면 끝이에요.'],
      outro: '이렇게 하면 누구나 쉽게 드실 수 있어요.',
      info: `${n} 주문은 프로필 링크`,
    },
    물량리빌: {
      title1: `${n} 한 박스에`,
      title2: '몇 개 들어갈까요?',
      hook: `${n} *한 박스*, 몇 ${unit} 들어가는지 세어 볼게요.`,
      steps: [`고른 ${n}${josa(n, '을', '를')} *하나씩* 담아요.`],
      count,
      unit,
      reveal: '이만큼 *꽉 차게* 들어가요.',
      outro: '이 구성 그대로 보내드려요. 프로필 링크에서 주문하세요.',
      info: '주문은 프로필 링크',
    },
    비교: {
      title1: '가정용 vs 선물용',
      title2: '뭐가 다를까?',
      hook: `${n} 가정용이랑 선물용, *뭐가* 다를까요?`,
      a_name: '가정용',
      a_say: '가정용은 크기가 *조금씩* 달라도 맛은 같아요.',
      b_name: '선물용',
      b_say: '선물용은 크기와 모양을 *고르게* 골라 담았어요.',
      verdict: '드실 거면 *가정용*, 선물하실 거면 *선물용*이에요.',
      info: '두 가지 모두 프로필 링크에',
    },
    짧은루프: {
      title1: `${n} 오늘 출발`,
      title2: '산지에서 바로',
      line1: `산지에서 고른 ${n}, *오늘* 출발해요.`,
      line2: '주문은 *프로필 링크*예요.',
      info: '주문은 프로필 링크',
    },
    카드: {
      title1: `${n} 고르는 법`,
      title2: '3가지만 기억하세요',
      items: ['색이 선명하고, 윤기가 나는 것', '흠집이나, 무른 곳이 없는 것', '크기에 비해, 묵직한 것'],
      outro_card: '저장해 두고 장 볼 때 꺼내 보세요',
      info: '프로필 링크에서 주문',
    },
    판매형: {
      hook_text: `제철 ${n}, 산지에서 바로 보내드려요.`,
      origin: p.origin || '',
      features: [
        iGa === '이' ? `산지에서 직접 고른 ${n}${iGa}에요.` : `산지에서 직접 고른 ${n}예요.`,
        '주문 들어오면 바로 보내요.',
      ],
      price: p.price,
      unit: p.unit || '',
      cta: '수량이 한정돼 있어요. 프로필 링크에서 지금 주문하세요.',
    },
  };
  return base[tplName] ?? {};
}

export function clean(tpl: Template, d: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of tpl.fields ?? []) {
    const k = f.key;
    let v = d[k];
    if (f.type === 'source') continue;
    if (f.type === 'list') {
      const arr = Array.isArray(v) ? v : [];
      v = arr
        .map((x) => (Array.isArray(x) ? String(x[0] ?? '') : typeof x === 'object' && x ? String((x as { text?: string }).text ?? x) : String(x ?? '')))
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, f.max ?? 4);
    } else if (f.type === 'number') {
      try {
        v = v === null || v === undefined || v === '' || v === 'null' ? null : Number.parseInt(String(v).replace(/,/g, ''), 10);
        if (Number.isNaN(v as number)) v = null;
      } catch {
        v = null;
      }
    } else {
      v = String(v ?? '').trim();
    }
    out[k] = v;
  }
  if (tpl.output === 'cards' || tpl.engine === 'short') {
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === 'string') out[k] = v.replace(/\*/g, '');
      else if (Array.isArray(v)) out[k] = v.map((s) => String(s).replace(/\*/g, ''));
    }
  }
  return out;
}

async function askOpenAI(prompt: string): Promise<string> {
  const client = openaiClient();
  if (!client) throw new Error('OPENAI_API_KEY 없음');
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error('빈 응답');
  return text;
}

/** 레퍼런스 장면 구조 → 내 상품 문장 (clone). */
export async function cloneDraft(
  analysis: Record<string, unknown>,
  product: Record<string, unknown>,
): Promise<{ fields: Record<string, unknown>; via: string }> {
  const scenes = Array.isArray(analysis.scenes) ? (analysis.scenes as Array<Record<string, unknown>>) : [];
  const facts = Object.fromEntries(
    ['name', 'category', 'look', 'origin', 'price', 'unit', 'memo']
      .filter((k) => product[k] !== undefined && product[k] !== null && product[k] !== '')
      .map((k) => [k, product[k]]),
  );
  const brief = {
    summary: analysis.summary,
    layout: analysis.layout,
    voice: analysis.voice,
    copy_style: analysis.copy_style,
    pacing: analysis.pacing,
    hook_type: (analysis.hook as { type?: string } | undefined)?.type,
    has_fixed_title: Boolean(Array.isArray(analysis.title_lines) && analysis.title_lines.length),
    scenes: scenes.map((s) => ({
      role: s.role,
      label: s.label,
      purpose: s.purpose || s.note || '',
      seconds: s.seconds,
      measured: s.measured,
    })),
  };
  const n = scenes.length || 1;
  const name = String(product.name || '상품');
  const prompt = `당신은 한국 농수산물 산지직송 숏폼(쇼츠·릴스) 전문 카피라이터입니다.
레퍼런스의 *장면 수·역할·템포*만 빌리고, 문장은 내 상품용으로 새로 쓰세요. 베끼지 마세요.

[레퍼런스 분석]
${JSON.stringify(brief, null, 1)}

[판매자 상품 (사실 정보)]
${JSON.stringify(facts, null, 0)}

${RULES}
${STORY_HOOK_RULES}
- 장면 수는 레퍼런스와 같게 정확히 ${n}개.
- 1장면은 반드시 강한 훅. 마지막은 CTA(저장·주문)로 자연스럽게.
- 형식은 story(스토리) 또는 intro(소개) 중 하나를 format에 적으세요.
- voice가 text_only/asmr이면 각 문장 16자 안팎, 아니면 15~28자.
- visual은 영어 4~8단어. 한국 품목의 실제 생김새를 쓰세요. 참외는 oriental melon / chamoe / yellow stripes 이지 cantaloupe·honeydew·melon 단독이 아닙니다. 꽃·패션 금지.

JSON 하나로만:
{"format":"story|intro","title1":"13자 이내","title2":"13자 이내 또는 빈 문자열","info":"22자 이내",
 "lines":[{"say":"후킹되는 완결 문장","label":"라벨 또는 빈 문자열","shot":"hook|detail|crave|origin|hold|pack|prep|hero|store|photo","visual":"english search phrase"}, ... ${n}개]}`;

  try {
    const text = await askOpenAI(prompt);
    const d = parseJsonObject(text);
    let lines = (Array.isArray(d.lines) ? d.lines : []).map((l) =>
      typeof l === 'object' && l ? (l as Record<string, unknown>) : { say: String(l) },
    );
    while (lines.length < scenes.length) {
      lines.push({ say: '', label: scenes[lines.length]?.label ?? '' });
    }
    lines = lines.slice(0, scenes.length);
    const caption = analysis.caption as { style?: string } | undefined;
    const fields = {
      title1: String(d.title1 || name).slice(0, 16),
      title2: String(d.title2 || '').slice(0, 16),
      info: String(d.info || '주문은 프로필 링크').slice(0, 26),
      story_format: String(d.format || 'story'),
      voice_mode: analysis.voice === 'text_only' || analysis.voice === 'asmr' ? 'text_only' : 'narration',
      lines: lines.map((l, i) => {
        const s = scenes[i] ?? {};
        let say = String(l.say || '');
        if (caption?.style !== 'keyword_highlight') say = say.replace(/\*/g, '');
        if (!say.trim()) {
          say = storyFallbackLine(name, i, scenes.length, String(product.origin || ''));
        }
        const aiShot = String(l.shot || '').toLowerCase();
        const shot = ['hook', 'detail', 'crave', 'origin', 'hold', 'pack', 'prep', 'hero', 'store', 'photo'].includes(aiShot)
          ? aiShot
          : inferShotFromSay(say, String(s.shot || (i === 0 ? 'hook' : 'hero')));
        const visual = String(l.visual || '').slice(0, 80);
        return {
          say,
          label: String(l.label || s.label || ''),
          role: String(s.role || (i === 0 ? 'HOOK' : i === scenes.length - 1 ? 'CTA' : 'TIP')),
          shot,
          visual,
          source: sourceFromShot(shot),
          seconds: Number(s.seconds) || 3,
          keyframe: String(s.keyframe || ''),
        };
      }),
    };
    return { fields, via: 'openai' };
  } catch (err) {
    console.error('[shortform] cloneDraft fallback', err);
    return {
      via: '규칙',
      fields: {
        title1: name.slice(0, 13),
        title2: '산지에서 바로',
        info: '주문은 프로필 링크',
        story_format: 'intro',
        voice_mode: analysis.voice === 'text_only' || analysis.voice === 'asmr' ? 'text_only' : 'narration',
        lines: scenes.map((s, i) => {
          const say = storyFallbackLine(name, i, scenes.length, String(product.origin || ''));
          const shot = inferShotFromSay(say, String(s.shot || (i === 0 ? 'hook' : 'hero')));
          return {
            say,
            label: String(s.label || ''),
            role: String(s.role || (i === 0 ? 'HOOK' : 'TIP')),
            shot,
            visual: '',
            source: sourceFromShot(shot),
            seconds: Number(s.seconds) || 3,
            keyframe: String(s.keyframe || ''),
          };
        }),
      },
    };
  }
}

function storyFallbackLine(name: string, i: number, n: number, origin: string) {
  const o = origin || '산지';
  if (i === 0) return `이 *${name}*, 겉모습만 보고 고르면 후회해요.`;
  if (i === n - 1) return `주문은 *프로필 링크*에서 바로 하세요.`;
  if (i === 1) return `${o}에서 골라 *바로* 보내 드려요.`;
  if (i === 2) return `한 입 베어 물면 *과즙*이 꽉 차요.`;
  return `${name}, 이렇게 골라 *실패* 없어요.`;
}

export async function draftFields(
  tplName: string,
  tpl: Template,
  product: Record<string, unknown>,
  ref?: Record<string, unknown> | null,
  hooks?: Record<string, { label?: string; formula?: string }> | null,
): Promise<{ fields: Record<string, unknown>; via: string }> {
  const facts = Object.fromEntries(
    ['name', 'category', 'look', 'origin', 'price', 'unit', 'count', 'memo']
      .filter((k) => product[k] !== undefined && product[k] !== null && product[k] !== '')
      .map((k) => [k, product[k]]),
  );
  let refText = '없음 (템플릿 기본 말투)';
  if (ref) {
    const h = hooks?.[String(ref.hook ?? '')] ?? {};
    refText = `제목 '${ref.title}' (조회수 ${Number(ref.views ?? 0).toLocaleString()}회)\n훅 유형: ${h.label ?? ref.hook} — 공식: ${h.formula ?? ''}\n참고할 점: ${ref.why ?? ''}`;
  }
  const prompt = `당신은 한국 농수산물 산지직송 숏폼(유튜브 쇼츠·릴스·틱톡) 전문 카피라이터입니다.
아래 템플릿 칸을 채우되, 시청자가 중간에 스크롤을 멈추게 만드는 *후킹 대본*으로 쓰세요.
스토리형(문제→해결→마무리) 또는 소개형(한 줄 훅→특징→먹는 법→CTA) 중 하나로 통일하세요.

[템플릿] ${tplName} — ${tpl.name ?? ''}
쓰임: ${tpl.when ?? ''}

[레퍼런스 영상]
${refText}

[상품 정보 (판매자가 준 사실)]
${JSON.stringify(facts, null, 0)}

[채울 칸]
${fieldBrief(tpl)}

${RULES}
${STORY_HOOK_RULES}
- hook / line1 / hook_text / 첫 문장은 특히 강하게. '신선해요'만으로 시작 금지.
- 리스트·단계 문장도 각각 장면이 보이게(자르기·산지·한 입·박스).

JSON 객체 하나로만 답하세요. 키는 위 칸 이름 그대로.`;

  try {
    const text = await askOpenAI(prompt);
    const out = clean(tpl, parseJsonObject(text));
    const given = new Set(JSON.stringify(facts).replace(/,/g, '').match(/\d+/g) ?? []);
    for (const f of tpl.fields ?? []) {
      if (f.type === 'number' && out[f.key] != null && !given.has(String(out[f.key]))) out[f.key] = null;
    }
    return { fields: out, via: 'openai' };
  } catch (err) {
    console.error('[shortform] draft fallback', err);
    return { fields: clean(tpl, preset(tplName, product)), via: '규칙' };
  }
}

export async function chatEdit(
  kind: string,
  fields: Record<string, unknown>,
  message: string,
  product: Record<string, unknown>,
  sceneIds: string[],
) {
  const facts = Object.fromEntries(
    ['name', 'category', 'origin', 'price', 'unit', 'memo'].filter((k) => product[k]).map((k) => [k, product[k]]),
  );
  const prompt = `당신은 숏폼 영상 편집자입니다.
[영상 종류] ${kind}
[상품] ${JSON.stringify(facts)}
[현재 설정 JSON]
${JSON.stringify(fields, null, 1)}
[장면 source] ${sceneIds.join(', ')}
[판매자 요청] ${message}
${RULES}
JSON 하나로만: {"reply":"한두 문장","fields":전체설정}`;
  try {
    const text = await askOpenAI(prompt);
    const d = parseJsonObject(text);
    return {
      fields: (d.fields as Record<string, unknown>) || fields,
      reply: String(d.reply || '반영했어요.'),
    };
  } catch {
    return { fields, reply: '지금은 AI가 바빠서 설정을 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
}

export async function hookVariants(product: Record<string, unknown>, kind: string, hook: string, rest: string[]) {
  const prompt = `숏폼 첫 문장(훅)만 바꾼 대안 3개를 만드세요.
상품: ${JSON.stringify({ name: product.name, category: product.category, origin: product.origin })}
형식: ${kind}
현재 훅: ${hook}
나머지 문장(참고): ${rest.slice(0, 6).join(' / ')}
${RULES}
JSON: {"hooks":[{"type":"부정경고|숫자리스트|다들속았다","text":"..."}, ... 3개]}`;
  try {
    const text = await askOpenAI(prompt);
    const d = parseJsonObject(text);
    const hooks = Array.isArray(d.hooks) ? d.hooks : [];
    if (!hooks.length) throw new Error('empty');
    return hooks as Array<{ type: string; text: string }>;
  } catch {
    const n = String(product.name || '상품');
    return [
      { type: '부정경고', text: `제발 이런 ${n} 사지 마세요.` },
      { type: '숫자리스트', text: `${n} 고르는 법, 딱 3가지만 보세요.` },
      { type: '다들속았다', text: `전국민이 속았습니다. ${n} 고르는 법.` },
    ];
  }
}

export async function postPack(product: Record<string, unknown>, script: string, templateName: string) {
  const prompt = `숏폼 올릴 글을 플랫폼별로 짧게 써 주세요.
상품: ${JSON.stringify({ name: product.name, origin: product.origin, price: product.price, unit: product.unit })}
형식: ${templateName}
대본: ${script.slice(0, 800)}
JSON: {"youtube":{"title":"","description":"","tags":[]},"instagram":{"caption":"","tags":[]},"tiktok":{"caption":"","tags":[]}}`;
  try {
    const text = await askOpenAI(prompt);
    return parseJsonObject(text);
  } catch {
    const name = String(product.name || '상품');
    return {
      youtube: { title: `${name} 숏폼`, description: script.slice(0, 200), tags: [name, '산지직송'] },
      instagram: { caption: script.slice(0, 200), tags: [name] },
      tiktok: { caption: script.slice(0, 150), tags: [name] },
    };
  }
}

const RISKY: Array<[RegExp, string, string]> = [
  [/항암|암\s*(예방|에\s*좋)|당뇨|고혈압|치료|예방|완치|효능|약효/u, '효능·질병 표현은 일반 식품 광고에 쓰기 어려워요', '맛·식감·제철로 바꿔 주세요'],
  [/면역|해독|디톡스|다이어트|살\s*빠|항산화/u, '건강 기능 표현은 주의가 필요해요', '아삭·달콤 같은 감각 표현으로'],
  [/최고|최상|유일|1등|국내\s*최초/u, '최상급 표현은 근거가 필요해요', '가장 잘 나가요 정도로'],
  [/무농약|유기농|친환경/u, '인증이 있을 때만 쓸 수 있어요', '산지에서 바로 보내요'],
];

export function lintTexts(texts: string[], product?: Record<string, unknown> | null) {
  const given = product
    ? new Set(
        ['name', 'origin', 'price', 'unit', 'memo']
          .map((k) => String(product[k] ?? ''))
          .join(' ')
          .replace(/,/g, '')
          .match(/\d+/g) ?? [],
      )
    : null;
  const hits: Array<{ text: string; word: string; why: string; tip: string }> = [];
  for (const t of texts) {
    const plain = String(t || '').replace(/\*/g, '');
    for (const [pat, why, tip] of RISKY) {
      const m = plain.match(pat);
      if (m) hits.push({ text: plain, word: m[0], why, tip });
    }
    if (given && plain.length > 4) {
      for (const n of plain.replace(/,/g, '').match(/(\d+)\s*(?:kg|g\b|개|원|%|일)/g) ?? []) {
        const num = n.match(/\d+/)?.[0];
        if (num && !given.has(num)) {
          hits.push({
            text: plain,
            word: num,
            why: '판매자 정보에 없는 숫자예요',
            tip: '맞는 숫자면 상품 메모에 적어 두고, 아니면 빼 주세요',
          });
          break;
        }
      }
    }
  }
  return hits;
}
