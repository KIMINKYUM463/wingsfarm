"""레퍼런스 영상 구조 분석 (영상 파일은 내려받지 않는다).

유튜브가 공개하는 자동 프레임 이미지(시작·25%·50%·75% 지점 + 표지)와 제목·길이·설명을 모아
Claude(비전)에게 보여 주고, 장면 구성·자막 방식·훅·말투를 JSON으로 받는다.
결과는 studio/data/analysis/<id>.json, 프레임 묶음은 studio/data/frames/<id>.jpg 에 저장한다.
"""
import io
import json
import re
import sys
import threading
import urllib.request
from pathlib import Path

from PIL import Image

STUDIO = Path(__file__).resolve().parent
sys.path.insert(0, str(STUDIO.parent))
sys.path.insert(0, str(STUDIO))
import copywriter  # noqa: E402
import sources  # noqa: E402

DATA = STUDIO / "data"
FRAMES = DATA / "frames"
ANALYSIS = DATA / "analysis"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
           "Accept-Language": "ko-KR,ko;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI"}
ID_RE = re.compile(r"(?:shorts/|v=|youtu\.be/|embed/)([\w-]{11})|^([\w-]{11})$")

SCENE_IDS = ["hook", "detail", "crave", "hero", "hold", "pack", "store", "prep", "origin", "photo"]
ROLES = ["HOOK", "TIP", "STEP", "WRONG", "RIGHT", "COMPARE", "REVEAL", "SHOW", "CTA"]
MOODS = ["밝은", "경쾌한", "잔잔한", "시장활기", "없음"]


def video_id(text):
    m = ID_RE.search((text or "").strip())
    if not m:
        raise ValueError("유튜브 쇼츠 주소나 영상 id를 넣어 주세요")
    return m.group(1) or m.group(2)


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=timeout, context=sources.SSL_CTX).read()


def fetch_meta(vid):
    """제목·길이·채널·설명·조회수 (영상 페이지의 공개 정보)."""
    html = _get(f"https://www.youtube.com/shorts/{vid}").decode("utf-8", "replace")
    m = re.search(r"ytInitialPlayerResponse\s*=\s*(\{.*?\});(?:var|</script>)", html, re.S)
    if not m:
        raise RuntimeError("영상 정보를 읽지 못했어요 (비공개이거나 삭제된 영상일 수 있어요)")
    vd = json.loads(m.group(1)).get("videoDetails", {})
    views = vd.get("viewCount")
    if not views:  # 쇼츠 페이지는 videoDetails 에 조회수가 빠져 있을 때가 있어 페이지의 첫 viewCount 를 쓴다
        v = re.search(r'"viewCount":"(\d+)"', html)
        views = v.group(1) if v else 0
    return {"id": vid, "title": vd.get("title", ""), "length": int(vd.get("lengthSeconds") or 0),
            "channel": vd.get("author", ""), "views": int(views or 0),
            "description": (vd.get("shortDescription") or "")[:400]}


