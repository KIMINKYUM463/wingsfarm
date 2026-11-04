"""템플릿 기반 숏폼 생성기 (리서치로 정리한 포맷: templates/*.json)

사용법:
    python make_template.py <상품폴더> [--only 영상id] [--list]

product.json의 "videos" 목록에 영상마다 {"id", "template", ...내용} 을 적는다.
템플릿이 장면 순서·레이아웃·라벨 모양을 정하고, 영상 쪽은 문장과 장면 소스만 채운다.
자세한 필드는 templates/README.md 참고.
"""
import argparse
import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from make_short import (FFMPEG, FPS, H, LEAD, PAD, PHOTO_EXT, RED, W, XFADE, YELLOW, duration, ease_out,
                        join_with_transitions, load_font, shadowed_text, tts_with_words, caption_chunks, speakable)
from sources import get_clip

ROOT = Path(__file__).parent
TEMPLATE_DIR = ROOT / "templates"
GREEN = (60, 200, 90)

# 레이아웃: 영상이 놓이는 영역 (가로, 세로, 위쪽 여백)과 자막 높이
# full = 화면 꽉 채움, letterbox = 위 검은 제목 영역 + 가운데 4:5 영상 + 아래 정보 바 (국내 정보형 쇼츠 표준)
LAYOUTS = {
    "full": dict(vw=W, vh=H, top=0, cap_y=1150),
    "letterbox": dict(vw=W, vh=1350, top=330, cap_y=1420),
}


# ---------- 템플릿 채우기 ----------

FIELD = re.compile(r"\{(\w+)(?:\|([^{}]*))?\}")


def fill(s, ctx):
    """'{key|기본값}' 형식 치환. 기본값 안에 다른 필드를 넣을 수 있어 안쪽부터 반복해서 바꾼다."""
    if not isinstance(s, str):
        return s
    while True:
        new = FIELD.sub(lambda m: str(ctx.get(m.group(1)) if ctx.get(m.group(1)) not in (None, "")
                                      else (m.group(2) or "")), s)
        if new == s:
            return new
        s = new


def build_segments(tpl, video, p):
    base = {**p, **video}
    segs = []
    for spec in tpl["segments"]:
        if "each" in spec:
            for n, item in enumerate(video.get(spec["each"], []), 1):
                item = {"text": item[0], "source": item[1]} if isinstance(item, list) else item
                ctx = {**base, **item, "n": n}
                segs.append({k: fill(v, ctx) for k, v in spec.items() if k != "each"})
        else:
            seg = {k: fill(v, base) for k, v in spec.items()}
            if spec.get("optional") and not seg.get("say") and not seg.get("text"):
                continue
            segs.append(seg)
    return segs


# ---------- 그림 레이어 ----------

def text_width(d, text, font):
    return d.textlength(text, font=font)


def fit_font(d, text, size, max_w, min_size=40):
    font = load_font(size)
    while text_width(d, text, font) > max_w and size > min_size:
        size -= 4
        font = load_font(size)
    return font


