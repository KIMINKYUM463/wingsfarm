"""레퍼런스 쇼츠 다운로드 → 장면 전환 캡처 → 장면별 초수 실측.

결과:
  studio/data/frames/<id>/scene_00.jpg …
  studio/data/frames/<id>/scenes.json  [{t0,t1,seconds,file}, …]
  studio/data/cache/<id>.mp4 (임시, 재사용)

ffmpeg scene 필터로 컷을 잡고, 각 구간의 중간 프레임을 키프레임으로 저장한다.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
DATA = STUDIO / "data"
FRAMES = DATA / "frames"
CACHE = DATA / "cache"
ANALYSIS = DATA / "analysis"

SCENE_THRESH = 0.28
MIN_SCENE = 0.7
MAX_SCENES = 8


def _ffmpeg() -> str:
    bundled = STUDIO.parent.parent / "node_modules" / "ffmpeg-static" / (
        "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    )
    if bundled.exists():
        return str(bundled)
    return shutil.which("ffmpeg") or "ffmpeg"


def _run(cmd: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )


def download(vid: str) -> Path:
    """yt-dlp 로 쇼츠를 받아 cache/<id>.mp4 에 둔다."""
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{vid}.mp4"
    if out.exists() and out.stat().st_size > 50_000:
        return out
    try:
        import yt_dlp
    except ImportError as e:
        raise RuntimeError("yt-dlp 가 없어요. pip install yt-dlp 후 다시 시도해 주세요.") from e

    tmp = CACHE / f"{vid}.%(ext)s"
    # 403 우회: android/ios 클라이언트 우선 (web 은 자주 막힘)
    attempts = [
        {
            "outtmpl": str(tmp),
            "format": "mp4/best[height<=720]/best",
            "quiet": True,
            "no_warnings": True,
            "retries": 2,
            "extractor_args": {"youtube": {"player_client": ["android", "ios", "web"]}},
        },
        {
            "outtmpl": str(tmp),
            "format": "best[height<=720]/best",
            "quiet": True,
            "no_warnings": True,
            "retries": 2,
            "extractor_args": {"youtube": {"player_client": ["android_creator", "mweb"]}},
        },
    ]
    last_err: Exception | None = None
    for opts in attempts:
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([f"https://www.youtube.com/shorts/{vid}"])
            last_err = None
            break
        except Exception as e:
            last_err = e
            for junk in CACHE.glob(f"{vid}.*"):
                if junk.suffix.lower() in {".part", ".ytdl"}:
                    junk.unlink(missing_ok=True)
    if last_err:
        raise RuntimeError(f"영상을 내려받지 못했어요: {last_err}") from last_err
    found = next(
        (p for p in CACHE.glob(f"{vid}.*") if p.suffix.lower() in {".mp4", ".webm", ".mkv", ".m4a"}),
        None,
    )
    if not found:
        raise RuntimeError("영상을 내려받지 못했어요 (비공개·지역 제한일 수 있어요)")
    if found.suffix.lower() != ".mp4":
        conv = _run([_ffmpeg(), "-y", "-i", str(found), "-c:v", "libx264", "-an", str(out)], 120)
        found.unlink(missing_ok=True)
        if conv.returncode != 0 or not out.exists():
            raise RuntimeError("영상 변환에 실패했어요")
        return out
    if found != out:
        found.replace(out)
    return out


def probe_duration(video: Path) -> float:
    r = _run([_ffmpeg(), "-hide_banner", "-i", str(video)], 30)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", r.stderr or "")
    if not m:
        return 0.0
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def detect_cuts(video: Path, thresh: float = SCENE_THRESH) -> list[float]:
    """장면 전환 시각(초) 목록. 0초는 항상 포함."""
    filt = f"select='gt(scene\\,{thresh})',showinfo"
    r = _run([_ffmpeg(), "-hide_banner", "-i", str(video), "-vf", filt, "-f", "null", "-"], 180)
    times = [0.0]
    for line in (r.stderr or "").splitlines():
        m = re.search(r"pts_time:(\d+(?:\.\d+)?)", line)
        if m:
            t = float(m.group(1))
            if t - times[-1] >= MIN_SCENE:
                times.append(t)
    return times


def extract_frame(video: Path, at: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = _run(
        [
            _ffmpeg(),
            "-y",
            "-ss",
            f"{max(0.0, at):.3f}",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            "-vf",
            "scale=540:960:force_original_aspect_ratio=increase,crop=540:960",
            str(dest),
        ],
        60,
    )
    if r.returncode != 0 or not dest.exists():
        raise RuntimeError(f"프레임 추출 실패 @ {at:.2f}s")


def build_scenes(video: Path, vid: str) -> list[dict]:
    """컷 시각 → 구간(t0,t1,seconds) + 중간 키프레임 저장."""
    duration = probe_duration(video)
    if duration <= 0:
        raise RuntimeError("영상 길이를 읽지 못했어요")
    cuts = detect_cuts(video)
    # 마지막 컷이 끝 근처면 합치고, 끝이 없으면 붙인다
    ends = cuts[1:] + [duration]
    raw = []
    for i, t0 in enumerate(cuts):
        t1 = ends[i]
        if t1 - t0 < MIN_SCENE * 0.5:
            continue
        raw.append((t0, min(t1, duration)))
    if not raw:
        raw = [(0.0, duration)]
    # 너무 많으면 긴 구간만 남기며 합침
    while len(raw) > MAX_SCENES:
        # 가장 짧은 구간을 이웃에 합침
        lens = [b - a for a, b in raw]
        i = min(range(len(lens)), key=lambda j: lens[j])
        if i == 0:
            raw[1] = (raw[0][0], raw[1][1])
            raw.pop(0)
        else:
            raw[i - 1] = (raw[i - 1][0], raw[i][1])
            raw.pop(i)

    out_dir = FRAMES / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    scenes = []
    for i, (t0, t1) in enumerate(raw):
        mid = (t0 + t1) / 2
        fname = f"scene_{i:02d}.jpg"
        path = out_dir / fname
        extract_frame(video, mid, path)
        scenes.append(
            {
                "index": i,
                "t0": round(t0, 2),
                "t1": round(t1, 2),
                "seconds": round(max(MIN_SCENE, t1 - t0), 2),
                "file": f"{vid}/{fname}",
                "keyframe": f"{vid}/{fname}",
            }
        )
    (out_dir / "scenes.json").write_text(json.dumps(scenes, ensure_ascii=False, indent=1), encoding="utf-8")
    # UI 시트: 장면 키프레임을 가로로 붙임
    try:
        from PIL import Image

        tiles = [Image.open(out_dir / f"scene_{i:02d}.jpg").convert("RGB").resize((360, 640)) for i in range(len(scenes))]
        sheet = Image.new("RGB", (360 * len(tiles), 640))
        for i, t in enumerate(tiles):
            sheet.paste(t, (360 * i, 0))
        sheet.save(FRAMES / f"{vid}.jpg", quality=88)
        labels = [f"{s['t0']:.1f}–{s['t1']:.1f}s" for s in scenes]
        (FRAMES / f"{vid}.json").write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"  ! 시트 생성 실패: {e}", file=sys.stderr)
    return scenes


def build_from_youtube_thumbs(vid: str, length: float = 0, n: int = 5) -> list[dict]:
    """다운로드 실패 시: 유튜브 공개 프레임으로 구간을 균등 분할해 키프레임을 만든다."""
    import io
    import urllib.request

    from PIL import Image

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Cookie": "CONSENT=YES+1; SOCS=CAI",
    }
    names = [("frame0", 0.0), ("maxres1", 0.25), ("maxres2", 0.5), ("maxres3", 0.75), ("oar2", 0.9)]
    tiles = []
    for name, _ in names:
        try:
            req = urllib.request.Request(f"https://i.ytimg.com/vi/{vid}/{name}.jpg", headers=headers)
            raw = urllib.request.urlopen(req, timeout=20).read()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            if img.width > img.height:
                w = int(img.height * 9 / 16)
                img = img.crop(((img.width - w) // 2, 0, (img.width + w) // 2, img.height))
            tiles.append(img.resize((540, 960), Image.LANCZOS))
        except Exception:
            continue
    if len(tiles) < 2:
        raise RuntimeError("장면 사진을 가져오지 못했어요")
    n = max(2, min(n, len(tiles), MAX_SCENES))
    tiles = tiles[:n]
    total = float(length) if length and length > 0 else max(8.0, n * 2.5)
    each = round(total / n, 2)
    out_dir = FRAMES / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    scenes = []
    t = 0.0
    for i, img in enumerate(tiles):
        fname = f"scene_{i:02d}.jpg"
        img.save(out_dir / fname, quality=88)
        t1 = round(t + each, 2)
        scenes.append(
            {
                "index": i,
                "t0": round(t, 2),
                "t1": t1,
                "seconds": each,
                "file": f"{vid}/{fname}",
                "keyframe": f"{vid}/{fname}",
                "estimated": True,
            }
        )
        t = t1
    (out_dir / "scenes.json").write_text(json.dumps(scenes, ensure_ascii=False, indent=1), encoding="utf-8")
    sheet = Image.new("RGB", (360 * len(tiles), 640))
    for i, img in enumerate(tiles):
        sheet.paste(img.resize((360, 640)), (360 * i, 0))
    sheet.save(FRAMES / f"{vid}.jpg", quality=88)
    labels = [f"~{s['seconds']}s" for s in scenes]
    (FRAMES / f"{vid}.json").write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    return scenes


def capture(vid: str, force: bool = False, length: float = 0, n_hint: int = 5) -> list[dict]:
    """장면 캡처 결과 반환 (캐시 우선). 다운로드 실패 시 썸네일 균등 분할로 폴백."""
    out_dir = FRAMES / vid
    side = out_dir / "scenes.json"
    if not force and side.exists():
        return json.loads(side.read_text(encoding="utf-8"))
    try:
        video = download(vid)
        return build_scenes(video, vid)
    except Exception as e:
        print(f"  ! 영상 다운로드 실패 → 썸네일 폴백: {e}", file=sys.stderr)
        return build_from_youtube_thumbs(vid, length=length, n=n_hint)


def apply_to_analysis(analysis: dict, scenes: list[dict]) -> dict:
    """분석 JSON 의 scenes[] 에 실측 초·키프레임을 심는다.
    장면 수가 다르면 실측 구간에 Claude 역할/목적을 비율로 매핑한다."""
    old = list(analysis.get("scenes") or [])
    mapped = []
    n = len(scenes)
    for i, sc in enumerate(scenes):
        src = old[min(i, len(old) - 1)] if old else {}
        if old and len(old) == n:
            src = old[i]
        elif old and n > 1:
            src = old[min(len(old) - 1, round(i / (n - 1) * (len(old) - 1)))]
        mapped.append(
            {
                **({} if not isinstance(src, dict) else src),
                "seconds": sc["seconds"],
                "t0": sc["t0"],
                "t1": sc["t1"],
                "keyframe": sc["keyframe"],
                "file": sc["file"],
                "measured": not sc.get("estimated"),
                "estimated": bool(sc.get("estimated")),
            }
        )
    analysis["scenes"] = mapped
    analysis["capture"] = {
        "mode": "thumbs_estimate" if any(s.get("estimated") for s in scenes) else "scene_detect",
        "count": n,
        "total": round(sum(s["seconds"] for s in scenes), 2),
    }
    analysis["frames"] = [f"{s['t0']:.1f}–{s['t1']:.1f}s" for s in scenes]
    # 디스크 저장
    vid = (analysis.get("meta") or {}).get("id")
    if vid:
        ANALYSIS.mkdir(parents=True, exist_ok=True)
        path = ANALYSIS / f"{vid}.json"
        # frames 라벨은 load() 가 다시 붙이므로 본문에는 안 넣어도 됨
        body = {k: v for k, v in analysis.items() if k != "frames"}
        path.write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
    return analysis


if __name__ == "__main__":
    force = "--force" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--force"]
    if not args:
        print("usage: scene_capture.py <youtube_id> [--force]", file=sys.stderr)
        sys.exit(2)
    vid = args[0]
    sc = capture(vid, force=force)
    print(json.dumps(sc, ensure_ascii=False, indent=1))
