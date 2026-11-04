"""농수산물 숏폼 자동 생성기 (v2: 레퍼런스형 디자인)

사용법:
    python make_short.py <상품폴더> [--variants 3] [--bgm 음악.mp3]

상품폴더 안에 사진(jpg/png)과 선택적으로 product.json을 넣는다.
사진은 파일명 순서대로 쓰인다: 첫 장 = 후킹(가장 맛있어 보이는 컷), 마지막 장 = 포장/가격 컷.
구조는 knowledge/농수산물_숏폼_패턴DB.md 6장(HOOK→ORIGIN→PROOF→CRAVE→PRICE→CTA)을 따르고,
디자인은 분석한 레퍼런스(사진 꽉 채움 + 말에 맞춰 바뀌는 작은 흰 자막)를 따른다.
"""
import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from sources import get_clip

W, H, FPS = 1080, 1920, 30
FONT_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"
FONT_REG = r"C:\Windows\Fonts\malgun.ttf"
YELLOW = (255, 225, 77)
RED = (235, 50, 50)
PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}

CAPTION_Y = 1150      # 자막 세로 위치 (릴스/틱톡 하단 UI를 피한 화면 중앙 아래)
LEAD = 0.10           # 장면 시작 후 말이 나오기까지 여유
PAD = 0.45            # 말이 끝난 뒤 여유 (전환 시간보다 길어야 말이 잘리지 않음)
XFADE = 0.30          # 장면 전환 길이
PRICE_FRAMES = 30     # 가격 카드 애니메이션 프레임 수 (1초)


def find_tool(name):
    p = shutil.which(name)
    if p:
        return p
    p = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / f"{name}.exe"
    if p.exists():
        return str(p)
    sys.exit(f"{name}을(를) 찾을 수 없습니다. winget install Gyan.FFmpeg 로 설치하세요.")


FFMPEG, FFPROBE = find_tool("ffmpeg"), find_tool("ffprobe")


# ---------- 카피 ----------

def has_batchim(word):
    c = word.strip()[-1]
    if "가" <= c <= "힣":
        return (ord(c) - 0xAC00) % 28 != 0
    return c in "0123456789LMNR"


def ieyo(word):
    return f"{word}이에요" if has_batchim(word) else f"{word}예요"


CATEGORY = {
    "과일": dict(noun="과일", harvest="수확해서", crave="한 입 베어 물면 과즙이 팡 터져요!"),
    "채소": dict(noun="채소", harvest="수확해서", crave="씻어서 바로 먹어도 아삭아삭해요!"),
    "수산": dict(noun="생선", harvest="잡아서", crave="살이 꽉 차서 씹을수록 고소해요!"),
    "축산": dict(noun="고기", harvest="손질해서", crave="구우면 육즙이 그대로 살아있어요!"),
    "가공": dict(noun="간식", harvest="만들어서", crave="한 번 먹으면 자꾸 손이 가요!"),
}


def won(n):
    return f"{n:,}원"


def hook_variants(p):
    name, origin, cat = p["name"], p.get("origin") or "산지", CATEGORY[p["category"]]
    hooks = {
        "질문인용": "고객님이 물어보셨어요. 진짜 산지에서 바로 와요?",
        "공감": f"마트에서 산 {cat['noun']}, 맛없어서 실망하신 적 있으시죠?",
        "한정": f"일 년에 딱 이맘때만 나오는 {ieyo(name)}.",
        "생산자": f"{origin}에서 직접 고른 {name}, 한번 보실래요?",
    }
    if p.get("price"):
        hooks["가격"] = f"{name}, 이 가격 실화인가요?"
    if p.get("hook_text"):  # 스튜디오에서 직접 쓴 훅 한 개만 만든다
        return [(p.get("hook_id", "맞춤"), p["hook_text"])]
    order = p.get("hooks") or ["질문인용", "공감", "한정", "생산자", "가격"]
    return [(k, hooks[k]) for k in order if k in hooks]


