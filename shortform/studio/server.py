"""숏폼 스튜디오: 레퍼런스 갤러리 + 상품명·사진 한 장으로 템플릿 영상 만들기.

실행:  python studio/server.py      (브라우저가 http://127.0.0.1:8765 로 열린다)
       python studio/server.py --port 9000 --no-browser

이 PC 안에서만 열린다(127.0.0.1). 영상 생성은 기존 make_template.py / make_short.py 를 그대로 불러 쓴다.
"""
import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
ROOT = STUDIO.parent
STATIC = STUDIO / "static"
DATA = STUDIO / "data"
PRODUCTS = ROOT / "products"
OUTPUT = ROOT / "output"
TEMPLATES = ROOT / "templates"
sys.path.insert(0, str(STUDIO))
sys.path.insert(0, str(ROOT))

import analyzer  # noqa: E402
import copywriter  # noqa: E402
import guard  # noqa: E402
import music  # noqa: E402
import sources  # noqa: E402
from PIL import Image, ImageOps  # noqa: E402

try:  # 아이폰 사진(HEIC)
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

VOICES = copywriter.VOICES
USER_REFS = DATA / "user_refs.json"

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
STUDIO_PHOTO = "00_studio.jpg"

# 장면 소스 선택지 (화면의 드롭다운). cost=True 는 처음 한 번 AI 생성 비용이 든다.
SCENES = [
    {"id": "ai:hook", "label": "대표 컷 (반 가르기·요리)", "cost": True},
    {"id": "ai:detail", "label": "껍질·표면 클로즈업", "cost": True},
    {"id": "ai:crave", "label": "먹음직스러운 한 입", "cost": True},
    {"id": "ai:hero", "label": "상자·진열 전체 컷", "cost": True},
    {"id": "ai:hold", "label": "손에 들어 보이기", "cost": True},
    {"id": "ai:pack", "label": "박스에 담기", "cost": True},
    {"id": "ai:store", "label": "보관하는 모습", "cost": True},
    {"id": "ai:prep", "label": "손질·자르기", "cost": True},
    {"id": "stock:origin", "label": "산지 풍경 (무료 스톡)", "cost": False},
    {"id": "photo:1", "label": "올린 사진 그대로 (무료)", "cost": False},
]

# 템플릿마다 화면에 보여 줄 샘플 결과물 (참외로 만든 것)
SAMPLES = {
    "고르는법": "참외_T1_고르는법.mp4", "보관경고": "참외_T2_보관경고.mp4", "손질법": "참외_T3_손질법.mp4",
    "물량리빌": "참외_T4_물량리빌.mp4", "비교": "참외_T5_비교.mp4", "짧은루프": "참외_T6_짧은루프.mp4",
    "카드": "참외_T7_카드/01.jpg", "판매형": "참외_공감.mp4",
}
ORDER = ["고르는법", "보관경고", "손질법", "물량리빌", "비교", "짧은루프", "카드", "판매형", "깎기ASMR", "현장리포트"]


# ---------- 데이터 ----------

def load_templates():
    tpls = {}
    for f in TEMPLATES.glob("*.json"):
        t = json.loads(f.read_text(encoding="utf-8"))
        t["id"] = f.stem
        sample = SAMPLES.get(f.stem)
        if sample and (OUTPUT / sample).exists():
            t["sample"] = "/media/output/" + urllib.parse.quote(sample)
        tpls[f.stem] = t
    return dict(sorted(tpls.items(), key=lambda kv: ORDER.index(kv[0]) if kv[0] in ORDER else 99))


def load_references():
    """직접 고른 레퍼런스 + 자동 수집 라이브러리 + 사용자가 주소로 추가한 것. 분석 여부·프레임 주소를 붙인다."""
    refs = json.loads((STUDIO / "references.json").read_text(encoding="utf-8"))
    items = [dict(r, source="curated") for r in refs["items"]]
    seen = {r["id"] for r in items}
    for f, src in ((USER_REFS, "user"), (DATA / "refs_auto.json", "auto")):
        if f.exists():
            for r in json.loads(f.read_text(encoding="utf-8")):
                if r["id"] not in seen:
                    seen.add(r["id"])
                    items.append(dict(r, source=src))
    for r in items:
        r["analyzed"] = (analyzer.ANALYSIS / f"{r['id']}.json").exists()
    refs["items"] = items
    return refs


def find_ref(rid):
    return next((r for r in load_references()["items"] if r["id"] == rid), None)


