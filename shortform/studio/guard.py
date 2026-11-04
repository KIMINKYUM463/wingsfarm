"""판매자를 지키는 점검 두 가지.

1) 실물 일치 점검: AI가 만든 장면 사진이 판매자가 올린 상품 사진과 같은 상품으로 보이는지 Claude가 비교한다.
   생물 상품은 '영상과 다르다'가 곧 반품·별점 1점이라, 어긋난 장면을 표시하고 다시 만들 수 있게 한다.
2) 광고 문구 점검: 식품 표시·광고법에서 문제 되기 쉬운 표현(질병 예방·치료, 효능, 과장 수치 등)을 미리 찾는다.
"""
import json
import re
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
sys.path.insert(0, str(STUDIO))
import copywriter  # noqa: E402

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}

FIDELITY_PROMPT = """두 사진을 비교해 주세요. 첫 번째는 판매자가 올린 실제 상품 사진, 두 번째는 AI가 그 상품으로 만든 광고 장면입니다.
두 번째 사진 속 상품이 첫 번째와 '같은 상품'으로 보이는지(품종·색·모양·크기·껍질 질감) 1~10점으로 매겨 주세요.
연출(배경·칼·접시·손·물방울·조명)은 달라도 됩니다. 상품 자체(품종·색·모양·크기)가 다르게 보일 때만 점수를 낮춥니다.
두 번째가 아주 가까이 찍은 클로즈업이라 상품 일부만 보이면, 전체 모양 대신 보이는 부분(색·무늬·껍질 질감)이 같은지로 판단합니다.
첫 번째가 실제 사진이 아니라 일러스트·그래픽이면 생김새(색·모양)만 비교하고 ref_is_photo를 false로 둡니다.
JSON 하나로만 답하세요: {"score": 숫자, "issue": "다르게 보이는 점 한 문장(같으면 빈 문자열)", "ref_is_photo": true/false}"""


def ref_photo(pdir):
    photos = sorted(f for f in Path(pdir).iterdir() if f.suffix.lower() in PHOTO_EXT)
    return photos[0] if photos else None


def check_shot(pdir, shot):
    """장면 하나 점검 (장면 사진이 바뀌지 않았으면 저장된 결과를 쓴다)."""
    cache = Path(pdir) / "_clips"
    frame = cache / f"ai_{shot}.jpg"
    photo = ref_photo(pdir)
    if not frame.exists() or not photo:
        return None
    store = cache / "fidelity.json"
    data = json.loads(store.read_text(encoding="utf-8")) if store.exists() else {}
    key = f"{shot}:{int(frame.stat().st_mtime)}:{photo.name}:v2"  # v2 = 클로즈업 기준을 넣은 점검
    if key in data:
        return data[key]
    try:
        text, _ = copywriter.ask(FIDELITY_PROMPT, [photo, frame])
        d = copywriter.parse_json(text)
        res = {"shot": shot, "score": int(float(d.get("score", 0))), "issue": str(d.get("issue") or ""),
               "ref_is_photo": d.get("ref_is_photo") is not False}
    except Exception as e:
        res = {"shot": shot, "score": None, "issue": f"점검 실패: {e}"}
    data = {k: v for k, v in data.items() if not k.startswith(shot + ":")}
    data[key] = res
    store.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


def shots_in_log(log):
    return sorted(set(re.findall(r"ai_(\w+)\.mp4", "\n".join(log))))


def fidelity(pdir, log):
    out = [r for r in (check_shot(pdir, s) for s in shots_in_log(log)) if r]
    for r in out:
        r["frame"] = f"ai_{r['shot']}.jpg"
    return out


# ---------- 광고 문구 점검 ----------

from guard_rules import RISKY  # noqa: E402


def lint(texts, product=None):
    """[{text, word, why, tip}] 목록. texts 는 문자열 목록.
    product 를 주면 판매자 정보에 없는 숫자(지어낸 당도·무게 등)도 찾는다."""
    given = None
    if product:
        facts = " ".join(str(product.get(k) or "") for k in ("name", "origin", "price", "original_price", "unit", "memo"))
        given = set(re.findall(r"\d+", facts.replace(",", "")))
    hits = []
    for t in texts:
        plain = (t or "").replace("*", "")
        for pat, why, tip in RISKY:
            m = re.search(pat, plain)
            if m:
                hits.append({"text": plain, "word": m.group(0), "why": why, "tip": tip})
        if given is not None and len(plain) > 4:  # '1', 'TIP 2' 같은 장면 번호는 빼고 본다
            # '3가지', '4등분' 같은 말은 두고, 무게·당도·개수·가격·기간처럼 사실이어야 하는 숫자만 본다
            for n in re.findall(r"(\d+)\s*(?:~\s*\d+\s*)?(?:kg|g\b|[Bb]rix|브릭스|과|개|알|원|만\s*원|%|퍼센트|일|시간|년|월|배|마리|미|cm|센티|키로|킬로|도)",
                                plain.replace(",", "")):
                if n not in given:
                    hits.append({"text": plain, "word": n, "why": "판매자 정보에 없는 숫자예요. AI가 지어낸 값일 수 있어요",
                                 "tip": "맞는 숫자면 상품 메모에 적어 두고, 아니면 빼 주세요"})
                    break
    return hits