# 스톡 상품 컷은 다른 품종·외국 가격표가 섞여 나오기 쉬워서 상품이 보이는 장면은 AI로 만든다.
# 스톡은 산지(밭·바다) 같은 일반 장면에만 쓴다.
PROOF_SOURCES = ["ai:detail", "ai:hero", "stock:product"]


def build_script(p, hook):
    """세그먼트 목록: (종류, 나레이션, 사진 순번, 영상 소스).
    사진 순번 -1 = 마지막 사진. 영상 소스(ai:/stock:)를 못 구하면 사진으로 대신한다."""
    cat = CATEGORY[p["category"]]
    origin = p.get("origin") or "산지"
    feats = p.get("features", [])[:3]
    segs = [("HOOK", hook, 0, "ai:hook"),
            ("ORIGIN", f"{origin}에서 {cat['harvest']} 바로 보내드려요.", 1, "stock:origin")]
    segs += [("PROOF", f, 2 + i, PROOF_SOURCES[i]) for i, f in enumerate(feats)]
    segs.append(("CRAVE", cat["crave"], 2 + len(feats), "ai:crave"))
    if p.get("price"):
        if p.get("original_price"):
            nar = f"원래 {won(p['original_price'])}이던 걸, 지금은 {won(p['price'])}에 드려요."
        else:
            nar = f"지금 {won(p['price'])}에 드려요."
        segs.append(("PRICE", nar, -1, "ai:hero"))
    segs.append(("CTA", p.get("cta") or "수량이 한정돼 있어요. 프로필 링크에서 지금 주문하세요.", 0, "ai:hero"))
    return segs


def build_tip_script(tip):
    """정보형(고르는 법·보관법 등): 제목 훅 → 팁 1~3 → 저장 유도 + 짧은 판매 한 줄.
    tip = {"id", "title", "hook", "items": [[나레이션, 소스], ...], "outro"}"""
    segs = [("HOOK", tip["hook"], 0, tip.get("hook_source", "ai:hook"), None)]
    segs += [("TIP", text, 1 + i, src, f"TIP {i + 1}") for i, (text, src) in enumerate(tip["items"])]
    segs.append(("CTA", tip.get("outro") or "저장해 두고 장 보실 때 꺼내 보세요.", 0,
                 tip.get("outro_source", "ai:hero"), None))
    return segs


# 다음 장면으로 넘어갈 때 쓰는 전환 (ffmpeg xfade 이름)
TRANSITION = {"ORIGIN": "zoomin", "PROOF": "slideleft", "CRAVE": "smoothup", "PRICE": "fadewhite", "CTA": "fade",
              "TIP": "slideleft"}


# ---------- 이미지 ----------

def load_font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


# 같은 사진을 여러 장면에 다시 쓸 때 장면마다 다른 부분을 보여주기 위한 구도
# (가로 초점, 세로 초점, 추가 확대). None = 사진 전체를 흐린 배경 위에 얹기
SHOTS = [(0.5, 0.5, 1.0), (0.5, 0.45, 1.5), None, (0.25, 0.8, 1.3), (0.75, 0.25, 1.3), (0.7, 0.8, 1.4)]


def make_background(photo, out, shot=0):
    """사진을 9:16에 꽉 채워 자른다. 줌 떨림을 줄이려고 2배 해상도로 만든다."""
    img = Image.open(photo).convert("RGB")
    CW, CH = W * 2, H * 2
    frame = SHOTS[shot % len(SHOTS)]
    fx, fy, zoom = frame or (0.5, 0.5, 1.0)
    scale = max(CW / img.width, CH / img.height) * zoom
    big = img.resize((int(img.width * scale) + 1, int(img.height * scale) + 1), Image.LANCZOS)
    left = min(max(int(fx * big.width - CW / 2), 0), big.width - CW)
    top = min(max(int(fy * big.height - CH / 2), 0), big.height - CH)
    canvas = big.crop((left, top, left + CW, top + CH))
    if frame is None:
        canvas = canvas.filter(ImageFilter.GaussianBlur(60)).point(lambda v: int(v * 0.6))
        fit = img.resize((CW, int(img.height * CW / img.width)), Image.LANCZOS)
        canvas.paste(fit, (0, (CH - fit.height) // 2 - CH // 10))
    canvas.save(out, quality=92)


def shadowed_text(im, xy, text, font, fill, stroke=3):
    """레퍼런스 자막 스타일: 흰 글씨 + 얇은 외곽선 + 부드러운 그림자."""
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((xy[0] + 3, xy[1] + 5), text, font=font, fill=(0, 0, 0, 200),
                                stroke_width=stroke + 2, stroke_fill=(0, 0, 0, 200))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(6)))
    ImageDraw.Draw(im).text(xy, text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(20, 20, 20))