def make_frame_overlay(tpl, video, p, out):
    """영상 내내 고정되는 레이어: 레터박스 제목 2줄 + 아래 정보 바, 또는 꽉 찬 화면의 노란 제목 바."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base = {**p, **video}
    title = [fill(t, base) for t in tpl.get("title", [])]
    info = fill(tpl.get("info", ""), base)
    if tpl.get("layout") == "letterbox":
        colors = [(255, 255, 255), YELLOW]
        for i, line in enumerate(t for t in title if t):
            font = fit_font(d, line, 88, W - 80)
            shadowed_text(im, ((W - text_width(d, line, font)) / 2, 55 + i * 120), line, font, colors[i % 2], stroke=2)
        if info:
            font = fit_font(d, info, 50, W - 160)
            tw = text_width(d, info, font)
            d.rounded_rectangle(((W - tw) / 2 - 40, 1730, (W + tw) / 2 + 40, 1830), radius=50, fill=YELLOW + (255,))
            d.text(((W - tw) / 2, 1752), info, font=font, fill=(20, 20, 20))
    elif title and title[0]:
        line = " ".join(t for t in title if t)
        font = fit_font(d, line, 64, W - 160)
        tw = text_width(d, line, font)
        x0 = (W - tw) / 2 - 40
        d.rounded_rectangle((x0, 230, x0 + tw + 80, 342), radius=24, fill=YELLOW + (255,))
        d.text((x0 + 40, 248), line, font=font, fill=(25, 25, 25))
    if p.get("ai_label"):  # AI 생성 콘텐츠 표시 (플랫폼 정책·AI기본법 대비)
        draw_ai_label(d)
    im.save(out)


def draw_ai_label(d):
    font = load_font(28, bold=False)
    text = "AI 생성 장면 포함"
    tw = text_width(d, text, font)
    d.rounded_rectangle((W - tw - 56, 14, W - 20, 58), radius=22, fill=(0, 0, 0, 140))
    d.text((W - tw - 38, 19), text, font=font, fill=(255, 255, 255, 230))


def normalize_marks(say):
    """'*열두 개*가' 처럼 여러 어절에 걸친 강조를 어절마다 닫아 준다 → '*열두* *개*가'.
    자막은 1~2어절씩 끊기므로 어절 안에서 강조가 닫혀 있어야 한다."""
    on, tokens = False, []
    for tok in say.split():
        out, run = "", ""
        for ch in tok:
            if ch == "*":
                if on and run:
                    out += f"*{run}*"
                elif run:
                    out += run
                run, on = "", not on
            else:
                run += ch
        out += f"*{run}*" if on and run else run
        tokens.append(out)
    return " ".join(tokens)


HIGHLIGHT = {"yellow": YELLOW, "green": (90, 230, 90), "red": (255, 80, 70), "white": (255, 255, 255)}


def make_caption_hl(text, size, y, out, color=YELLOW):
    """키워드 강조 자막: *단어* 는 강조색(기본 노랑), 나머지는 흰색 (상위 쇼츠의 핵심어 강조 방식)."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    plain = text.replace("*", "")
    font = fit_font(d, plain, size, W - 120)
    parts = re.split(r"(\*[^*]+\*)", text)
    x = (W - text_width(d, plain, font)) / 2
    ends_q = plain.rstrip()[-1:] in "?!"
    for part in parts:
        if not part:
            continue
        hl = part.startswith("*")
        s = part.strip("*")
        shadowed_text(im, (x, y), s, font, color if hl or ends_q else (255, 255, 255))
        x += text_width(d, s, font)
    im.save(out)


