"""AI 문구 초안: 사진으로 품목 알아보기 + 레퍼런스 훅 공식으로 템플릿 칸 채우기.

LLM 순서: fal.ai(any-llm) → Replicate → OpenAI → 규칙 기반 기본 문구.
초안일 뿐이라 화면에서 사람이 고친 뒤 영상을 만든다. 사실이 아닌 숫자를 지어내지 않도록 프롬프트로 막는다.
(영상 AI 장면 생성은 sources.py 의 FAL/Replicate 키가 따로 필요하다. OpenAI는 문구·해부·채팅용.)
"""
import base64
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import sources  # noqa: E402  (.env 를 읽어 들인다)

LLM_MODEL = "anthropic/claude-sonnet-4.5"
REPLICATE_LLM = "anthropic/claude-4-sonnet"
OPENAI_MODEL = os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"
CATEGORIES = ["과일", "채소", "수산", "축산", "가공"]


# ---------- LLM 호출 ----------

def _images(image):
    return [] if not image else list(image) if isinstance(image, (list, tuple)) else [image]


def _fal(prompt, image=None):
    import fal_client
    if image:
        r = fal_client.subscribe("fal-ai/any-llm/vision", arguments={
            "model": LLM_MODEL, "prompt": prompt,
            "image_urls": [fal_client.upload_file(str(i)) for i in _images(image)]})
    else:
        r = fal_client.subscribe("fal-ai/any-llm", arguments={"model": LLM_MODEL, "prompt": prompt})
    if r.get("error"):
        raise RuntimeError(r["error"])
    return r["output"]


def _replicate(prompt, image=None):
    inp = {"prompt": prompt, "max_tokens": 2000}
    if image:  # Replicate 쪽은 이미지 한 장만 받으므로 여러 장이면 가로로 붙인다
        imgs = _images(image)
        if len(imgs) > 1:
            from PIL import Image
            ims = [Image.open(i).convert("RGB") for i in imgs]
            ims = [im.resize((int(im.width * 640 / im.height), 640)) for im in ims]
            sheet = Image.new("RGB", (sum(im.width for im in ims), 640))
            x = 0
            for im in ims:
                sheet.paste(im, (x, 0))
                x += im.width
            tmp = Path(__file__).parent / "data" / "_sheet_tmp.jpg"
            sheet.save(tmp, quality=85)
            imgs = [tmp]
        inp["image"] = sources._data_uri(imgs[0])
    out = sources._replicate(REPLICATE_LLM, inp)
    return "".join(out) if isinstance(out, list) else out