def make_caption(text, size, out, color=(255, 255, 255)):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    font = load_font(size)
    while d.textlength(text, font=font) > W - 120 and size > 40:
        size -= 4
        font = load_font(size)
    w = d.textlength(text, font=font)
    shadowed_text(im, ((W - w) / 2, CAPTION_Y), text, font, color)
    im.save(out)


def make_tag(p, out):
    """선택 사항: product.json에 tag가 있을 때만 왼쪽 위에 작게 표시."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if p.get("tag"):
        shadowed_text(im, (60, 130), p["tag"], load_font(36), (255, 255, 255, 230), stroke=2)
    if p.get("header"):
        # 정보형 제목 바: 저장해 두고 다시 볼 때 무슨 영상인지 바로 보이게 영상 내내 띄운다
        d = ImageDraw.Draw(im)
        font = load_font(64)
        tw = d.textlength(p["header"], font=font)
        x0, y0 = (W - tw) / 2 - 40, 230
        d.rounded_rectangle((x0, y0, x0 + tw + 80, y0 + 112), radius=24, fill=YELLOW + (255,))
        d.text((x0 + 40, y0 + 18), p["header"], font=font, fill=(25, 25, 25))
    if p.get("ai_label"):  # AI 생성 콘텐츠 표시
        d = ImageDraw.Draw(im)
        font, text = load_font(28, bold=False), "AI 생성 장면 포함"
        tw = d.textlength(text, font=font)
        d.rounded_rectangle((W - tw - 56, 14, W - 20, 58), radius=22, fill=(0, 0, 0, 140))
        d.text((W - tw - 38, 19), text, font=font, fill=(255, 255, 255, 230))
    im.save(out)


def make_label(text, out):
    """팁 번호 배지 (자막 위)."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    font = load_font(96)
    w = ImageDraw.Draw(im).textlength(text, font=font)
    shadowed_text(im, ((W - w) / 2, CAPTION_Y - 150), text, font, YELLOW, stroke=4)
    im.save(out)


def ease_out(t):
    return 1 - (1 - min(max(t, 0), 1)) ** 3


