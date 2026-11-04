"""레퍼런스 후보 수집: 품목 × 형식 검색어로 유튜브 쇼츠 검색 → 조회수 상위를 모은다.

python studio/tools/collect_refs.py            → studio/data/ref_candidates.json
이미 모은 결과는 다시 검색하지 않는다(검색어별 캐시). 영상 파일은 내려받지 않고 제목·조회수·id만 모은다.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(STUDIO.parent))
import sources  # noqa: E402

DATA = STUDIO / "data"
CACHE = DATA / "search_cache.json"
OUT = DATA / "ref_candidates.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
           "Accept-Language": "ko-KR,ko;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI"}

ITEMS = {
    "과일": "수박 참외 사과 배 귤 한라봉 레드향 천혜향 딸기 복숭아 자두 포도 샤인머스캣 블루베리 체리 망고 키위 감 홍시 곶감 멜론 토마토 방울토마토 무화과 석류 자몽 오렌지 아보카도 파인애플",
    "채소": "고구마 감자 양파 마늘 대파 배추 절임배추 무 당근 옥수수 오이 애호박 표고버섯 고추 깻잎 상추 시금치 브로콜리 단호박 연근 더덕 도라지 냉이 두릅 양배추",
    "수산": "갈치 고등어 굴 전복 대게 홍게 킹크랩 꽃게 새우 대하 오징어 문어 낙지 주꾸미 연어 광어 방어 참치 멸치 김 미역 꼬막 바지락 홍합 가리비 성게 해삼 장어 과메기 굴비 명란 랍스터",
    "축산": "한우 삼겹살 목살 소갈비 닭 오리 계란 양고기 차돌박이",
    "가공": "김치 떡 꿀 젓갈 들기름 참기름 누룽지 말랭이 한과 식혜",
}
FORMATS = {
    "과일": ["{} 고르는 법", "{} 보관법", "{} 자르는 법"],
    "채소": ["{} 고르는 법", "{} 보관법", "{} 손질"],
    "수산": ["{} 손질", "{} 고르는 법", "{} 먹는 법"],
    "축산": ["{} 고르는 법", "{} 굽는 법", "{} 보관법"],
    "가공": ["{} 고르는 법", "{} 보관법", "{} 만들기 산지"],
}
GENERIC = ["산지직송 쇼츠", "산지직송 과일", "산지직송 수산물", "농부 직거래", "과일가게 사장님", "과일가게 꿀팁",
           "수산시장 꿀팁", "수산시장 가격", "택배 언박싱 과일", "과일 택배 언박싱", "한 박스 몇 개", "얼마나 들어갈까요",
           "달라고 했더니", "못난이 과일", "흠과 판매", "제철 과일", "농장 브이로그", "과일 커팅", "회 뜨기",
           "경매 현장", "가락시장", "노량진", "수확 현장", "과수원 수확", "선별 작업", "포장 작업 과일", "농산물 택배 포장",
           "마트 vs 시장", "가격 비교 과일", "싼 거 vs 비싼 거", "절대 사지 마세요", "이것만 보면 실패 없다",
           "모르면 손해 꿀팁 음식", "현지인만 아는", "사장님이 알려준", "농부가 알려주는", "어부가 알려주는",
           "양식장", "배 위에서 회", "산지 먹방", "제철 해산물", "명절 선물세트", "과일 선물세트", "농산물 판매 쇼츠",
           "스마트스토어 과일", "직거래 장터"]


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=30, context=sources.SSL_CTX).read().decode("utf-8", "replace")


def parse_views(s):
    if not s:
        return 0
    s = re.sub(r"조회수|회|views?", "", s).strip()
    m = re.search(r"([\d.,]+)\s*(억|만|천|K|M|B)?", s)
    if not m:
        return 0
    n = float(m.group(1).replace(",", ""))
    return int(n * {"억": 1e8, "만": 1e4, "천": 1e3, "K": 1e3, "M": 1e6, "B": 1e9}.get(m.group(2), 1))


def walk(o, out):
    if isinstance(o, dict):
        if "shortsLockupViewModel" in o:
            s = o["shortsLockupViewModel"]
            vid = (((s.get("onTap") or {}).get("innertubeCommand") or {}).get("reelWatchEndpoint") or {}).get("videoId")
            meta = s.get("overlayMetadata") or {}
            out.append({"id": vid, "title": (meta.get("primaryText") or {}).get("content", ""),
                        "views_text": (meta.get("secondaryText") or {}).get("content", "")})
            return
        if "videoRenderer" in o:
            v = o["videoRenderer"]
            vc = v.get("viewCountText") or {}
            out.append({"id": v.get("videoId"), "title": "".join(r["text"] for r in (v.get("title") or {}).get("runs", [])),
                        "views_text": vc.get("simpleText") or "".join(r["text"] for r in vc.get("runs", [])),
                        "channel": ((v.get("ownerText") or {}).get("runs") or [{}])[0].get("text"),
                        "length": (v.get("lengthText") or {}).get("simpleText")})
            return
        for v in o.values():
            walk(v, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, out)


def search(q):
    html = fetch("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q) + "&sp=EgIYAQ%253D%253D")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    out = []
    if m:
        walk(json.loads(m.group(1)), out)
    seen, res = set(), []
    for x in out:
        if x["id"] and x["id"] not in seen:
            seen.add(x["id"])
            x["views"] = parse_views(x.get("views_text"))
            res.append(x)
    return res


def queries():
    qs = []
    for cat, items in ITEMS.items():
        for it in items.split():
            for f in FORMATS[cat]:
                qs.append((f.format(it), cat, it))
    qs += [(q, "", "") for q in GENERIC]
    return qs


def main():
    DATA.mkdir(exist_ok=True)
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    qs = queries()
    for i, (q, cat, item) in enumerate(qs, 1):
        if q in cache:
            continue
        try:
            cache[q] = {"cat": cat, "item": item, "results": search(q)[:12]}
        except Exception as e:
            print(f"! {q}: {e}", flush=True)
            time.sleep(5)
            continue
        if i % 10 == 0:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            print(f"{i}/{len(qs)} 검색 완료", flush=True)
        time.sleep(0.8)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    cands = {}
    for q, c in cache.items():
        for r in c["results"]:
            if r["views"] < 15000:
                continue
            prev = cands.get(r["id"])
            if not prev:
                cands[r["id"]] = {**r, "queries": [q], "cat_hint": c["cat"], "item_hint": c["item"]}
            else:
                prev["queries"].append(q)
    out = sorted(cands.values(), key=lambda r: -r["views"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"검색어 {len(cache)}개, 후보 {len(out)}개 → {OUT}")


if __name__ == "__main__":
    main()