def _openai(prompt, image=None):
    """윙스팜 루트 OPENAI_API_KEY 로 문구·해부·채팅 (영상 AI 장면 생성은 아님)."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY 없음")
    content = [{"type": "text", "text": prompt}]
    for path in _images(image):
        raw = Path(path).read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        mime = "image/jpeg"
        suf = Path(path).suffix.lower()
        if suf == ".png":
            mime = "image/png"
        elif suf in (".webp",):
            mime = "image/webp"
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
    body = json.dumps({
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.4,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def ask(prompt, image=None):
    """LLM 답을 문자열로. 모두 실패하면 RuntimeError."""
    errors = []
    if os.environ.get("FAL_KEY"):
        try:
            return _fal(prompt, image), "fal"
        except Exception as e:
            errors.append(f"fal: {e}")
    if os.environ.get("REPLICATE_API_TOKEN"):
        try:
            return _replicate(prompt, image), "replicate"
        except Exception as e:
            errors.append(f"replicate: {e}")
    if os.environ.get("OPENAI_API_KEY"):
        try:
            return _openai(prompt, image), "openai"
        except Exception as e:
            errors.append(f"openai: {e}")
    print("  ! AI 연결 실패: " + "; ".join(errors), flush=True)
    raise RuntimeError("AI에 연결하지 못했어요. 인터넷 연결과 .env 의 키를 확인하고 잠시 뒤 다시 시도해 주세요."
                       if errors else "AI 키가 없어요. FAL_KEY·REPLICATE_API_TOKEN·OPENAI_API_KEY 중 하나를 넣어 주세요.")


def parse_json(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("JSON이 없습니다")
    return json.loads(m.group(0))


# ---------- 사진으로 품목 알아보기 ----------

def guess_category(name):
    words = {"수산": "생선 갈치 고등어 굴 전복 새우 게 오징어 문어 연어 멸치 김 미역 조개 꼬막 홍합 장어 광어 우럭",
             "축산": "한우 소고기 돼지 삼겹 닭 오리 계란 달걀 양고기",
             "채소": "배추 무 감자 고구마 양파 대파 마늘 당근 버섯 상추 오이 호박 옥수수 토마토 고추 시금치",
             "가공": "떡 김치 잼 즙 청 과자 젓갈 장 꿀 말랭이 즙"}
    for cat, ws in words.items():
        if any(w in name for w in ws.split()):
            return cat
    return "과일"


def identify(photo, name=""):
    """{"ko", "en", "category", "look", "via"} — 실패해도 이름으로 추정한 값을 돌려준다."""
    prompt = (
        "이 사진은 한국 농수산물 위탁판매자가 올린 상품 사진입니다."
        + (f" 판매자가 적은 상품명은 '{name}'입니다." if name else "")
        + " 사진에 다른 상품이 함께 있어도 판매 상품 하나만 설명하세요."
        + " JSON 하나로만 답하세요: "
        '{"ko": 한국어 품목명(판매자 상품명이 있으면 그대로), '
        '"en": 이미지 생성 AI에 넣을 영어 설명(품종·모양·색이 드러나게 15단어 이내), '
        '"stock": 무료 스톡 영상 검색용 영어 1~2단어(예: tangerine, snow crab), '
        '"category": "과일"|"채소"|"수산"|"축산"|"가공" 중 하나, '
        '"look": 사진 속 상품의 생김새를 한국어 한 문장으로, '
        '"real_photo": 카메라로 찍은 실제 사진이면 true, 일러스트·그래픽·AI 그림이면 false}')
    try:
        text, via = ask(prompt, photo)
        d = parse_json(text)
        if d.get("category") not in CATEGORIES:
            d["category"] = guess_category(name or d.get("ko", ""))
        d["via"] = via
        if name:
            d["ko"] = name
        return d
    except Exception as e:
        en, stock = sources.names({"name": name})
        return {"ko": name, "en": en, "stock": stock, "category": guess_category(name), "look": "", "via": "규칙",
                "error": str(e)}


# ---------- 템플릿 칸 채우기 ----------

RULES = """규칙:
- 제목·이름·단위 칸을 뺀 모든 칸은 끝맺은 해요체 문장(…해요, …하세요, …인가요?)으로 씁니다.
  배열 칸의 항목 하나하나도 15자 이상의 문장입니다. '노지재배'처럼 명사 하나로 쓰지 않습니다(카드 템플릿만 예외).
- 문장은 TTS가 읽고 자막으로도 나오므로 한 문장 15~32자, 영어 단어·이모지 금지.
  숫자·단위는 자막에서 잘 보이게 아라비아 숫자로 씁니다(예: 12개, 5kg, 13~15Brix, 20~22과). 목소리는 자동으로 읽어 줍니다.
- 판매자는 산지 상품을 받아 파는 위탁판매자입니다. 메모에 직접 재배·어획이라고 적혀 있지 않으면 '직접 키운', '저희 농장', '저희가 잡은' 같은 생산자 표현을 쓰지 않습니다('산지에서 바로 보내요'처럼 씁니다).
- 판매자 정보에 없는 사람·경력(과수원 사장님, 30년 농부, 경매사 등)을 말하는 사람으로 내세우지 않습니다.
  레퍼런스가 '권위형'이면 '산지에서 직접 보내는 판매자가 보는 기준'처럼 판매자 자신의 시점으로 바꿉니다.
- 각 문장의 핵심어 1~2개를 *별표*로 감싸면 화면에서 노란색으로 강조됩니다(카드 템플릿 제외).
- 품목에 대해 널리 알려진 정확한 정보만 씁니다. 모르면 일반적인 표현으로 씁니다.
- 판매자가 알려 주지 않은 숫자(가격, 개수, 당도, 무게, 기간, 산지명, 수상 경력)는 절대 지어내지 않습니다.
  판매자가 범위(예: 50~60개)만 줬으면 숫자 칸은 null로 두고, 문장에는 범위를 그대로 씁니다(예: 50~60개).