def make_price_frames(p, work):
    """가격 카드 애니메이션: 정가 취소선이 그어지고 → 할인가가 내려오며 카운트 → 할인 배지가 튀어나온다."""
    price, orig = p["price"], p.get("original_price")
    pct = round(100 * (1 - price / orig)) if orig else 0
    cx, top = W // 2, 700
    pattern = str(work / "price_%03d.png")
    for f in range(PRICE_FRAMES):
        t = f / (PRICE_FRAMES - 1)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((110, top, W - 110, top + 560), radius=48, fill=(0, 0, 0, 165))
        y = top + 70
        if orig:
            fo = load_font(70, bold=False)
            to = won(orig)
            tw = d.textlength(to, font=fo)
            d.text((cx - tw / 2, y), to, font=fo, fill=(210, 210, 210))
            k = ease_out(t / 0.3)
            if k > 0:
                d.line((cx - tw / 2 - 12, y + 50, cx - tw / 2 - 12 + (tw + 24) * k, y + 50), fill=RED, width=9)
        # 할인가: 정가에서 할인가까지 숫자가 내려가며 아래로 떨어지듯 등장
        k = ease_out((t - 0.2) / 0.5)
        if k > 0:
            shown = round((orig or price) - ((orig or price) - price) * k, -2) if orig else price
            if k >= 1:
                shown = price
            fp = load_font(170)
            tp = won(int(shown))
            tw = d.textlength(tp, font=fp)
            yy = y + 130 - 40 * (1 - k)
            alpha = int(255 * min(1, k * 1.5))
            d.text((cx - tw / 2, yy), tp, font=fp, fill=YELLOW + (alpha,), stroke_width=6,
                   stroke_fill=(0, 0, 0, alpha))
        if p.get("unit") and t > 0.6:
            fu = load_font(46, bold=False)
            d.text((cx - d.textlength(p["unit"], font=fu) / 2, y + 370), p["unit"], font=fu,
                   fill=(255, 255, 255))
        # 할인 배지: 0.6초 뒤 살짝 크게 튀어나왔다가 제자리
        if pct and t > 0.55:
            s = (t - 0.55) / 0.45
            scale = 1.25 - 0.25 * ease_out(s) if s < 1 else 1.0
            scale *= ease_out(s / 0.4)
            r = int(115 * scale)
            if r > 5:
                bx, by = W - 190, top - 20
                d.ellipse((bx - r, by - r, bx + r, by + r), fill=RED, outline=(255, 255, 255), width=6)
                fb = load_font(max(10, int(70 * scale)))
                fs = load_font(max(8, int(36 * scale)))
                tb, ts = f"{pct}%", "할인"
                d.text((bx - d.textlength(tb, font=fb) / 2, by - int(62 * scale)), tb, font=fb, fill=(255, 255, 255))
                d.text((bx - d.textlength(ts, font=fs) / 2, by + int(16 * scale)), ts, font=fs, fill=(255, 255, 255))
        im.save(pattern % f)
    return pattern


# ---------- 오디오 (단어 타이밍 포함) ----------

# 단위 뒤에 '에·예요' 같은 조사가 붙어도 바꾸도록 \b 대신 '뒤에 영문자가 없음'으로 본다
UNITS = [(r"(\d)\s*kg(?![A-Za-z])", r"\1킬로그램"), (r"(\d)\s*g(?![A-Za-z])", r"\1그램"),
         (r"(\d)\s*[Bb]rix(?![A-Za-z])", r"\1브릭스"), (r"(\d)\s*%", r"\1퍼센트"), (r"(\d)\s*~\s*(\d)", r"\1에서 \2"),
         (r"(\d)\s*cm(?![A-Za-z])", r"\1센티")]


def speakable(text):
    """TTS가 잘못 읽기 쉬운 단위·기호를 한글로 (자막도 같은 문장을 쓴다). 숫자는 아라비아 숫자로 둔다."""
    for pat, rep in UNITS:
        text = re.sub(pat, rep, text)
    return text


async def tts_with_words(text, voice, rate, out):
    """voice 가 'gemini:이름' 이면 Gemini 목소리, 아니면 edge-tts. Gemini 가 안 되면 edge-tts 로 대신한다."""
    if voice.startswith("gemini:"):
        try:
            import voice_gemini
            return voice_gemini.synthesize(text, voice.split(":", 1)[1], out)
        except Exception as e:
            print(f"    ! Gemini 목소리 실패, 기본 목소리로 대신해요: {e}", flush=True)
            voice = "ko-KR-SunHiNeural"
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(out, "wb") as fp:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                fp.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))
    return words


def caption_chunks(narration, words, audio_end):
    """단어들을 1~2어절(최대 10자) 구절로 묶어 (시작, 끝, 표시글자) 목록을 만든다.
    표시 글자는 문장부호가 살아있는 원문 어절을 쓰고, 개수가 안 맞으면 TTS 단어를 쓴다."""
    tokens = narration.split()
    display = tokens if len(tokens) == len(words) else [w[2] for w in words]
    chunks, cur = [], []
    for i, (start, _, _) in enumerate(words):
        tok = display[i]
        if cur and (len(cur) >= 2 or len(" ".join(t for _, t in cur) + tok) > 10):
            chunks.append(cur)
            cur = []
        cur.append((start, tok))
        if tok[-1] in ".,?!":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    out = []
    for i, ch in enumerate(chunks):
        end = chunks[i + 1][0][0] if i + 1 < len(chunks) else audio_end
        text = " ".join(t for _, t in ch).rstrip(".,")
        out.append((ch[0][0], end, text))
    return out