def add_user_ref(a):
    """주소로 분석한 영상을 레퍼런스 목록에 넣는다."""
    meta = a.get("meta", {})
    rows = json.loads(USER_REFS.read_text(encoding="utf-8")) if USER_REFS.exists() else []
    if any(r["id"] == meta["id"] for r in rows):
        return
    hook = (a.get("hook") or {}).get("type")
    hooks = load_references()["hooks"]
    rows.insert(0, {"id": meta["id"], "template": a.get("template") if a.get("template") in ORDER else "고르는법",
                    "item": a.get("item", ""), "category": a.get("category") if a.get("category") in copywriter.CATEGORIES else "과일",
                    "hook": hook if hook in hooks else "숫자리스트", "views": meta.get("views", 0),
                    "title": meta.get("title", ""), "why": "; ".join(a.get("why", [])[:1])})
    USER_REFS.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")


PLAN_PROMPT = """당신은 농수산물 산지직송 판매자의 숏폼 운영 담당입니다. 아래 상품으로 일주일 동안 올릴 영상 {n}편을 골라 주세요.
후보는 구조 분석이 끝난 레퍼런스 영상입니다. 고른 영상의 구조를 그대로 따라 내 상품 영상을 만듭니다.

[상품] {product}
[운영 원칙]
- 정보형(고르는 법·보관·손질·개수 공개)으로 새 사람에게 노출 → 판매형·짧은 상품컷으로 구매 유도. 정보형을 절반 이상.
- 같은 품목·같은 분류 레퍼런스를 우선. 형식이 겹치지 않게 다양하게.
- 직접 촬영이 꼭 필요한 형식(사람이 얼굴로 말하는 것만으로 이루어진 영상)은 피합니다.
[후보]
{cands}

JSON 하나로만 답하세요: {{"plan": [{{"day": "월|화|수|목|금|토|일", "ref": 영상id, "platform": "올릴 곳(예: 유튜브 쇼츠·릴스)", "goal": "노출|저장|구매|신뢰",
"why": "이 상품에 이 구조를 쓰는 이유 한 문장"}} ... {n}개], "note": "이번 주 운영 팁 한 문장"}}"""


def make_plan(product_name, n=5):
    p = read_product(product_dir(product_name))
    shoot = {k for k, t in load_templates().items() if t.get("kind") == "촬영"}  # 깎기·현장처럼 직접 찍어야 하는 형식은 뺀다
    refs = [r for r in load_references()["items"] if r.get("analyzed") and r.get("template") not in shoot]
    if len(refs) < 3:
        raise ValueError("구조 분석이 끝난 레퍼런스가 아직 적어요. 잠시 뒤에 다시 시도해 주세요")
    same = [r for r in refs if r.get("category") == p.get("category")]
    pool = sorted(same, key=lambda r: -r["views"])[:45] + sorted([r for r in refs if r not in same], key=lambda r: -r["views"])[:15]
    rows = []
    for r in pool:
        a = json.loads((analyzer.ANALYSIS / f"{r['id']}.json").read_text(encoding="utf-8"))
        rows.append(f"{r['id']} | {r['title'][:50]} | {views_ko(r['views'])} | {r['template']} | {r.get('item', '')} | "
                    f"{VOICE_KO.get(a.get('voice'), '')} | {a.get('summary', '')[:70]}")
    facts = {k: p.get(k) for k in ("name", "category", "origin", "unit", "memo") if p.get(k)}
    text, _ = copywriter.ask(PLAN_PROMPT.format(n=n, product=json.dumps(facts, ensure_ascii=False), cands="\n".join(rows)))
    d = copywriter.parse_json(text)
    ids = {r["id"] for r in pool}
    plan = [x for x in d.get("plan", []) if isinstance(x, dict) and x.get("ref") in ids][:n]
    if not plan:
        raise ValueError("이번에는 기획을 만들지 못했어요. 한 번 더 눌러 주세요")
    for x in plan:
        r = next(r for r in pool if r["id"] == x["ref"])
        x.update(title=r["title"], views=r["views"], template=r["template"])
    return {"plan": plan, "note": d.get("note", "")}


VOICE_KO = {"narration": "내레이션", "talking_head": "사람이 말함", "text_only": "자막+음악", "asmr": "현장 소리"}


def views_ko(n):
    return f"{n / 1e4:.0f}만회" if n >= 1e4 else f"{n}회"