def make_label(seg, lay, out):
    """장면 라벨: 번호(TIP 1 / STEP 2), O·X 판정, VS 쪽 이름."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = lay["cap_y"] - 170
    mark = seg.get("mark")
    if mark in ("O", "X"):
        color = GREEN if mark == "O" else RED
        cx, cy, r = W // 2, y - 20, 125
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color + (235,), outline=(255, 255, 255), width=8)
        font = load_font(170)
        d.text((cx - text_width(d, mark, font) / 2, cy - 118), mark, font=font, fill=(255, 255, 255))
    if seg.get("label"):
        font = load_font(80)
        text = seg["label"]
        x = (W - text_width(d, text, font)) / 2
        if mark in ("O", "X"):
            y -= 140
        shadowed_text(im, (x, y), text, font, YELLOW, stroke=4)
    im.save(out)


def make_counter_frames(seg, lay, work, idx):
    """숫자 리빌: 0에서 목표 숫자까지 1초 동안 올라가고 단위가 붙는다 (물량·개수 공개)."""
    target, unit = int(seg["counter"]), seg.get("unit", "")
    cy = lay["top"] + lay["vh"] // 2 - 160
    pattern = str(work / f"{idx:02d}_count_%03d.png")
    for f in range(30):
        k = ease_out(f / 29 / 0.8)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        text = f"{round(target * k):,}{unit}"
        font = load_font(190)
        tw = text_width(d, text, font)
        d.rounded_rectangle(((W - tw) / 2 - 50, cy - 20, (W + tw) / 2 + 50, cy + 250), radius=40, fill=(0, 0, 0, 150))
        d.text(((W - tw) / 2, cy), text, font=font, fill=YELLOW, stroke_width=6, stroke_fill=(0, 0, 0))
        im.save(pattern % f)
    return pattern


def make_photo_bg(photo, lay, out):
    """사진을 영상 영역 비율로 2배 크기로 잘라 둔다 (줌 떨림 방지)."""
    img = Image.open(photo).convert("RGB")
    cw, ch = lay["vw"] * 2, lay["vh"] * 2
    s = max(cw / img.width, ch / img.height)
    big = img.resize((int(img.width * s) + 1, int(img.height * s) + 1), Image.LANCZOS)
    left, top = (big.width - cw) // 2, (big.height - ch) // 2
    big.crop((left, top, left + cw, top + ch)).save(out, quality=92)


# ---------- 장면 렌더 ----------

def render_segment(lay, frame_png, layers, audio, dur, out, clip=None, bg=None, zoom=0.1):
    vw, vh, top = lay["vw"], lay["vh"], lay["top"]
    if clip:
        args = [FFMPEG, "-y", "-v", "error", "-ss", "0.3", "-i", str(clip)]
        vf = (f"[0:v]scale={vw}:{vh}:force_original_aspect_ratio=increase,crop={vw}:{vh},fps={FPS},setsar=1,"
              f"setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=30")
    else:
        n = int(dur * FPS) + 1
        args = [FFMPEG, "-y", "-v", "error", "-loop", "1", "-i", bg]
        vf = (f"[0:v]zoompan=z='1+{zoom}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:"
              f"s={vw}x{vh}:fps={FPS}")
    if top or vh != H:
        vf += f",pad={W}:{H}:0:{top}:black"
    graph = [vf + ",format=yuv420p[v0]", "[v0][2:v]overlay=0:0[v1]"]
    args += ["-i", audio, "-loop", "1", "-i", frame_png]
    last = "v1"
    for i, (src, a, b) in enumerate(layers):
        idx = 3 + i
        if "%" in src:
            args += ["-framerate", str(FPS), "-i", src]
            graph.append(f"[{idx}:v]setpts=PTS+{a:.3f}/TB[p{i}];[{last}][p{i}]overlay=0:0:eof_action=repeat[c{i}]")
        else:
            args += ["-loop", "1", "-i", src]
            graph.append(f"[{last}][{idx}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[c{i}]")
        last = f"c{i}"
    args += ["-filter_complex", ";".join(graph), "-map", f"[{last}]", "-map", "1:a",
             "-af", f"adelay={int(LEAD * 1000)}:all=1,apad", "-t", f"{dur:.3f}", "-r", str(FPS),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-ar", "44100", "-ac", "2", out]
    subprocess.run(args, check=True)


def silence(dur, out):
    subprocess.run([FFMPEG, "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", f"{dur:.2f}", "-q:a", "9", out], check=True)


def make_video(tpl, video, p, photos, pdir, out_path, bgm, work):
    lay = LAYOUTS[tpl.get("layout", "full")]
    voice, rate = p.get("voice", "ko-KR-SunHiNeural"), p.get("rate", "+12%")
    hl_color = HIGHLIGHT.get(tpl.get("highlight", "yellow"), YELLOW)
    frame_png = str(work / "frame.png")
    make_frame_overlay(tpl, video, p, frame_png)
    segs = build_segments(tpl, video, p)
    clips, kinds, durs = [], [], []
    log = []
    for i, seg in enumerate(segs):
        source = seg.get("source", "")
        clip = get_clip(source, p, photos[0], pdir) if source and not p.get("photos_only") else None
        bg = None
        if not clip:
            bg = str(work / f"{i:02d}_bg.jpg")
            make_photo_bg(photos[i % len(photos)], lay, bg)
        au = str(work / f"{i:02d}_tts.mp3")
        say = normalize_marks(speakable(seg.get("say", "")))
        layers = []
        if say:
            words = asyncio.run(tts_with_words(say.replace("*", ""), voice, rate, au))
            audio_len = duration(au)
            dur = LEAD + audio_len + PAD
            # 강조 표시(*)는 원문 어절에 붙어 있어 TTS 단어 수와 어절 수가 같다
            for j, (a, b, text) in enumerate(caption_chunks(say, words, audio_len)):
                png = str(work / f"{i:02d}_cap{j:02d}.png")
                make_caption_hl(text, 90 if seg["kind"] == "HOOK" else 80, lay["cap_y"], png, hl_color)
                layers.append((png, LEAD + a, dur if b >= audio_len else LEAD + b))
        else:
            dur = float(seg.get("dur") or 3)
            silence(dur, au)
            if seg.get("text"):
                png = str(work / f"{i:02d}_cap.png")
                make_caption_hl(normalize_marks(seg["text"]), 80, lay["cap_y"], png, hl_color)
                layers.append((png, 0, dur))
        if seg.get("label") or seg.get("mark"):
            png = str(work / f"{i:02d}_label.png")
            make_label(seg, lay, png)
            layers.insert(0, (png, 0, dur))
        if seg.get("counter"):
            layers.append((make_counter_frames(seg, lay, work, i), XFADE + 0.2, None))
        out = str(work / f"{i:02d}.mp4")
        render_segment(lay, frame_png, layers, au, dur, out, clip, bg, 0.18 if seg["kind"] == "HOOK" else 0.1)
        clips.append(out)
        kinds.append(seg["kind"])
        durs.append(dur)
        used = Path(clip).name if clip else f"사진 {photos[i % len(photos)].name}"
        line = f"  [{seg['kind']:6}] {dur:4.1f}s  {used:18}  {say or seg.get('text', '')}"
        print(line)
        log.append(f"[{seg['kind']}] {say or seg.get('text', '')}")
    join_with_transitions(clips, kinds, durs, bgm, str(out_path), tpl.get("bgm_volume", 0.12))
    return log


# ---------- 카드(사진 슬라이드) ----------

def make_cards(tpl, video, p, photos, pdir, out_dir):
    """인스타 캐러셀·틱톡 사진 모드용 4:5 카드 PNG 묶음. AI 장면 사진이 있으면 배경으로 쓴다."""
    base = {**p, **video}
    cache = pdir / "_clips"
    folder = out_dir / f"{p['name']}_{video['id']}"
    folder.mkdir(parents=True, exist_ok=True)
    CW, CH = 1080, 1350

    def bg_for(source, i):
        name = source.split(":")[-1] if source else ""
        cand = cache / f"ai_{name}.jpg"
        img = Image.open(cand if cand.exists() else photos[i % len(photos)]).convert("RGB")
        s = max(CW / img.width, CH / img.height)
        img = img.resize((int(img.width * s) + 1, int(img.height * s) + 1), Image.LANCZOS)
        img = img.crop(((img.width - CW) // 2, (img.height - CH) // 2, (img.width + CW) // 2, (img.height + CH) // 2))
        shade = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        ImageDraw.Draw(shade).rectangle((0, CH * 0.55, CW, CH), fill=(0, 0, 0, 150))
        return Image.alpha_composite(img.convert("RGBA"), shade.filter(ImageFilter.GaussianBlur(40)))

    def write_lines(im, lines, y, size, colors):
        d = ImageDraw.Draw(im)
        for k, line in enumerate(lines):
            font = fit_font(d, line.replace("*", ""), size, CW - 120)
            shadowed_text(im, ((CW - text_width(d, line.replace("*", ""), font)) / 2, y + k * (size + 30)),
                          line.replace("*", ""), font, colors[k % len(colors)])

    title = [fill(t, base) for t in tpl.get("title", []) if fill(t, base)]
    cover = bg_for(video.get("hook_source", "ai:hook"), 0)
    write_lines(cover, title, 820, 96, [(255, 255, 255), YELLOW])
    cover.convert("RGB").save(folder / "01.jpg", quality=92)
    for n, item in enumerate(video.get("items", []), 1):
        item = {"text": item[0], "source": item[1]} if isinstance(item, list) else item
        card = bg_for(item.get("source"), n)
        d = ImageDraw.Draw(card)
        badge = f"{n}"
        d.ellipse((CW / 2 - 70, 740, CW / 2 + 70, 880), fill=YELLOW + (255,))
        f = load_font(96)
        d.text((CW / 2 - text_width(d, badge, f) / 2, 748), badge, font=f, fill=(20, 20, 20))
        # 긴 문장은 쉼표 기준으로 두 줄로 나눈다
        text = item["text"].replace("*", "")
        lines = [s.strip() for s in text.split(",", 1)] if "," in text else [text]
        write_lines(card, lines, 930, 66, [(255, 255, 255)])
        card.convert("RGB").save(folder / f"{n + 1:02d}.jpg", quality=92)
    last = bg_for(video.get("outro_source", "ai:hero"), 99)
    write_lines(last, [fill(video.get("outro_card", "저장해 두고 장 볼 때 꺼내 보세요"), base),
                       fill(tpl.get("info", ""), base)], 900, 64, [(255, 255, 255), YELLOW])
    last.convert("RGB").save(folder / f"{len(video.get('items', [])) + 2:02d}.jpg", quality=92)
    return folder


def main():
    ap = argparse.ArgumentParser(description="템플릿으로 숏폼 만들기")
    ap.add_argument("product_dir", nargs="?")
    ap.add_argument("--only", help="이 id의 영상만 만든다")
    ap.add_argument("--list", action="store_true", help="템플릿 목록 보기")
    ap.add_argument("--bgm")
    ap.add_argument("--out", default=str(ROOT / "output"))
    ap.add_argument("--config", help="product.json 위에 덮어쓸 JSON (스튜디오가 영상 한 편씩 넘길 때 사용)")
    ap.add_argument("--photos-only", action="store_true", help="AI·스톡 없이 사진만으로 만든다 (무료)")
    args = ap.parse_args()

    templates = {t.stem: json.loads(t.read_text(encoding="utf-8")) for t in sorted(TEMPLATE_DIR.glob("*.json"))}
    if args.list or not args.product_dir:
        for k, t in templates.items():
            print(f"{k:10} {t.get('kind', '자동'):6} {t['name']} — {t.get('when', '')}")
        return
    pdir = Path(args.product_dir)
    p = json.loads((pdir / "product.json").read_text(encoding="utf-8"))
    if args.config:
        p.update(json.loads(Path(args.config).read_text(encoding="utf-8")))
    if args.photos_only:
        p["photos_only"] = True
    p.setdefault("name", pdir.name)
    templates.update(p.get("inline_templates") or {})  # 레퍼런스 복제처럼 실행할 때 만든 템플릿
    photos = sorted(f for f in pdir.iterdir() if f.suffix.lower() in PHOTO_EXT)
    bgm = args.bgm or p.get("bgm_file") or (str(pdir / "bgm.mp3") if (pdir / "bgm.mp3").exists() else None)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for video in p.get("videos", []):
        if args.only and video["id"] != args.only:
            continue
        tpl = templates.get(video["template"])
        if not tpl:
            sys.exit(f"템플릿 '{video['template']}'이 없습니다. --list 로 확인하세요.")
        if tpl.get("engine") == "short":
            print(f"▷ {video['id']}: 판매형은 make_short.py 로 만듭니다.")
            continue
        if tpl.get("kind") == "촬영":
            print(f"▷ {video['id']}: '{tpl['name']}'은 직접 촬영하는 템플릿입니다. templates/README.md의 촬영 목록을 보세요.")
            continue
        if tpl.get("output") == "cards":
            folder = make_cards(tpl, video, p, photos, pdir, out_dir)
            print(f"▶ {video['id']} → {folder} (카드 {len(list(folder.glob('*.jpg')))}장)")
            continue
        out_path = out_dir / f"{p['name']}_{video['id']}.mp4"
        print(f"▶ {out_path.name}  [{tpl['name']}]")
        with tempfile.TemporaryDirectory() as tmp:
            log = make_video(tpl, video, p, photos, pdir, out_path, bgm, Path(tmp))
        (out_dir / f"{p['name']}_{video['id']}_대본.txt").write_text("\n".join(log), encoding="utf-8")
        print(f"  → {out_path} ({duration(str(out_path)):.1f}초)")
    credits = pdir / "_clips" / "credits.txt"
    if credits.exists():
        shutil.copy(credits, out_dir / f"{p['name']}_영상출처.txt")


if __name__ == "__main__":
    main()
