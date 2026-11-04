"""수집한 후보 → 레퍼런스 라이브러리.

1) 제목으로 분류 (Claude, 60개씩): 농수산물 판매에 참고할 만한지, 템플릿·훅·품목·이유
2) 고른 레퍼런스의 프레임을 보고 장면 구조 분석 (analyzer.analyze, 동시 4개)

python studio/tools/build_library.py [--analyze N]     → studio/data/refs_auto.json
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(STUDIO))
sys.path.insert(0, str(STUDIO.parent))
import analyzer  # noqa: E402
import copywriter  # noqa: E402

DATA = STUDIO / "data"
CANDS = DATA / "ref_candidates.json"
CLASS = DATA / "ref_classes.json"
OUT = DATA / "refs_auto.json"
TEMPLATES = ["고르는법", "보관경고", "손질법", "물량리빌", "비교", "짧은루프", "판매형", "깎기ASMR", "현장리포트"]

PROMPT = """아래는 유튜브 쇼츠 제목 목록입니다. 한국 농수산물 위탁판매자가 '내 상품 홍보 숏폼'의 레퍼런스로 쓸 만한지 분류해 주세요.

템플릿 뜻: 고르는법(좋은 상품 고르는 기준), 보관경고(보관법·하지 말아야 할 것), 손질법(손질·자르기·먹는 법 단계),
물량리빌(한 박스·몇 개·양 공개), 비교(A vs B, 가격대별), 짧은루프(상품을 짧게 보여 주는 판매·수확 컷),
판매형(직접 판매 홍보), 깎기ASMR(말 없이 손 기술·소리), 현장리포트(시장·경매·산지·배 위 현장)
훅 유형: {hooks}

판단 기준: 연예인·먹방·요리 레시피·해외 일반 콘텐츠·광고성 건강정보는 relevant=false. 품목 하나가 주인공이고 판매자가 따라 찍거나 만들 수 있는 구조면 true.

JSON 하나로만 답하세요: {{"items": [{{"id": 영상id, "relevant": true/false, "template": 위 템플릿 중 하나, "hook": 훅 유형 키,
"item": "품목", "category": "과일|채소|수산|축산|가공", "why": "따라 할 포인트 25자 이내"}} ...]}}

목록:
{rows}"""


def classify(cands):
    done = json.loads(CLASS.read_text(encoding="utf-8")) if CLASS.exists() else {}
    hooks = list(json.loads((STUDIO / "references.json").read_text(encoding="utf-8"))["hooks"])
    todo = [c for c in cands if c["id"] not in done]

    def run(batch):
        rows = "\n".join(f'{c["id"]} | {c["title"][:80]} | 조회수 {c["views"]:,} | 검색어: {c["queries"][0]}' for c in batch)
        text, _ = copywriter.ask(PROMPT.format(hooks=hooks, rows=rows))
        return copywriter.parse_json(text).get("items", [])

    batches = [todo[i:i + 40] for i in range(0, len(todo), 40)]
    with ThreadPoolExecutor(6) as ex:
        futs = [ex.submit(run, b) for b in batches]
        for n, f in enumerate(as_completed(futs), 1):
            try:
                for it in f.result():
                    if it.get("id"):
                        done[it["id"]] = it
            except Exception as e:
                print(f"! 분류 실패: {e}", flush=True)
            CLASS.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"분류 묶음 {n}/{len(batches)}", flush=True)
    return done


def select(cands, classes, curated_ids):
    """관련 있는 것만, 품목×템플릿마다 조회수 상위 3개까지 (다양성 유지)."""
    picked, per = [], {}
    for c in cands:  # 조회수 내림차순
        k = classes.get(c["id"])
        if not k or not k.get("relevant") or c["id"] in curated_ids or k.get("template") not in TEMPLATES:
            continue
        key = (k.get("item"), k.get("template"))
        if per.get(key, 0) >= 3:
            continue
        per[key] = per.get(key, 0) + 1
        cat = k.get("category") if k.get("category") in copywriter.CATEGORIES else (c.get("cat_hint") or "과일")
        picked.append({"id": c["id"], "template": k["template"], "item": k.get("item") or c.get("item_hint", ""),
                       "category": cat, "hook": k.get("hook") or "숫자리스트", "views": c["views"],
                       "title": c["title"], "why": k.get("why", ""), "auto": True})
    return picked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--analyze", type=int, default=0, help="조회수 상위 N개의 장면 구조까지 분석")
    args = ap.parse_args()
    cands = json.loads(CANDS.read_text(encoding="utf-8"))
    curated = json.loads((STUDIO / "references.json").read_text(encoding="utf-8"))["items"]
    classes = classify(cands)
    lib = select(cands, classes, {r["id"] for r in curated})
    OUT.write_text(json.dumps(lib, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"라이브러리 {len(lib)}개 → {OUT}", flush=True)

    if args.analyze:
        targets = curated + lib
        targets = sorted(targets, key=lambda r: -r["views"])[:args.analyze]
        todo = [r for r in targets if not (analyzer.ANALYSIS / f"{r['id']}.json").exists()]
        print(f"구조 분석 {len(todo)}개", flush=True)

        def job(r):
            return r["id"], analyzer.analyze(r["id"], {"title": r["title"], "views": r["views"]})

        with ThreadPoolExecutor(4) as ex:
            futs = [ex.submit(job, r) for r in todo]
            for n, f in enumerate(as_completed(futs), 1):
                try:
                    vid, a = f.result()
                    print(f"  [{n}/{len(todo)}] {vid} {a.get('template')} · {a.get('summary', '')[:50]}", flush=True)
                except Exception as e:
                    print(f"  [{n}/{len(todo)}] 실패: {e}", flush=True)


if __name__ == "__main__":
    main()