def fetch_frames(vid):
    """시작·25·50·75% 프레임 4장 + 표지를 세로로 맞춰 한 장으로 붙인다."""
    FRAMES.mkdir(parents=True, exist_ok=True)
    out = FRAMES / f"{vid}.jpg"
    if out.exists():
        return out
    tiles, labels = [], []
    for name, label in [("frame0", "시작"), ("maxres1", "25%"), ("maxres2", "50%"), ("maxres3", "75%"), ("oar2", "표지")]:
        try:
            img = Image.open(io.BytesIO(_get(f"https://i.ytimg.com/vi/{vid}/{name}.jpg"))).convert("RGB")
        except Exception:
            continue
        if img.width > img.height:  # 가로 프레임(양옆 흐린 여백)은 가운데 9:16만 잘라 낸다
            w = int(img.height * 9 / 16)
            img = img.crop(((img.width - w) // 2, 0, (img.width + w) // 2, img.height))
        tiles.append(img.resize((360, 640), Image.LANCZOS))
        labels.append(label)
    if len(tiles) < 2:
        raise RuntimeError("이 영상의 장면 사진을 가져오지 못했어요")
    sheet = Image.new("RGB", (360 * len(tiles), 640))
    for i, t in enumerate(tiles):
        sheet.paste(t, (360 * i, 0))
    sheet.save(out, quality=88)
    (FRAMES / f"{vid}.json").write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    return out


def frame_labels(vid):
    """프레임 묶음에 들어간 칸 이름 (예전 묶음은 너비로 칸 수만 계산)."""
    side = FRAMES / f"{vid}.json"
    if side.exists():
        return json.loads(side.read_text(encoding="utf-8"))
    sheet = FRAMES / f"{vid}.jpg"
    if not sheet.exists():
        return []
    w, h = Image.open(sheet).size
    n = max(1, round(w / (h * 9 / 16)))
    return (["시작", "25%", "50%", "75%", "표지"] if n == 5 else [f"{i + 1}" for i in range(n)])


PROMPT = """첨부 이미지는 유튜브 쇼츠 한 편에서 뽑은 프레임입니다. 왼쪽부터 [시작, 25% 지점, 50% 지점, 75% 지점, 표지(썸네일)] 순서입니다(일부 빠질 수 있음).
영상 정보: {meta}

이 영상을 '농수산물 판매자가 내 상품으로 똑같은 구조의 영상을 만들 수 있게' 분석해 주세요.
프레임 사이는 보이지 않으므로 제목·길이·화면 문구로 장면 흐름을 합리적으로 추정하고, 추정한 부분은 note에 '추정'이라고 씁니다.

JSON 하나로만 답하세요:
{{
 "summary": "이 영상이 무엇을 어떻게 보여 주는지 한 문장",
 "layout": "letterbox"(위아래 검은 영역에 제목이 고정) 또는 "full"(화면 꽉 참),
 "title_lines": [화면 위에 고정된 제목 줄들, 없으면 빈 배열],
 "caption": {{"style": "keyword_highlight"(핵심어만 색) | "plain" | "none", "color": "yellow|green|red|white|none", "size": "big|medium|small"}},
 "voice": "narration"(내레이션) | "talking_head"(사람이 직접 말함) | "text_only"(자막+음악) | "asmr"(현장 소리),
 "presenter": "face"(얼굴 나옴) | "hands"(손만) | "none",
 "setting": "촬영 장소 한 단어(비닐하우스, 주방, 시장, 매장, 배 위, 스튜디오 등)",
 "music": {MOODS} 중 하나,
 "hook": {{"text": "첫 화면 자막·말을 그대로 또는 추정", "type": {HOOKS} 중 하나}},
 "scenes": [ 4~7개, 순서대로 {{"role": {ROLES} 중 하나, "label": "화면 라벨(예: TIP 1, STEP 2) 없으면 빈 문자열",
             "shot": {SCENES} 중 이 장면과 가장 비슷한 것(hook=반 가르기·대표컷, detail=클로즈업, crave=먹는 장면, hero=진열·상자, hold=손에 들기, pack=포장, store=보관, prep=손질, origin=밭·바다·현장 풍경, photo=상품 사진),
             "purpose": "이 장면이 시청자에게 전달하는 내용을 완결된 한 문장으로(예: 상한 귤을 먼저 골라내라고 알려 준다)",
             "text": "화면 자막을 또렷하게 읽을 수 있을 때만 그대로. 흐리거나 잘려서 확실하지 않으면 빈 문자열",
             "seconds": 장면 길이(초), "note": "화면에 보이는 것(구도·손·소품)과 추정 여부"}} ],
 "pacing": "빠름|보통|느림",
 "why": ["이 영상이 잘 된 이유 2~3개(구체적으로)"],
 "copy_style": "말투 특징 한 줄(예: 반말·질문형·숫자 강조)",
 "template": {TEMPLATES} 중 가장 가까운 것,
 "item": "영상 속 품목(한국어)",
 "category": "과일|채소|수산|축산|가공|기타",
 "relevant": 농수산물 판매에 참고할 만하면 true, 아니면 false
}}"""


_LOCKS = {}
_LOCKS_GUARD = threading.Lock()


def load(vid):
    """저장된 분석 (프레임 칸 이름을 붙여서). 없으면 None."""
    out = ANALYSIS / f"{video_id(vid)}.json"
    if not out.exists():
        return None
    a = normalize(json.loads(out.read_text(encoding="utf-8")))
    a["frames"] = frame_labels(vid)
    return a


def analyze(vid, meta=None, force=False):
    """분석 JSON (캐시 우선). 같은 영상을 동시에 두 번 분석하지 않는다(유료 호출 중복 방지)."""
    vid = video_id(vid)
    with _LOCKS_GUARD:
        lock = _LOCKS.setdefault(vid, threading.Lock())
    with lock:
        if not force and (a := load(vid)):
            return a
        return _analyze(vid, meta)


def _analyze(vid, meta):
    ANALYSIS.mkdir(parents=True, exist_ok=True)
    out = ANALYSIS / f"{vid}.json"
    meta = {**(meta or {})}
    try:
        meta = {**fetch_meta(vid), **{k: v for k, v in meta.items() if v}}
    except Exception as e:
        if not meta.get("title"):
            raise
        print(f"  ! 영상 정보 실패({vid}): {e}")
    sheet = fetch_frames(vid)
    hooks = list(json.loads((STUDIO / "references.json").read_text(encoding="utf-8"))["hooks"])
    templates = ["고르는법", "보관경고", "손질법", "물량리빌", "비교", "짧은루프", "판매형", "깎기ASMR", "현장리포트", "기타"]
    prompt = PROMPT.format(meta=json.dumps({k: meta.get(k) for k in ("title", "length", "channel", "views", "description")},
                                           ensure_ascii=False),
                           MOODS=MOODS, HOOKS=hooks, ROLES=ROLES, SCENES=SCENE_IDS, TEMPLATES=templates)
    text, via = copywriter.ask(prompt, sheet)
    a = copywriter.parse_json(text)
    a = normalize(a)
    a["meta"] = meta
    a["via"] = via
    out.write_text(json.dumps(a, ensure_ascii=False, indent=1), encoding="utf-8")
    a["frames"] = frame_labels(vid)
    return a


def _seconds(v):
    m = re.search(r"\d+(?:\.\d+)?", str(v or ""))
    return max(1.0, min(20.0, float(m.group(0)))) if m else 3.0


def normalize(a):
    """모델 답을 엔진·화면이 받아들이는 값으로 정리 (빠지거나 형식이 다른 값에도 멈추지 않게)."""
    if not isinstance(a, dict):
        a = {}
    a["layout"] = a.get("layout") if a.get("layout") in ("letterbox", "full") else "full"
    a["music"] = a.get("music") if a.get("music") in MOODS else "밝은"
    a["caption"] = a.get("caption") if isinstance(a.get("caption"), dict) else {}
    a["hook"] = a.get("hook") if isinstance(a.get("hook"), dict) else {"text": str(a.get("hook") or ""), "type": ""}
    why = a.get("why")
    a["why"] = [str(w) for w in why] if isinstance(why, list) else [str(why)] if why else []
    a["title_lines"] = [str(t) for t in a.get("title_lines") or [] if t] if isinstance(a.get("title_lines"), list) else []
    for k in ("summary", "voice", "presenter", "setting", "pacing", "copy_style", "template", "item", "category"):
        a[k] = str(a.get(k) or "")
    scenes = []
    for s in a.get("scenes") or []:
        if not isinstance(s, dict):
            s = {"purpose": str(s)}
        role = str(s.get("role") or "SHOW").upper()
        shot = str(s.get("shot") or "hero").replace("ai:", "")
        scenes.append({"role": role if role in ROLES else "SHOW", "label": str(s.get("label") or "")[:12],
                       "shot": shot if shot in SCENE_IDS else "hero", "text": str(s.get("text") or ""),
                       "purpose": str(s.get("purpose") or ""),
                       "seconds": _seconds(s.get("seconds")), "note": str(s.get("note") or "")})
    if not scenes:
        scenes = [{"role": "HOOK", "label": "", "shot": "hook", "text": "", "purpose": "", "seconds": 3, "note": ""}]
    a["scenes"] = scenes[:8]
    return a


# ---------- 분석 → 영상 틀(템플릿) ----------

ROLE_KIND = {"HOOK": "HOOK", "TIP": "TIP", "STEP": "TIP", "WRONG": "TIP", "RIGHT": "TIP", "COMPARE": "TIP",
             "REVEAL": "REVEAL", "SHOW": "TIP", "CTA": "CTA"}


def source_of(shot):
    if shot == "origin":
        return "stock:origin"
    if shot == "photo":
        return "photo:1"
    return f"ai:{shot}"


def build_template(a, lines, mode_voice=None):
    """분석 결과 + 장면별 문장 → make_template.py 가 읽는 템플릿 dict.
    lines = [{"say": 문장, "source": 장면 소스, "label": 라벨, "role": 역할}, ...]
    장면을 말로 빼거나 넣어도 어긋나지 않게 각 줄이 자기 역할(role)을 들고 다닌다."""
    voice = mode_voice or a.get("voice", "narration")
    text_only = voice in ("text_only", "asmr")
    segs = []
    for i, ln in enumerate(lines):
        if not ln.get("say"):
            continue
        s = a["scenes"][i] if i < len(a["scenes"]) else {}
        role = ln.get("role") or s.get("role") or "TIP"
        seg = {"kind": ROLE_KIND.get(role, "TIP"), "source": ln.get("source") or source_of(s.get("shot", "hero"))}
        if text_only:
            seg["text"] = ln["say"]
            # 레퍼런스 템포를 따르되, 자막을 다 읽을 시간(1초에 7자 정도)은 남긴다
            read = len(ln["say"].replace("*", "").replace(" ", "")) / 7 + 0.8
            seg["dur"] = round(max(2.0, read, min(5.0, _seconds(s.get("seconds")))), 1)
        else:
            seg["say"] = ln["say"]
        label = ln.get("label", "")
        if role in ("WRONG", "RIGHT"):
            seg["mark"] = "X" if role == "WRONG" else "O"
        elif label:
            seg["label"] = label
        segs.append(seg)
    return {"name": f"레퍼런스 복제 · {a.get('meta', {}).get('title', '')[:30]}", "kind": "자동",
            "layout": a.get("layout", "full"), "title": ["{title1}", "{title2}"], "info": "{info}",
            "segments": segs}


CLONE_PROMPT = """당신은 한국 농수산물 산지직송 숏폼 카피라이터입니다.
아래 '레퍼런스 영상 분석'의 장면 구조와 말투를 그대로 따라, 판매자의 상품으로 장면별 문장을 새로 써 주세요.

[레퍼런스 분석]
{analysis}

[판매자 상품 (사실 정보)]
{facts}

{rules}
- 장면 수와 순서는 레퍼런스와 같게 {n}개. 각 장면의 역할(role)·라벨·전달 내용(purpose)을 지킵니다.
- 각 장면 문장은 그 장면의 purpose를 '내 상품'에 맞게 정확한 정보로 다시 쓴, 끝맺은 문장입니다. 앞뒤 장면과 이어서 하나의 이야기가 되게 씁니다.
- 모든 문장은 10자 이상입니다. '오늘은', '구독 좋아요'처럼 조각이나 채널 홍보 문구는 쓰지 않습니다.
  purpose가 '구독 유도'인 장면은 '저장해 두세요'나 '주문은 프로필 링크' 같은 판매자용 마무리로 바꿉니다.
- 정보(보관법·고르는 법 등)는 그 품목에 대해 널리 알려진 올바른 방법만 씁니다. 확실하지 않은 방법은 쓰지 않습니다.
- 자막만 나오는 영상(voice가 text_only/asmr)이면 각 문장을 16자 안팎의 짧은 완결 문장으로 씁니다.

JSON 하나로만 답하세요:
{{"title1": "화면 위 제목 1줄(13자 이내, 레퍼런스에 제목이 없으면 빈 문자열)", "title2": "2줄(13자 이내 또는 빈 문자열)",
 "info": "아래 노란 안내 바 한 줄(22자 이내)",
 "lines": [{{"say": "장면 문장", "label": "라벨 또는 빈 문자열"}} ... {n}개]}}"""


def clone_draft(a, product):
    facts = {k: product.get(k) for k in ("name", "category", "look", "origin", "price", "unit", "memo")
             if product.get(k) not in (None, "")}
    # 화면 문구(text)는 프레임을 읽은 것이라 깨진 경우가 많아 넘기지 않는다 (모델이 그대로 베끼는 문제)
    brief = {k: a.get(k) for k in ("summary", "layout", "voice", "copy_style", "pacing")}
    brief["hook_type"] = (a.get("hook") or {}).get("type")
    brief["has_fixed_title"] = bool(a.get("title_lines"))
    brief["scenes"] = [{"role": s["role"], "label": s["label"], "purpose": s.get("purpose") or s.get("note", ""),
                        "seconds": s.get("seconds")} for s in a["scenes"]]
    prompt = CLONE_PROMPT.format(analysis=json.dumps(brief, ensure_ascii=False, indent=1),
                                 facts=json.dumps(facts, ensure_ascii=False), rules=copywriter.RULES, n=len(a["scenes"]))
    try:
        text, via = copywriter.ask(prompt)
        d = copywriter.parse_json(text)
    except Exception as e:
        # 남의 영상 자막을 베끼지 않도록 문장은 비워 두고 사람이 쓰게 한다
        print(f"  ! 복제 초안 실패: {e}")
        d = {"title1": "", "title2": "", "info": "주문은 프로필 링크", "lines": []}
        via = "규칙"
    lines = [l if isinstance(l, dict) else {"say": str(l)} for l in d.get("lines") or []]
    while len(lines) < len(a["scenes"]):
        lines.append({"say": "", "label": a["scenes"][len(lines)]["label"]})
    lines = lines[:len(a["scenes"])]
    out = {"title1": str(d.get("title1") or "")[:16], "title2": str(d.get("title2") or "")[:16],
           "info": str(d.get("info") or "")[:26],
           "lines": [{"say": str(l.get("say") or ""), "label": str(l.get("label") or s["label"]),
                      "source": source_of(s["shot"]), "role": s["role"]} for l, s in zip(lines, a["scenes"])]}
    if (a.get("caption") or {}).get("style") != "keyword_highlight":
        for l in out["lines"]:
            l["say"] = l["say"].replace("*", "")
    return out, via


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        res = analyze(video_id(arg), force=True)
        print(json.dumps(res, ensure_ascii=False, indent=1))