- 판매자 메모에 없는 판매 조건·사실(당일 수확, 가정용·선물용 같은 등급, 무료 배송, 보관 기간 등)을 지어내지 않습니다.
- 건강·효능 주장, '당도 2배' 같은 과장 수치, 특정 업체·마트 비방은 쓰지 않습니다.
- 레퍼런스는 '훅 공식과 말투'만 빌립니다. 문장을 베끼지 않습니다.
- 제목(title1, title2)은 각각 max 글자 수를 넘기지 않습니다."""


def field_brief(tpl):
    lines = []
    for f in tpl.get("fields", []):
        if f["type"] == "source":
            continue
        desc = f"- {f['key']} ({f['label']})"
        if f["type"] == "list":
            desc += f": 문자열 배열 {f.get('count', 3)}개"
        elif f["type"] == "number":
            desc += ": 숫자. 판매자가 알려 준 값이 없으면 null"
        else:
            desc += ": 문자열"
        if f.get("max"):
            desc += f", {f['max']}자 이내"
        if f.get("hint"):
            desc += f". {f['hint']}"
        lines.append(desc)
    return "\n".join(lines)


def draft(tpl_name, tpl, product, ref=None, hooks=None):
    """템플릿 fields에 맞는 값 dict와 생성 경로("fal"/"replicate"/"규칙")."""
    facts = {k: product.get(k) for k in ("name", "category", "look", "origin", "price", "unit", "count", "memo")
             if product.get(k) not in (None, "")}
    ref_text = "없음 (템플릿 기본 말투)"
    if ref:
        h = (hooks or {}).get(ref.get("hook"), {})
        ref_text = (f"제목 '{ref['title']}' (조회수 {ref['views']:,}회)\n"
                    f"훅 유형: {h.get('label', ref.get('hook'))} — 공식: {h.get('formula', '')}\n"
                    f"참고할 점: {ref.get('why', '')}")
    prompt = f"""당신은 한국 농수산물 산지직송 숏폼(유튜브 쇼츠·릴스·틱톡) 카피라이터입니다.
아래 템플릿 칸을 채워 주세요.

[템플릿] {tpl_name} — {tpl.get('name')}
쓰임: {tpl.get('when', '')}

[레퍼런스 영상]
{ref_text}

[상품 정보 (판매자가 준 사실)]
{json.dumps(facts, ensure_ascii=False)}

[채울 칸]
{field_brief(tpl)}

{RULES}

JSON 객체 하나로만 답하세요. 키는 위 칸 이름 그대로."""
    try:
        text, via = ask(prompt)
        out = clean(tpl, parse_json(text))
    except Exception as e:
        print(f"  ! AI 초안 실패, 기본 문구 사용: {e}")
        return clean(tpl, preset(tpl_name, product)), "규칙"
    # 숫자 칸은 판매자 정보에 그대로 있는 숫자만 남긴다 (AI가 범위를 하나로 정하거나 지어낸 숫자 차단)
    given = set(re.findall(r"\d+", json.dumps(facts, ensure_ascii=False).replace(",", "")))
    for f in tpl.get("fields", []):
        if f["type"] == "number" and out.get(f["key"]) is not None and str(out[f["key"]]) not in given:
            out[f["key"]] = None
    return out, via


def clean(tpl, d):
    """칸 형식 맞추기: 리스트 개수, 숫자, 글자 수."""
    out = {}
    for f in tpl.get("fields", []):
        k, v = f["key"], d.get(f["key"])
        if f["type"] == "source":
            continue
        if f["type"] == "list":
            v = [str(x[0] if isinstance(x, list) else x).strip() for x in (v or []) if x]
            v = v[:f.get("max", 4)]
        elif f["type"] == "number":
            try:
                v = int(str(v).replace(",", "")) if v not in (None, "", "null") else None
            except ValueError:
                v = None
        else:
            v = str(v or "").strip()
        out[k] = v
    # 카드와 판매형(make_short)은 *강조* 표시를 쓰지 않는다
    if tpl.get("output") == "cards" or tpl.get("engine") == "short":
        out = {k: (v.replace("*", "") if isinstance(v, str) else
                   [s.replace("*", "") for s in v] if isinstance(v, list) else v) for k, v in out.items()}
    return out


# 화면에 보이는 목소리 이름 → 엔진 목소리 (server.VOICES 가 이것을 쓴다)
# 기본 2개는 무료(edge-tts), Gemini 4개는 Google Gemini TTS (문장당 1원 안팎)
VOICES = {"여성": "ko-KR-SunHiNeural", "남성": "ko-KR-InJoonNeural",
          "Gemini 여성 · 또렷한": "gemini:Kore", "Gemini 여성 · 밝은": "gemini:Zephyr",
          "Gemini 남성 · 활기찬": "gemini:Puck", "Gemini 남성 · 차분한": "gemini:Charon"}
VOICE_NAMES = list(VOICES)

CHAT_PROMPT = """당신은 숏폼 영상 편집자입니다. 판매자가 만든 영상의 설정을 말로 고쳐 달라고 합니다.

