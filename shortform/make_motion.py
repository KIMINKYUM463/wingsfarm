"""모션그래픽 숏폼 만들기 (Remotion 엔진).

사용법:
    python make_motion.py <상품폴더> --config 설정.json --out 결과.mp4

설정은 기존 엔진과 같은 모양을 받는다.
- 템플릿형·레퍼런스 복제: make_template.py 설정 ({"videos": [...], "inline_templates": {...}})
- 판매형: make_short.py 설정 ({"hook_text", "features", "price", ...}, "engine": "short")
공통: "id", "mode"(photo|ai), "voice", "bgm_file", "ai_label".

파이썬은 장면 구성·목소리(단어 타이밍)·장면 그림·가격을 준비하고, 움직임은 motion/src/Main.jsx 가 그린다.
"""
import argparse
import asyncio
import glob
import json
import os
import shutil
import subprocess
from pathlib import Path

from make_short import CATEGORY, PHOTO_EXT, build_script, duration, speakable, tts_with_words
from make_template import TEMPLATE_DIR, build_segments, fill, normalize_marks
from sources import get_clip

ROOT = Path(__file__).resolve().parent
MOTION = ROOT / "motion"
FPS = 30
# 대사가 끝나면 바로 다음 장면. 가격 숫자만 조금 더 보여 준다.
LEAD = 0.05
PAD = {"HOOK": 0.12, "TIP": 0.12, "REVEAL": 0.12, "PRICE": 0.35, "CTA": 0.12}
BROWSER = Path(os.environ.get("LOCALAPPDATA", "")) / "remotion-chs" / "chrome-headless-shell.exe"
# 판매형 장면 → 모션 장면
SHORT_KIND = {"HOOK": ("HOOK", None), "ORIGIN": ("TIP", "산지"), "PROOF": ("TIP", None), "CRAVE": ("TIP", None),
              "PRICE": ("PRICE", None), "CTA": ("CTA", None)}


