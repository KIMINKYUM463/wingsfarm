"""분위기별 배경음악: fal.ai 음악 생성(가사 없음)으로 한 번 만들어 studio/data/bgm/<분위기>.mp3 에 두고 계속 쓴다."""
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
sys.path.insert(0, str(STUDIO.parent))
import sources  # noqa: E402
from make_short import FFMPEG  # noqa: E402

BGM = STUDIO / "data" / "bgm"
# claps/틱·찍 소리 나는 타악기는 피한다 — 농식품 숏폼에 맞는 부드러운 루프
MOODS = {
    "밝은": "bright warm acoustic ukulele and soft shaker, sunny farm produce vibe, gentle groove, no claps, no clicks, no vocals, loopable background",
    "경쾌한": "upbeat soft modern pop with warm bass and muted percussion, energetic but smooth short-form background, no sharp ticks, no vocals",
    "잔잔한": "calm warm fingerpicked acoustic guitar with soft piano pads, cozy kitchen, very gentle, no percussion hits, no vocals",
    "시장활기": "lively warm market vibe with soft gayageum and rounded percussion, upbeat and fun but no sharp clacks, no vocals",
}
MODELS = [("cassetteai/music-generator", lambda p: {"prompt": p, "duration": 40}, lambda r: r["audio_file"]["url"]),
          ("fal-ai/stable-audio-25/text-to-audio", lambda p: {"prompt": p, "seconds_total": 40}, lambda r: r["audio"]["url"])]


def get_bgm(mood):
    """분위기 이름 → mp3 경로. '없음'이거나 만들 수 없으면 None."""
    if mood not in MOODS:
        return None
    BGM.mkdir(parents=True, exist_ok=True)
    out = BGM / f"{mood}.mp3"
    if out.exists():
        return out
    import fal_client
    for model, args, url_of in MODELS:
        try:
            print(f"    배경음악 생성: {mood} ({model})", flush=True)
            r = fal_client.subscribe(model, arguments=args(MOODS[mood]))
            wav = BGM / f"{mood}.wav"
            sources._download(url_of(r), wav)
            subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(wav), "-af", "loudnorm=I=-16",
                            "-b:a", "160k", str(out)], check=True)
            wav.unlink()
            return out
        except Exception as e:
            print(f"    ! 배경음악 실패({model}): {e}", flush=True)
    return None


if __name__ == "__main__":
    for m in MOODS:
        print(m, get_bgm(m))