[영상 종류] {kind}
[상품] {product}
[현재 설정 JSON]
{fields}

[바꿀 수 있는 것]
- 문장·제목·안내 바 문구, 장면 추가·삭제·순서 바꾸기(리스트 항목)
- 장면 그림(source): {scenes}
- music(배경음악 분위기): 밝은 | 경쾌한 | 잔잔한 | 시장활기 | 없음
- voice(목소리): {voices}
- voice_mode(복제 영상만): narration(내레이션) | text_only(자막+음악)
- 장면을 새로 넣을 때 role은 TIP, 마지막 마무리는 CTA. 숫자 칸(개수·가격)은 판매자 정보에 있는 숫자로만 바꿉니다.
[바꿀 수 없는 것] 영상 속 물체 지우기·사람 등장시키기·실제 촬영 장면 같은 요청. 이런 요청은 설정을 그대로 두고 reply에서 가능한 대안을 말합니다.

{rules}

[판매자 요청] {message}

JSON 하나로만 답하세요: {{"reply": "무엇을 어떻게 바꿨는지 한두 문장(해요체)", "fields": 전체 설정(현재 설정과 같은 키 구조, 바꾸지 않은 칸도 모두 포함)}}"""


def chat_edit(kind, fields, message, product, scene_ids):
    """대화로 영상 설정 고치기 → (새 설정, 답변). 구조가 깨지면 원래 값을 지킨다."""
    facts = {k: product.get(k) for k in ("name", "category", "origin", "price", "unit", "memo") if product.get(k)}
    prompt = CHAT_PROMPT.format(kind=kind, product=json.dumps(facts, ensure_ascii=False),
                                fields=json.dumps(fields, ensure_ascii=False, indent=1),
                                scenes=", ".join(scene_ids), rules=RULES, message=message,
                                voices=" | ".join(VOICE_NAMES))
    text, _ = ask(prompt)
    d = parse_json(text)
    new = d.get("fields") or {}
    given = set(re.findall(r"\d+", json.dumps(facts, ensure_ascii=False).replace(",", "")))
    out = {}
    for k, v in fields.items():
        nv = new.get(k, v)
        if isinstance(v, list):
            if not isinstance(nv, list):
                nv = v
            textkey = "say" if v and isinstance(v[0], dict) and "say" in v[0] else "text"
            fixed = []
            for i, item in enumerate(nv):
                old = v[i] if i < len(v) and isinstance(v[i], dict) else (v[-1] if v and isinstance(v[-1], dict) else {})
                if isinstance(item, str):
                    item = {textkey: item}
                if not isinstance(item, dict):
                    continue
                sent = str(item.get("say") or item.get("text") or "").strip()
                if not sent:
                    continue
                row = {textkey: sent,
                       "source": item.get("source") if item.get("source") in scene_ids else old.get("source", scene_ids[0])}
                if "label" in item or "label" in old:
                    row["label"] = str(item.get("label", old.get("label", "")))[:12]
                if "role" in item or "role" in old:
                    row["role"] = str(item.get("role") or old.get("role") or "TIP").upper()
                fixed.append(row)
            nv = fixed or v
        elif isinstance(v, (int, float)) or v is None or k in ("count", "price", "original_price"):
            # 숫자 칸은 판매자 정보에 있는 숫자로만 바꿀 수 있다
            s = str(nv if nv is not None else "").replace(",", "").strip()
            nv = (int(s) if s.isdigit() and (s in given or str(v) == s) else v)
        elif isinstance(v, bool):
            nv = bool(nv)
        else:
            nv = str(nv if nv is not None else "")
            if k in ("title1", "title2"):
                nv = nv[:16]
        out[k] = nv
    if new.get("music") in ("밝은", "경쾌한", "잔잔한", "시장활기", "없음"):
        out["music"] = new["music"]
    if new.get("voice") in VOICE_NAMES:
        out["voice"] = new["voice"]
    if new.get("voice_mode") in ("narration", "text_only"):
        out["voice_mode"] = new["voice_mode"]
    return out, str(d.get("reply") or "고쳤어요.")


POST_PROMPT = """한국 농수산물 산지직송 판매자가 방금 숏폼 영상을 만들었습니다. 플랫폼별로 올릴 글을 써 주세요.
[상품] {product}
[영상 내용] {script}
{rules}
- 제목은 검색어(품목명 + 고르는 법/보관법 등)가 앞에 오게, 28자 이내.
- 해시태그는 품목·제철·산지·정보 키워드 위주로. 과장·질병 관련 태그 금지.
- 주문 안내는 '프로필 링크'로. 가격·숫자는 상품 정보에 있는 것만.
- 이 글은 눈으로 읽는 글입니다. 별표(*)를 쓰지 않고, 숫자·단위는 '5kg', '50~60개'처럼 아라비아 숫자로 씁니다.
JSON 하나로만 답하세요:
{{"youtube": {{"title": "", "description": "3~4줄", "tags": ["#태그", ...6~10개]}},
 "instagram": {{"caption": "첫 줄 훅 + 본문 3~5줄 + 저장 유도", "tags": [...10~15개]}},
 "tiktok": {{"caption": "한두 줄", "tags": [...4~6개]}},
 "naver": {{"title": "네이버 클립 제목", "caption": "2~3줄"}}}}"""

HOOK_PROMPT = """숏폼의 첫 문장(훅)만 다르게 3가지 써 주세요. 나머지 장면은 그대로 씁니다.
[상품] {product}
[영상 종류] {kind}
[지금 첫 문장] {hook}
[나머지 흐름] {rest}
{rules}
- 서로 다른 훅 유형 3가지: 질문형, 부정 경고형(예: 이렇게 하면 안 돼요), 숫자·쉬움형 중에서.
- 첫 2초 안에 읽히게 22자 이내. *핵심어* 1개.
JSON 하나로만 답하세요: {{"hooks": [{{"type": "유형", "text": "문장"}} x3]}}"""


def post_pack(product, script, kind):
    facts = {k: product.get(k) for k in ("name", "category", "origin", "price", "unit", "memo") if product.get(k)}
    text, _ = ask(POST_PROMPT.format(product=json.dumps(facts, ensure_ascii=False), script=script, rules=RULES))
    pack = parse_json(text)

    def clean_text(v):
        if isinstance(v, str):
            return v.replace("*", "")
        if isinstance(v, list):
            return [clean_text(x) for x in v]
        if isinstance(v, dict):
            return {k: clean_text(x) for k, x in v.items()}
        return v
    return clean_text(pack)


def hook_variants(product, kind, hook, rest):
    facts = {k: product.get(k) for k in ("name", "category", "origin", "unit", "memo") if product.get(k)}
    text, _ = ask(HOOK_PROMPT.format(product=json.dumps(facts, ensure_ascii=False), kind=kind, hook=hook,
                                     rest=" / ".join(rest)[:400], rules=RULES))
    hooks = [h for h in parse_json(text).get("hooks", []) if isinstance(h, dict) and h.get("text")]
    return hooks[:3]


def _josa(word, a, b):
    """받침 있으면 a, 없으면 b (예: 이/가)."""
    if not word:
        return a
    c = ord(word[-1]) - 0xAC00
    return a if 0 <= c <= 11171 and c % 28 else b


def preset(tpl_name, p):
    """AI를 못 쓸 때의 기본 문구. 품목에 상관없이 맞는 일반 표현만 쓴다."""
    n = p.get("name") or "상품"
    i_ga = _josa(n, "이", "가")
    count, unit = p.get("count"), p.get("unit_word") or "개"
    base = {
        "고르는법": {"title1": f"{n} 고르는 법", "title2": "딱 3가지만 보세요",
                 "hook": f"{n} 살 때 이것만 보면 *실패* 없어요.",
                 "items": ["색이 *선명*하고 윤기가 나는 걸 고르세요.", "겉에 *흠집*이나 무른 곳이 없는지 보세요.",
                           "크기에 비해 *묵직*한 게 좋아요."],
                 "outro": "*저장*해 두고 장 볼 때 꺼내 보세요.", "info": f"이렇게 고른 {n}, 프로필 링크에"},
        "보관경고": {"title1": f"{n} 이렇게 두면", "title2": "금방 상해요",
                 "hook": f"{n}, 받자마자 *아무 데나* 두셨나요?",
                 "wrong": ["상자째 *실온*에 두면 금방 상할 수 있어요."],
                 "right": ["하나씩 *감싸서* 냉장 보관해 주세요.", "씻는 건 *먹기 직전*에 하세요."],
                 "outro": "*저장*해 두고 택배 받는 날 꺼내 보세요.", "info": f"산지에서 바로 보내는 {n}"},
        "손질법": {"title1": f"{n} 손질법", "title2": "세 번이면 끝",
                "hook": f"{n} 손질, *생각보다* 쉬워요.",
                "steps": ["흐르는 물에 *깨끗이* 씻어 주세요.", "먹기 좋게 *손질*해 주세요.", "*한입 크기*로 썰면 끝이에요."],
                "outro": "이렇게 하면 누구나 쉽게 드실 수 있어요.", "info": f"{n} 주문은 프로필 링크"},
        "물량리빌": {"title1": f"{n} 한 박스에", "title2": "몇 개 들어갈까요?",
                 "hook": f"{n} *한 박스*, 몇 {unit} 들어가는지 세어 볼게요.",
                 "steps": [f"고른 {n}{_josa(n, '을', '를')} *하나씩* 담아요."], "count": count, "unit": unit,
                 "reveal": f"이만큼 *꽉 차게* 들어가요.", "outro": "이 구성 그대로 보내드려요. 프로필 링크에서 주문하세요.",
                 "info": "주문은 프로필 링크"},
        "비교": {"title1": "가정용 vs 선물용", "title2": "뭐가 다를까?",
               "hook": f"{n} 가정용이랑 선물용, *뭐가* 다를까요?",
               "a_name": "가정용", "a_say": "가정용은 크기가 *조금씩* 달라도 맛은 같아요.",
               "b_name": "선물용", "b_say": "선물용은 크기와 모양을 *고르게* 골라 담았어요.",
               "verdict": "드실 거면 *가정용*, 선물하실 거면 *선물용*이에요.", "info": "두 가지 모두 프로필 링크에"},
        "짧은루프": {"title1": f"{n} 오늘 출발", "title2": "산지에서 바로",
                 "line1": f"산지에서 고른 {n}, *오늘* 출발해요.", "line2": "주문은 *프로필 링크*예요.",
                 "info": "주문은 프로필 링크"},
        "카드": {"title1": f"{n} 고르는 법", "title2": "3가지만 기억하세요",
               "items": ["색이 선명하고, 윤기가 나는 것", "흠집이나, 무른 곳이 없는 것", "크기에 비해, 묵직한 것"],
               "outro_card": "저장해 두고 장 볼 때 꺼내 보세요", "info": "프로필 링크에서 주문"},
        "판매형": {"hook_text": f"제철 {n}, 산지에서 바로 보내드려요.", "origin": p.get("origin", ""),
                "features": [f"산지에서 직접 고른 {n}{i_ga}에요." if i_ga == "이" else f"산지에서 직접 고른 {n}예요.",
                             "주문 들어오면 바로 보내요."],
                "price": p.get("price"), "unit": p.get("unit", ""),
                "cta": "수량이 한정돼 있어요. 프로필 링크에서 지금 주문하세요."},
    }
    return base.get(tpl_name, {})