def seal_scene_edges(scenes, run):
    """장면 소리의 시작과 끝을 0으로 만든다. 0이 아닌 샘플에서 자르면 '픽'이 난다."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return
    for i, sc in enumerate(scenes):
        rel_audio = sc.get("audio")
        if not rel_audio:
            continue
        src = MOTION / "public" / rel_audio
        if not src.exists():
            continue
        dst = run / f"s{i}-sealed.wav"
        r = subprocess.run(
            [ffmpeg, "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "48000",
             "-af", "afade=t=in:d=0.012,areverse,afade=t=in:d=0.04,areverse",
             "-c:a", "pcm_s16le", str(dst)],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and dst.exists():
            sc["audio"] = dst.relative_to(MOTION / "public").as_posix()
        sc.pop("sfx", None)


def find_node():
    node = shutil.which("node")
    if node:
        return node
    hits = glob.glob(os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
                                  "OpenJS.NodeJS*", "node-*", "node.exe"))
    if not hits:
        raise SystemExit("모션 엔진에 필요한 Node.js가 없어요. 'winget install OpenJS.NodeJS.LTS'로 설치해 주세요")
    return sorted(hits)[-1]


def ensure_browser():
    """Remotion 이 쓰는 크롬을 짧은 경로로 옮겨 둔다 (윈도우는 260자 넘는 경로의 exe 를 못 띄운다)."""
    if BROWSER.exists():
        return BROWSER
    src = MOTION / "node_modules" / ".remotion" / "chrome-headless-shell" / "win64" / "chrome-headless-shell-win64"
    if not src.exists():
        subprocess.run([find_node(), str(MOTION / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"),
                        "browser", "ensure"], cwd=MOTION, check=True)
    shutil.copytree("\\\\?\\" + str(src), str(BROWSER.parent), dirs_exist_ok=True)
    return BROWSER


# ---------- 장면 구성 ----------

def plan_template(p, cfg):
    """템플릿형·레퍼런스 복제 → (장면 dict 목록, 화면 정보)."""
    video = cfg["videos"][0]
    templates = {t.stem: json.loads(t.read_text(encoding="utf-8")) for t in TEMPLATE_DIR.glob("*.json")}
    templates.update(cfg.get("inline_templates") or {})
    tpl = templates[video["template"]]
    base = {**p, **video}
    segs = build_segments(tpl, video, p)
    title = [fill(x, base) for x in tpl.get("title", [])] + ["", ""]
    screen = {"title1": title[0], "title2": title[1], "info": fill(tpl.get("info", ""), base),
              "highlight": tpl.get("highlight", "yellow"), "bgm_volume": tpl.get("bgm_volume", 0.12),
              "vs": video["template"] == "비교"}
    return segs, screen


def plan_short(p, cfg):
    """판매형 → 장면 목록 (훅 → 산지 → 특징 → 먹는 장면 → 가격 → 주문)."""
    q = {**p, **{k: v for k, v in cfg.items() if v not in (None, "")}}
    if q.get("category") not in CATEGORY:
        q["category"] = "과일"
    segs = []
    for kind, say, _, source in build_script(q, q.get("hook_text") or p["name"]):
        k, label = SHORT_KIND.get(kind, ("TIP", None))
        seg = {"kind": k, "say": say, "source": source}
        if label:
            seg["label"] = label
        segs.append(seg)
    screen = {"title1": p["name"], "title2": q.get("origin") and f"{q['origin']} 산지직송" or "산지직송",
              "info": "주문은 프로필 링크", "highlight": "yellow", "bgm_volume": 0.12, "vs": False}
    return segs, screen


def scene_bg(source, p, photos, pdir, mode, run, i):
    """장면 그림: AI/스마트면 장면 영상을 (없으면 만들어) 쓰고, 사진 모드면 이미 만든 장면만 쓴다."""
    clip = None
    if source and not source.startswith("photo"):
        kind, _, shot = source.partition(":")
        cached = pdir / "_clips" / f"{kind}_{shot}.mp4"
        smart_cached = pdir / "_clips" / f"stock_{shot}.mp4"
        if cached.exists():
            clip = cached
        elif smart_cached.exists():
            clip = smart_cached
        elif mode in ("ai", "smart"):
            clip = get_clip(source, p, photos[0], pdir, smart=(mode == "smart"))
    if clip:
        dst = run / f"bg{i}.mp4"
        shutil.copy(clip, dst)
        return "video", dst, duration(str(dst))
    photo = photos[i % len(photos)]
    dst = run / f"bg{i}{photo.suffix.lower()}"
    shutil.copy(photo, dst)
    return "photo", dst, None


def words_of(say, words):
    """TTS 단어 타이밍 + 원문 어절의 *강조* 표시 → 화면에 쓸 단어 목록."""
    tokens = say.split()
    if len(tokens) == len(words):
        return [{"text": t.replace("*", ""), "start": round(a, 3), "end": round(b, 3), "hl": "*" in t}
                for t, (a, b, _) in zip(tokens, words)]
    return [{"text": w, "start": round(a, 3), "end": round(b, 3)} for a, b, w in words]


def text_words(text):
    """목소리 없는 자막(자막+음악 영상): 어절이 0.12초 간격으로 차례로 나온다."""
    return [{"text": t.replace("*", ""), "start": round(i * 0.12, 2), "end": round(i * 0.12 + 0.3, 2), "hl": "*" in t}
            for i, t in enumerate(normalize_marks(speakable(text)).split())]


def build(pdir, cfg):
    p = json.loads((pdir / "product.json").read_text(encoding="utf-8")) if (pdir / "product.json").exists() else {}
    p.setdefault("name", pdir.name)
    p.setdefault("category", "과일")
    photos = sorted(f for f in pdir.iterdir() if f.suffix.lower() in PHOTO_EXT)
    if not photos:
        raise SystemExit("사진이 없습니다")
    segs, screen = plan_short(p, cfg) if cfg.get("engine") == "short" else plan_template(p, cfg)
    rid = cfg.get("id") or "motion"
    run = MOTION / "public" / "runs" / rid
    shutil.rmtree(run, ignore_errors=True)
    run.mkdir(parents=True)
    rel = lambda x: Path(x).relative_to(MOTION / "public").as_posix()
    voice, rate = cfg.get("voice", "ko-KR-SunHiNeural"), cfg.get("rate", "+12%")

    scenes, log = [], []
    for i, seg in enumerate(segs):
        kind = seg["kind"] if seg["kind"] in PAD else "TIP"
        sc = {"kind": kind, "lead": LEAD}
        for k in ("label", "mark", "unit"):
            if seg.get(k):
                sc[k] = seg[k]
        if seg.get("counter") and str(seg["counter"]).isdigit():
            sc["counter"] = int(seg["counter"])
        say = normalize_marks(speakable(seg.get("say", "")))
        if say:
            au = run / f"s{i}.mp3"
            words = asyncio.run(tts_with_words(say.replace("*", ""), voice, rate, str(au)))
            sec = LEAD + duration(str(au)) + PAD[kind]
            sc.update(audio=rel(au), words=words_of(say, words))
            line = say
        else:  # 자막만 나오는 장면 (레퍼런스가 내레이션 없이 자막+음악일 때)
            sec = float(seg.get("dur") or 3)
            sc["words"] = text_words(seg.get("text", ""))
            sc["textOnly"] = True
            line = seg.get("text", "")
        if kind in ("PRICE", "CTA") and i == len(segs) - 1:
            sec = max(sec, 3.4)
        bg_type, bg, bg_len = scene_bg(seg.get("source", ""), p, photos, pdir, cfg.get("mode", "photo"), run, i)
        # 장면 시작 효과음은 앞 대사가 끝나는 지점에서 '찍'으로 들린다. 모션(글자·전환)만 쓴다.
        sc.update(frames=round(sec * FPS), bg=rel(bg), bgType=bg_type, bgFrames=round(bg_len * FPS) if bg_len else None)
        sc.pop("sfx", None)
        scenes.append(sc)
        log.append(f"[{kind}] {line}")
        print(f"  [{kind:6}] {sec:4.1f}s  {bg.name:10}  {line}", flush=True)
    seal_scene_edges(scenes, run)

    price = None
    q = {**p, **cfg}
    if str(q.get("price") or "").isdigit():
        price = {"now": int(q["price"]), "unit": q.get("unit") or ""}
        if str(q.get("original_price") or "").isdigit() and int(q["original_price"]) > int(q["price"]):
            price["before"] = int(q["original_price"])
    # 작업마다 다른 카메라·효과음이 나오도록 시드 (job id 등)
    seed_raw = str(cfg.get("id") or cfg.get("render_seed") or pdir.name)
    seed = abs(hash(seed_raw)) % 10_000_000
    motion_style = str(cfg.get("motion_style") or "clean")
    if motion_style not in ("clean", "focus", "strip", "corners", "bold", "soft"):
        motion_style = "clean"
    props = {**{k: screen[k] for k in ("title1", "title2", "info", "highlight", "vs")},
             "aiLabel": bool(cfg.get("ai_label")) and cfg.get("mode") == "ai",
             "price": price, "scenes": scenes, "bgmVolume": screen["bgm_volume"],
             "seed": seed, "motionStyle": motion_style}
    print(f"  모션 템플릿: {motion_style}", flush=True)
    if cfg.get("bgm_file") and Path(cfg["bgm_file"]).exists():
        shutil.copy(cfg["bgm_file"], run / "bgm.mp3")
        props["bgm"] = rel(run / "bgm.mp3")
    # 다양한 효과음 파일을 Remotion public 아래 runs와 공유 (staticFile('sfx/...'))
    sfx_src = ROOT / "studio" / "data" / "sfx"
    sfx_dst = MOTION / "public" / "sfx"
    if sfx_src.is_dir():
        sfx_dst.mkdir(parents=True, exist_ok=True)
        for f in sfx_src.glob("*.mp3"):
            dst = sfx_dst / f.name
            if not dst.exists() or dst.stat().st_size != f.stat().st_size:
                shutil.copy2(f, dst)
    return props, run, log


def render(props, run, out):
    (run / "props.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    cmd = [find_node(), str(MOTION / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"), "render",
           "src/index.jsx", "Motion", str(out), f"--props={run / 'props.json'}", f"--browser-executable={ensure_browser()}",
           "--codec=h264", "--crf=20", "--log=error"]
    print("  모션 그래픽 렌더링 중…", flush=True)
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 or not Path(out).exists():
        print(r.stdout[-2000:], r.stderr[-2000:], sep="\n")
        raise SystemExit("모션 렌더링에 실패했어요")


def main():
    ap = argparse.ArgumentParser(description="모션그래픽 숏폼 (Remotion)")
    ap.add_argument("product_dir")
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pdir = Path(a.product_dir).resolve()
    cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
    out = Path(a.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    props, run, log = build(pdir, cfg)
    try:
        render(props, run, out)
    finally:
        shutil.rmtree(run, ignore_errors=True)
    out.with_name(out.stem + "_대본.txt").write_text("\n".join(log), encoding="utf-8")
    print(f"완성: {out}", flush=True)


if __name__ == "__main__":
    main()