def run_plan(product_name, items, mode):
    """계획한 영상들을 차례로 초안 쓰고 작업 대기열에 넣는다 (백그라운드).
    문구를 쓰는 동안에도 '만든 영상'에 '문구 쓰는 중'으로 보이고, 실패하면 이유가 남는다."""
    pdir = product_dir(product_name)
    p = read_product(pdir)
    holders = [JOBS.placeholder(pdir.name, it) for it in items]
    for it, h in zip(items, holders):
        try:
            a = analyzer.analyze(it["ref"])
            fields, via = analyzer.clone_draft(a, p)
            if via == "규칙":
                raise RuntimeError("AI가 문구를 쓰지 못했어요. 이 영상은 열어서 직접 써 주세요")
            fields["voice_mode"] = "text_only" if a.get("voice") in ("text_only", "asmr") else "narration"
            fields.update(music=a.get("music") if a.get("music") != "없음" else "밝은", voice="여성", ai_label=True)
            JOBS.drop(h["id"])
            job = JOBS.add({"product": pdir.name, "template": "clone", "ref": it["ref"], "mode": mode, "fields": fields},
                           load_templates())
            job["plan_day"] = it.get("day")
            job["lint"] = guard.lint([l["say"] for l in fields["lines"]] + [fields.get("info", "")], p)
            JOBS.save()
        except Exception as e:
            h["status"], h["error"] = "error", str(e)
            JOBS.save()


def fidelity_report(pdir, log):
    try:
        return guard.fidelity(pdir, log)
    except Exception as e:
        return [{"shot": "?", "score": None, "issue": f"점검 실패: {e}"}]


def safe_name(name):
    name = re.sub(r'[\\/:*?"<>|]+', " ", (name or "").strip())
    name = re.sub(r"\s+", " ", name).strip(" .")
    if not name:
        raise ValueError("상품명을 입력해 주세요")
    return name[:40]


def product_dir(name):
    d = (PRODUCTS / safe_name(name)).resolve()
    if PRODUCTS.resolve() not in d.parents:
        raise ValueError("상품명이 올바르지 않습니다")
    return d


def read_product(pdir):
    f = pdir / "product.json"
    p = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    p.setdefault("name", pdir.name)
    return p


def product_info(pdir):
    p = read_product(pdir)
    photos = sorted(f for f in pdir.iterdir() if f.suffix.lower() in PHOTO_EXT) if pdir.exists() else []
    cache = pdir / "_clips"
    cached = sorted({f.stem.split("_", 1)[1] for f in cache.glob("ai_*.mp4")}) if cache.exists() else []
    keep = ("name", "category", "en_name", "look", "origin", "price", "original_price", "unit", "memo", "real_photo")
    return {**{k: p.get(k) for k in keep if p.get(k) not in (None, "")},
            "folder": pdir.name,
            "photo": f"/media/products/{urllib.parse.quote(pdir.name)}/{urllib.parse.quote(photos[0].name)}" if photos else None,
            "photos": len(photos), "cached": cached}


def list_products():
    if not PRODUCTS.exists():
        return []
    dirs = [d for d in PRODUCTS.iterdir() if d.is_dir() and (d / "product.json").exists()]
    dirs.sort(key=lambda d: (d / "product.json").stat().st_mtime, reverse=True)
    return [product_info(d) for d in dirs]


def save_photo(pdir, data_url):
    """dataURL 사진을 00_studio.jpg 로 저장. 사진이 바뀌면 예전 AI 장면은 _clips/_old_시각/ 으로 옮긴다."""
    raw = base64.b64decode(data_url.split(",", 1)[1])
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")  # 휴대폰 사진 회전 정보 반영
    except Exception:
        raise ValueError("사진을 읽지 못했어요. JPG나 PNG로 올려 주세요")
    img.thumbnail((2048, 2048))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=92)
    new = buf.getvalue()
    dest = pdir / STUDIO_PHOTO
    if dest.exists() and hashlib.md5(dest.read_bytes()).digest() == hashlib.md5(new).digest():
        return False
    cache = pdir / "_clips"
    old = [f for f in cache.glob("ai_*")] if cache.exists() else []
    if old and dest.exists():
        bak = cache / f"_old_{time.strftime('%Y%m%d_%H%M%S')}"
        bak.mkdir()
        for f in old:
            shutil.move(str(f), bak / f.name)
    dest.write_bytes(new)
    return True