def duration(path):
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


# ---------- 영상 ----------

MOTIONS = {
    "in": ("1+{a}*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    "out": ("1+{a}-{a}*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"),
    "pan": ("1+{a}", "(iw-iw/zoom)*on/{n}", "ih/2-(ih/zoom/2)"),
}


def render_segment(bg, tag, layers, audio, dur, motion, amount, out, clip=None):
    """layers: [(png 또는 시퀀스 패턴, 시작초, 끝초 또는 None)]
    clip이 있으면 사진 대신 영상 클립을 배경으로 쓴다 (짧으면 마지막 프레임 정지)."""
    if clip:
        args = [FFMPEG, "-y", "-v", "error", "-ss", "0.3", "-i", str(clip)]
        bg_filter = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,"
                     f"setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=30,format=yuv420p[v0]")
    else:
        n = int(dur * FPS) + 1
        z, x, y = (s.format(a=amount, n=n) for s in MOTIONS[motion])
        args = [FFMPEG, "-y", "-v", "error", "-loop", "1", "-i", bg]
        bg_filter = f"[0:v]zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={W}x{H}:fps={FPS},format=yuv420p[v0]"
    args += ["-i", audio, "-loop", "1", "-i", tag]
    graph = [bg_filter, "[v0][2:v]overlay=0:0[v1]"]
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