def upsert_product(body):
    pdir = product_dir(body["name"])
    src = body.get("from") and product_dir(body["from"])
    if not body.get("photo") and not pdir.exists() and not (src and src.exists()):
        raise ValueError("사진을 한 장 올려 주세요")  # 빈 폴더가 남지 않게 만들기 전에 막는다
    created = not pdir.exists()
    pdir.mkdir(parents=True, exist_ok=True)
    try:
        changed = bool(body.get("photo")) and save_photo(pdir, body["photo"])
    except ValueError:
        if created:
            shutil.rmtree(pdir, ignore_errors=True)
        raise
    # 이미 있는 상품의 이름만 바꿔 저장하면 예전 폴더의 사진·정보를 가져온다
    if src and src != pdir and src.exists() and not body.get("photo"):
        old = sorted(f for f in src.iterdir() if f.suffix.lower() in PHOTO_EXT)
        if old and not any(f.suffix.lower() in PHOTO_EXT for f in pdir.iterdir()):
            shutil.copy(old[0], pdir / STUDIO_PHOTO)
        if not (pdir / "product.json").exists() and (src / "product.json").exists():
            shutil.copy(src / "product.json", pdir / "product.json")
    p = read_product(pdir)
    p["name"] = safe_name(body["name"])
    for k in ("origin", "unit", "memo"):
        if k in body:
            p[k] = (body.get(k) or "").strip()
    for k in ("price", "original_price"):
        if k in body:
            v = str(body.get(k) or "").replace(",", "").strip()
            p[k] = int(v) if v.isdigit() else None
    photos = sorted(f for f in pdir.iterdir() if f.suffix.lower() in PHOTO_EXT)
    if not photos:
        raise ValueError("사진을 한 장 올려 주세요")
    if body.get("category") in copywriter.CATEGORIES:
        p["category"] = body["category"]
    if changed or not p.get("en_name"):
        ident = copywriter.identify(photos[0], p["name"])
        p["en_name"] = p.get("en_name") if not changed and p.get("en_name") else ident.get("en")
        if ident.get("stock"):  # 없으면 sources.names 가 en_name 으로 검색한다
            p["stock_query"] = ident["stock"]
        p["look"] = ident.get("look", "")
        p["real_photo"] = ident.get("real_photo", True) is not False
        if body.get("category") not in copywriter.CATEGORIES:
            p["category"] = ident.get("category") or p.get("category") or "과일"
        p["identified_by"] = ident.get("via")
    p.setdefault("category", "과일")
    p = {k: v for k, v in p.items() if v is not None}
    (pdir / "product.json").write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")
    return product_info(pdir)


# ---------- 영상 만들기 작업 ----------

class Jobs:
    def __init__(self):
        DATA.mkdir(exist_ok=True)
        self.file = DATA / "jobs.json"
        self.jobs = []
        if self.file.exists():
            try:
                self.jobs = json.loads(self.file.read_text(encoding="utf-8"))
            except ValueError:  # 저장 도중 꺼져 깨진 파일은 옆에 두고 새로 시작
                shutil.copy(self.file, DATA / f"jobs_broken_{time.strftime('%Y%m%d_%H%M%S')}.json")
        interrupted = False
        for j in self.jobs:  # 서버가 꺼질 때 돌던 작업
            if j["status"] in ("queued", "running", "drafting"):
                j["status"], j["error"] = "error", "스튜디오가 다시 켜지면서 중단됐어요. 열어서 다시 만들어 주세요."
                interrupted = True
        self.lock = threading.RLock()
        self.q = queue.Queue()
        if interrupted:
            self.file.write_text(json.dumps(self.jobs, ensure_ascii=False, indent=1), encoding="utf-8")
        threading.Thread(target=self.worker, daemon=True).start()

    def save(self):
        with self.lock:
            text = json.dumps(self.jobs, ensure_ascii=False, indent=1)
        tmp = self.file.with_suffix(".tmp")
        with self.lock:
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, self.file)

    def snapshot(self):
        with self.lock:
            return [{k: v for k, v in j.items() if k != "log"} for j in self.jobs]

    def get(self, jid):
        with self.lock:
            return next((j for j in self.jobs if j["id"] == jid), None)

    def placeholder(self, product, item):
        """일주일 기획에서 문구를 쓰는 동안 보여 줄 자리."""
        ref = find_ref(item["ref"]) or {}
        h = {"id": f"plan_{item['ref']}_{time.strftime('%H%M%S')}", "product": product, "template": "clone",
             "template_name": f"레퍼런스 복제 · {ref.get('title', '')[:24]}", "ref": item["ref"], "mode": "",
             "fields": {}, "status": "drafting", "plan_day": item.get("day"),
             "created": time.strftime("%Y-%m-%d %H:%M"), "log": [], "result": None}
        with self.lock:
            self.jobs.insert(0, h)
        self.save()
        return h

    def drop(self, jid):
        with self.lock:
            self.jobs = [j for j in self.jobs if j["id"] != jid]

    def add(self, body, templates):
        tpl_id = body["template"]
        tpl = templates.get(tpl_id)
        if body.get("ref"):
            body["ref"] = analyzer.video_id(body["ref"])
        if tpl_id == "clone":
            if not body.get("ref"):
                raise ValueError("복제할 레퍼런스를 골라 주세요")
            if not analyzer.load(body["ref"]):
                raise ValueError("이 레퍼런스는 아직 해부하지 않았어요. 먼저 해부해 주세요")
            ref = find_ref(body["ref"]) or {}
            tpl = {"name": f"레퍼런스 복제 · {ref.get('title', body['ref'])[:24]}"}
        if not tpl or tpl.get("kind") == "촬영":
            raise ValueError("이 템플릿은 직접 촬영해야 해요")
        pdir = product_dir(body["product"])
        if not (pdir / "product.json").exists():
            raise ValueError("상품을 먼저 저장해 주세요")
        vid = base = f"{tpl_id}_{time.strftime('%m%d_%H%M%S')}"
        n = 1
        while self.get(vid):
            n += 1
            vid = f"{base}_{n}"
        job = {"id": vid, "product": pdir.name, "template": tpl_id, "template_name": tpl["name"],
               "ref": body.get("ref"), "mode": body.get("mode", "ai"), "fields": body.get("fields", {}),
               "status": "queued", "created": time.strftime("%Y-%m-%d %H:%M"), "log": [], "result": None}
        with self.lock:
            self.jobs.insert(0, job)
        self.save()
        self.q.put(vid)
        return job

    def worker(self):
        while True:
            jid = self.q.get()
            job = self.get(jid)
            try:
                job["status"] = "running"
                self.save()
                self.run(job)
            except Exception as e:
                job["status"], job["error"] = "error", f"만드는 중 문제가 생겼어요: {e}"
                job["log"].append(traceback.format_exc())
            job["finished"] = time.strftime("%Y-%m-%d %H:%M")
            self.save()

    def run(self, job):
        templates = load_templates()
        pdir = PRODUCTS / job["product"]
        name = read_product(pdir)["name"]
        runs = pdir / "_runs"
        runs.mkdir(exist_ok=True)
        cfg = runs / f"{job['id']}.json"
        fields = job["fields"]
        tpl = templates.get(job["template"], {})

        if job["template"] == "clone":
            a = analyzer.analyze(job["ref"])
            lines = [{"say": l.get("say", ""), "source": l.get("source"), "label": l.get("label", ""),
                      "role": l.get("role")} for l in fields.get("lines", [])]
            inline = analyzer.build_template(a, lines, fields.get("voice_mode"))
            cap = a.get("caption") or {}
            inline["highlight"] = cap.get("color") if cap.get("color") in ("yellow", "green", "red") else "yellow"
            if (fields.get("voice_mode") or a.get("voice")) in ("text_only", "asmr"):
                inline["bgm_volume"] = 0.5
            video = {"id": job["id"], "template": "_clone",
                     **{k: fields.get(k, "") for k in ("title1", "title2", "info")}}
            config = {"videos": [video], "inline_templates": {"_clone": inline}}
            cmd = [sys.executable, "-u", str(ROOT / "make_template.py"), str(pdir), "--only", job["id"]]
        elif tpl.get("engine") == "short":  # make_short.py 는 *강조* 표시를 모른다
            config = {k: v.replace("*", "") if isinstance(v, str) else v for k, v in fields.items() if k != "features"}
            config["features"] = [(x["text"] if isinstance(x, dict) else x).replace("*", "")
                                  for x in fields.get("features", []) if x]
            config["hook_id"] = job["id"]
            for k in ("price", "original_price"):
                config[k] = int(config[k]) if str(config.get(k) or "").isdigit() else None
            cmd = [sys.executable, "-u", str(ROOT / "make_short.py"), str(pdir), "--variants", "1"]
        else:
            video = {"id": job["id"], "template": job["template"]}
            for f in tpl.get("fields", []):
                v = fields.get(f["key"])
                if f["type"] == "list":  # 초안 그대로(문장만) 와도 템플릿의 기본 장면을 붙인다
                    srcs = f.get("sources") or ["photo:1"]
                    items = [x if isinstance(x, dict) else {"text": str(x)} for x in (v or [])]
                    video[f["key"]] = [[x["text"], x.get("source") or srcs[i % len(srcs)]]
                                       for i, x in enumerate(items) if x.get("text")]
                elif v not in (None, ""):
                    video[f["key"]] = v
            if tpl.get("output") == "cards":  # 카드 배경은 이미 만든 AI 장면 사진을 쓴다
                video["hook_source"] = fields.get("hook_source", "ai:hook")
            config = {"videos": [video]}
            cmd = [sys.executable, "-u", str(ROOT / "make_template.py"), str(pdir), "--only", job["id"]]
        # 공통 옵션: 배경음악 분위기, 목소리, AI 생성 표시
        mood = fields.get("music")
        if mood and mood != "없음":
            try:
                bgm = music.get_bgm(mood)
            except Exception as e:  # 음악이 없어도 영상은 만든다
                job["log"].append(f"배경음악을 준비하지 못해 음악 없이 만들어요: {e}")
                bgm = None
            if bgm:
                config["bgm_file"] = str(bgm)
        if fields.get("voice") in VOICES:
            config["voice"] = VOICES[fields["voice"]]
        # Gemini 키가 있고 기본(여성/남성)이면 Gemini로 올린다
        if (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")) and not str(config.get("voice", "")).startswith("gemini:"):
            label = str(fields.get("voice") or "")
            config["voice"] = "gemini:Charon" if "남성" in label else "gemini:Kore"
        config["ai_label"] = fields.get("ai_label", True) and job["mode"] != "photo"
        motion = bool(fields.get("motion")) and tpl.get("output") != "cards"
        if motion:  # 모션그래픽 엔진(Remotion): 같은 장면 구성을 움직이는 자막·배지·도장·가격표로 그린다
            config.update(id=job["id"], mode=job["mode"])
            if tpl.get("engine") == "short":
                config["engine"] = "short"
            cmd = [sys.executable, "-u", str(ROOT / "make_motion.py"), str(pdir),
                   "--out", str(OUTPUT / f"{name}_{job['id']}.mp4")]
        cfg.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        cmd += ["--config", str(cfg)]
        if job["mode"] == "photo" and not motion:
            cmd.append("--photos-only")

        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}
        proc = subprocess.Popen(cmd, cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                env=env, encoding="utf-8", errors="replace",
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        for line in proc.stdout:
            job["log"].append(line.rstrip())
        proc.wait()

        out = OUTPUT / f"{name}_{job['id']}"
        job["fidelity"] = fidelity_report(pdir, job["log"]) if job["mode"] != "photo" else None
        if tpl.get("output") == "cards":
            cards = sorted(out.glob("*.jpg")) if out.is_dir() else []
            if cards:
                job["result"] = {"type": "cards", "files": [media_url(c) for c in cards]}
        elif out.with_suffix(".mp4").exists():
            mp4 = out.with_suffix(".mp4")
            job["result"] = {"type": "video", "file": media_url(mp4)}
            script = OUTPUT / f"{name}_{job['id']}_대본.txt"
            if script.exists():
                job["result"]["script"] = script.read_text(encoding="utf-8")
        if job["result"] and proc.returncode == 0:
            job["status"] = "done"
            job["used_ai"] = any("AI 영상 생성" in l for l in job["log"])
        else:
            job["status"] = "error"
            job["result"] = None
            text = "\n".join(job["log"][-30:])
            if "TTS" in text or "edge" in text.lower():
                job["error"] = "목소리(TTS) 만들기에 실패했어요. 인터넷 연결을 확인하고 다시 만들어 주세요."
            elif "ffmpeg" in text.lower():
                job["error"] = "영상을 합치는 중 문제가 생겼어요. 같은 설정으로 한 번 더 만들어 보세요."
            else:
                job["error"] = "영상이 만들어지지 않았어요. 같은 설정으로 한 번 더 만들어 보시고, 계속되면 '자세한 기록'을 알려 주세요."


def media_url(path):
    rel = Path(path).resolve().relative_to(OUTPUT.resolve())
    return "/media/output/" + "/".join(urllib.parse.quote(p) for p in rel.parts)


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    server_version = "ShortformStudio/1.0"

    def log_message(self, fmt, *args):  # 조용히
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    def send_file(self, path):
        if not path.is_file():
            return self.send_error(404)
        size = path.stat().st_size
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        if rng and (m := re.match(r"bytes=(\d*)-(\d*)", rng)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:
                start = max(0, size - int(m.group(2)))
            end = min(end, size - 1)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
                pass

    def media_path(self, base, rest):
        p = (base / urllib.parse.unquote(rest)).resolve()
        if base.resolve() not in p.parents:
            return None
        return p

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        try:
            if path == "/" or path == "/index.html":
                return self.send_file(STATIC / "index.html")
            if path.startswith("/static/"):
                p = self.media_path(STATIC, path[len("/static/"):])
                return self.send_file(p) if p else self.send_error(404)
            if path.startswith("/media/output/"):
                p = self.media_path(OUTPUT, path[len("/media/output/"):])
                return self.send_file(p) if p else self.send_error(404)
            if path.startswith("/media/products/"):
                p = self.media_path(PRODUCTS, path[len("/media/products/"):])
                if not p or p.suffix.lower() not in PHOTO_EXT | {".mp4", ".jpg"}:
                    return self.send_error(404)
                return self.send_file(p)
            if path.startswith("/media/frames/"):
                p = self.media_path(analyzer.FRAMES, path[len("/media/frames/"):])
                return self.send_file(p) if p else self.send_error(404)
            if path.startswith("/api/analysis/"):
                a = analyzer.load(urllib.parse.unquote(path.rsplit("/", 1)[1]))
                return self.send_json(a) if a else self.send_json({"error": "아직 해부하지 않은 영상이에요"}, 404)
            if path == "/api/bootstrap":
                refs = load_references()
                return self.send_json({
                    "templates": load_templates(), "references": refs["items"], "hooks": refs["hooks"],
                    "collected": refs.get("collected"), "scenes": SCENES, "products": list_products(),
                    "moods": list(music.MOODS) + ["없음"], "voices": list(VOICES),
                    "keys": {
                        "fal": bool(os.environ.get("FAL_KEY")),
                        "replicate": bool(os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY") or os.environ.get("REPLICATE_TOKEN")),
                        "openai": bool(os.environ.get("OPENAI_API_KEY")),
                        "pexels": bool(os.environ.get("PEXELS_API_KEY")),
                        "gemini": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
                        "aiScene": bool(os.environ.get("FAL_KEY") or os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY") or os.environ.get("REPLICATE_TOKEN")),
                    }})
            if path == "/api/products":
                return self.send_json(list_products())
            if path == "/api/jobs":
                return self.send_json(JOBS.snapshot())
            if path.startswith("/api/jobs/"):
                job = JOBS.get(urllib.parse.unquote(path.rsplit("/", 1)[1]))
                return self.send_json(job) if job else self.send_json({"error": "없는 작업"}, 404)
            self.send_error(404)
        except Exception as e:
            traceback.print_exc()
            self.send_json({"error": str(e)}, 500)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        # 다른 웹사이트가 몰래 이 스튜디오에 요청을 보내 AI 비용을 쓰지 못하게 막는다 (CSRF)
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if origin and urllib.parse.urlparse(origin).netloc != host:
            return self.send_json({"error": "다른 사이트에서 온 요청은 받지 않아요"}, 403)
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self.send_json({"error": "잘못된 요청이에요"}, 415)
        try:
            body = self.read_json()
            if path == "/api/product":
                return self.send_json(upsert_product(body))
            if path == "/api/draft":
                templates = load_templates()
                tpl = templates[body["template"]]
                pdir = product_dir(body["product"])
                p = read_product(pdir)
                refs = load_references()
                ref = next((r for r in refs["items"] if r["id"] == body.get("ref")), None)
                fields, via = copywriter.draft(body["template"], tpl, p, ref, refs["hooks"])
                return self.send_json({"fields": fields, "via": via})
            if path == "/api/render":
                return self.send_json(JOBS.add(body, load_templates()))
            if path == "/api/analyze":  # 레퍼런스 구조 분석 (주소 붙여넣기 포함)
                vid = analyzer.video_id(body.get("url") or body.get("id"))
                ref = find_ref(vid)
                a = analyzer.analyze(vid, {"title": ref["title"], "views": ref["views"]} if ref else None,
                                     force=bool(body.get("force")))
                if not ref:
                    add_user_ref(a)
                return self.send_json({"analysis": a, "ref": find_ref(vid)})
            if path == "/api/clone/draft":
                p = read_product(product_dir(body["product"]))
                rid = analyzer.video_id(body["ref"])
                ref = find_ref(rid)
                a = analyzer.analyze(rid, {"title": ref["title"], "views": ref["views"]} if ref else None)
                fields, via = analyzer.clone_draft(a, p)
                return self.send_json({"fields": fields, "via": via, "analysis": a})
            if path == "/api/chat":  # 말로 고치기
                p = read_product(product_dir(body["product"]))
                kind = "레퍼런스 복제" if body["template"] == "clone" else load_templates()[body["template"]]["name"]
                fields, reply = copywriter.chat_edit(kind, body["fields"], body["message"], p,
                                                     [s["id"] for s in SCENES])
                return self.send_json({"fields": fields, "reply": reply})
            if path == "/api/post":  # 올릴 글 (플랫폼별 제목·설명·해시태그)
                job = JOBS.get(body["job"])
                if not job or not job.get("result"):
                    raise ValueError("완성된 영상이 있어야 올릴 글을 쓸 수 있어요")
                p = read_product(PRODUCTS / job["product"])
                script = (job["result"].get("script") or "").replace("*", "")
                pack = copywriter.post_pack(p, script, job["template_name"])
                texts = []
                for v in pack.values():
                    if isinstance(v, dict):
                        texts += [str(x) for x in v.values() if isinstance(x, str)]
                job["post"] = pack
                JOBS.save()
                return self.send_json({"post": pack, "lint": guard.lint(texts, p)})
            if path == "/api/hooks":  # 첫 문장만 다른 3가지
                p = read_product(product_dir(body["product"]))
                hooks = copywriter.hook_variants(p, body.get("kind", ""), body.get("hook", ""), body.get("rest", []))
                if not hooks:
                    raise ValueError("훅을 만들지 못했어요. 다시 시도해 주세요")
                return self.send_json({"hooks": hooks})
            if path == "/api/plan":
                return self.send_json(make_plan(body["product"], int(body.get("n") or 5)))
            if path == "/api/plan/run":
                items = body.get("items") or []
                threading.Thread(target=run_plan, args=(body["product"], items, body.get("mode", "photo")),
                                 daemon=True).start()
                return self.send_json({"queued": len(items)})
            if path == "/api/jobs/hide":  # 목록에서만 뺀다 (영상 파일은 output 폴더에 남는다)
                job = JOBS.get(body["job"])
                if not job:
                    raise ValueError("이미 목록에 없는 영상이에요")
                if job["status"] not in ("done", "error"):
                    raise ValueError("만드는 중인 영상은 뺄 수 없어요. 끝난 뒤에 빼 주세요")
                JOBS.drop(job["id"])
                JOBS.save()
                return self.send_json({"ok": True})
            if path == "/api/lint":
                pdir = body.get("product") and product_dir(body["product"])
                p = read_product(pdir) if pdir and (pdir / "product.json").exists() else None
                return self.send_json({"hits": guard.lint(body.get("texts", []), p)})
            if path == "/api/reshoot":  # 실물과 다른 AI 장면을 치워 두면 다음 영상에서 새로 만든다
                pdir = product_dir(body["product"])
                shot = re.sub(r"\W", "", body["shot"])
                cache = pdir / "_clips"
                bak = cache / f"_old_{time.strftime('%Y%m%d_%H%M%S')}"
                moved = [f for f in cache.glob(f"ai_{shot}.*")]
                if moved:
                    bak.mkdir(exist_ok=True)
                    for f in moved:
                        shutil.move(str(f), bak / f.name)
                return self.send_json({"ok": True, "moved": len(moved), "product": product_info(pdir)})
            self.send_error(404)
        except KeyError as e:
            self.send_json({"error": f"필요한 값이 빠졌어요({e}). 화면을 새로 고친 뒤 다시 해 주세요"}, 400)
        except ValueError as e:
            self.send_json({"error": str(e)}, 400)
        except Exception as e:
            traceback.print_exc()
            self.send_json({"error": str(e) or "알 수 없는 문제가 생겼어요"}, 500)


JOBS = None


class Server(ThreadingHTTPServer):
    allow_reuse_address = os.name != "nt"  # 윈도우는 이 옵션이 있으면 같은 포트에 두 번 켜져 버린다


def main():
    global JOBS
    ap = argparse.ArgumentParser(description="숏폼 스튜디오")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    url = f"http://127.0.0.1:{args.port}"
    try:  # 작업 목록을 읽기 전에 자리부터 잡는다 (이미 켜져 있으면 돌던 작업을 건드리지 않게)
        srv = Server(("127.0.0.1", args.port), Handler)
    except OSError:
        print("스튜디오가 이미 켜져 있어요. 열려 있는 스튜디오 화면을 띄웁니다.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        return
    JOBS = Jobs()
    print(f"숏폼 스튜디오 실행 중: {url}  (끄려면 Ctrl+C)", flush=True)
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