def join_with_transitions(clips, kinds, durs, bgm, out_path, bgm_volume=0.12):
    args = [FFMPEG, "-y", "-v", "error"]
    for c in clips:
        args += ["-i", c]
    graph, v, a, offset = [], "0:v", "0:a", 0.0
    for i in range(1, len(clips)):
        offset += durs[i - 1] - XFADE
        tr = TRANSITION.get(kinds[i], "fade")
        if kinds[i] == "PROOF" and kinds[i - 1] == "PROOF":
            tr = "slideup"
        graph.append(f"[{v}][{i}:v]xfade=transition={tr}:duration={XFADE}:offset={offset:.3f}[xv{i}]")
        graph.append(f"[{a}][{i}:a]acrossfade=d={XFADE}[xa{i}]")
        v, a = f"xv{i}", f"xa{i}"
    if bgm:
        args += ["-stream_loop", "-1", "-i", bgm]
        total = sum(durs) - XFADE * (len(clips) - 1)
        graph.append(f"[{len(clips)}:a]volume={bgm_volume},afade=t=out:st={max(0, total - 1.2):.2f}:d=1.2[bgm];"
                     f"[{a}][bgm]amix=inputs=2:duration=first:normalize=0[mix]")
        a = "mix"
    args += ["-filter_complex", ";".join(graph), "-map", f"[{v}]", "-map", f"[{a}]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out_path]
    subprocess.run(args, check=True)


def make_video(p, photos, segs, out_path, bgm, work, pdir):
    voice, rate = p.get("voice", "ko-KR-SunHiNeural"), p.get("rate", "+12%")
    motions = ["in", "pan", "out"]
    tag = str(work / "tag.png")
    make_tag(p, tag)
    clips, kinds, durs, used = [], [], [], {}
    for i, (kind, narration, idx, source, *rest) in enumerate(segs):
        label = rest[0] if rest else None
        photo = photos[idx % len(photos)]
        bg, au, clip = (str(work / f"{i:02d}{s}") for s in ("_bg.jpg", "_tts.mp3", ".mp4"))
        src_clip = None if p.get("photos_only") else get_clip(source, p, photos[0], pdir)
        if not src_clip:
            make_background(photo, bg, used.get(photo, 0))
            used[photo] = used.get(photo, 0) + 1
        narration = speakable(narration)
        words = asyncio.run(tts_with_words(narration, voice, rate, au))
        audio_len = duration(au)
        dur = LEAD + audio_len + PAD

        layers = []
        if label:
            png = str(work / f"{i:02d}_label.png")
            make_label(label, png)
            layers.append((png, 0, dur))
        if kind == "PRICE":
            # 전환(흰 플래시)이 끝난 뒤 애니메이션이 시작되도록 늦춘다
            layers.append((make_price_frames(p, work), XFADE, None))
        else:
            for j, (a, b, text) in enumerate(caption_chunks(narration, words, audio_len)):
                png = str(work / f"{i:02d}_cap{j:02d}.png")
                color = YELLOW if text[-1] in "?!" else (255, 255, 255)
                make_caption(text, 76 if kind == "HOOK" else 66, png, color)
                end = dur if b >= audio_len else LEAD + b
                layers.append((png, LEAD + a, end))

        motion, amount = ("in", 0.18) if kind == "HOOK" else (motions[i % 3], 0.1)
        render_segment(bg, tag, layers, au, dur, motion, amount, clip, src_clip)
        clips.append(clip)
        kinds.append(kind)
        durs.append(dur)
        used_src = Path(src_clip).name if src_clip else f"사진 {Path(photo).name}"
        print(f"  [{kind:6}] {dur:4.1f}s  {used_src:18}  {narration}")
    join_with_transitions(clips, kinds, durs, bgm, out_path)


def main():
    ap = argparse.ArgumentParser(description="상품 사진 → 숏폼 영상")
    ap.add_argument("product_dir")
    ap.add_argument("--variants", type=int, default=3, help="후킹만 다른 버전 수 (A/B 테스트용)")
    ap.add_argument("--bgm", help="배경음악 파일 (없으면 폴더 안 bgm.mp3 사용)")
    ap.add_argument("--out", default=str(Path(__file__).parent / "output"))
    ap.add_argument("--format", choices=["ad", "tip"], default="ad",
                    help="ad = 판매형(후킹 A/B), tip = 정보형(product.json의 tips)")
    ap.add_argument("--config", help="product.json 위에 덮어쓸 JSON (스튜디오용)")
    ap.add_argument("--photos-only", action="store_true", help="AI·스톡 없이 사진만으로 만든다 (무료)")
    args = ap.parse_args()

    pdir = Path(args.product_dir)
    cfg = pdir / "product.json"
    p = json.loads(cfg.read_text(encoding="utf-8")) if cfg.exists() else {}
    if args.config:
        p.update(json.loads(Path(args.config).read_text(encoding="utf-8")))
    if args.photos_only:
        p["photos_only"] = True
    p.setdefault("name", pdir.name)
    p.setdefault("category", "과일")
    if p["category"] not in CATEGORY:
        sys.exit(f"category는 {list(CATEGORY)} 중 하나여야 합니다.")
    photos = sorted(f for f in pdir.iterdir() if f.suffix.lower() in PHOTO_EXT)
    if not photos:
        sys.exit("사진이 없습니다.")
    bgm = args.bgm or p.get("bgm_file") or (str(pdir / "bgm.mp3") if (pdir / "bgm.mp3").exists() else None)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.format == "tip":
        jobs = [(t["id"], build_tip_script(t), {**p, "tag": None, "header": t["title"]}) for t in p.get("tips", [])]
        if not jobs:
            sys.exit("product.json에 tips가 없습니다. 사용법.md의 정보형 예시를 참고하세요.")
    else:
        jobs = [(name, build_script(p, hook), p) for name, hook in hook_variants(p)[:args.variants]]
    for job_name, segs, jp in jobs:
        out_path = out_dir / f"{p['name']}_{job_name}.mp4"
        print(f"▶ {out_path.name}")
        (out_dir / f"{p['name']}_{job_name}_대본.txt").write_text(
            "\n".join(f"[{s[0]}] {s[1]}" for s in segs), encoding="utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            make_video(jp, photos, segs, str(out_path), bgm, Path(tmp), pdir)
        print(f"  → {out_path} ({duration(str(out_path)):.1f}초)")
    credits = pdir / "_clips" / "credits.txt"
    if credits.exists():
        shutil.copy(credits, out_dir / f"{p['name']}_영상출처.txt")


if __name__ == "__main__":
    main()
