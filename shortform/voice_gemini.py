"""Gemini 목소리 (Google Gemini TTS).

edge-tts 와 같은 모양으로 쓸 수 있게 (mp3 파일 + 단어별 [시작, 끝, 글자]) 를 돌려준다.
Gemini 는 단어 타이밍을 주지 않아서, 소리 속 쉬는 구간과 어절 길이로 자막 타이밍을 맞춘다.
같은 문장·목소리는 다시 만들지 않고 저장해 둔 것을 쓴다 (A/B·다시 만들기 때 비용 0).
"""
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "studio" / "data" / "tts_cache"
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# 시험 결과(2026-11): 2.5 flash 는 짧은 문장의 끝말('달아요', '고르세요')을 자주 빼먹고, 3.8 은 끝까지 읽는다.
# 3.8 은 말투 지시문(영어 문장이든 '[밝고 빠르게]' 같은 태그든)을 자주 소리 내 읽어 버려서 지시문 없이 문장만 보낸다.
# 말투 차이는 목소리(Kore·Zephyr·Puck·Charon) 자체로 낸다.
MODELS = ["gemini-3.8-flash-tts", "gemini-2.5-pro-preview-tts", "gemini-2.5-flash-preview-tts"]
STYLE = {}
RATE = 24000


def _syllables(text):
    return sum(1 for c in text if "가" <= c <= "힣" or c.isdigit()) or 1


def _sane(pcm, text):
    """끝이 잘렸거나(너무 짧음) 지시문까지 읽었으면(너무 김) False."""
    sec, n = len(pcm) / (RATE * 2), _syllables(text)
    return n / 14 <= sec <= n / 2.5 + 1.5


def _key():
    for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        if os.environ.get(k):
            return os.environ[k]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("GEMINI_API_KEY 가 .env 에 없어요")


def _ffmpeg():
    return shutil.which("ffmpeg") or str(Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe")


def _request(text, voice):
    """모델을 차례로 시도한다. 첫 모델은 결과 길이가 이상하면 한 번 더 만든다."""
    body = {"contents": [{"parts": [{"text": STYLE.get(voice, "") + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    last, attempts = None, [MODELS[0]] + MODELS
    for model in attempts:
        req = urllib.request.Request(API.format(model=model), data=json.dumps(body).encode(),
                                     headers={"x-goog-api-key": _key(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
            pcm = base64.b64decode(d["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        except (urllib.error.URLError, KeyError, IndexError, ValueError) as e:
            last = e
            detail = e.read()[:200].decode("utf-8", "replace") if isinstance(e, urllib.error.HTTPError) else e
            print(f"    ! Gemini 목소리 {model} 실패: {detail}", flush=True)
            continue
        if _sane(pcm, text):
            return pcm, model
        last = f"{model} 결과 길이가 이상해요({len(pcm) / (RATE * 2):.1f}초)"
        print(f"    ! {last}, 다시 만들어요", flush=True)
    raise RuntimeError(f"Gemini 목소리를 만들지 못했어요: {last}")


def _speech_spans(path):
    """소리가 나는 구간 [(시작, 끝)] — 0.18초 넘게 조용한 곳을 쉼으로 본다."""
    out = subprocess.run([_ffmpeg(), "-hide_banner", "-i", str(path), "-af", "silencedetect=n=-38dB:d=0.18", "-f", "null", "-"],
                         capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()
    total = int(h) * 3600 + int(m) * 60 + float(s)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    spans, cur = [], 0.0
    for i, s in enumerate(starts):
        if s - cur > 0.05:
            spans.append((cur, s))
        cur = ends[i] if i < len(ends) else total
    if total - cur > 0.05:
        spans.append((cur, total))
    return spans or [(0.0, total)]


def _weight(tok):
    # 한글은 글자 = 음절. 숫자는 읽으면 길어지므로 자릿수당 1.5
    w = sum(1.5 if c.isdigit() else 1 for c in tok if c.isalnum() or "가" <= c <= "힣")
    return max(1, w) + 0.6  # 어절 사이 틈


def _align(tokens, spans):
    """어절들을 소리 구간에 나눠 담는다. 문장부호(.,?!)로 끝나는 어절 뒤의 쉼과 구간 경계를 맞춘다."""
    phrases, cur = [], []
    for t in tokens:
        cur.append(t)
        if re.search(r"[.,?!]$", t):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    if len(phrases) != len(spans):  # 쉼 개수가 안 맞으면 전체를 한 구간으로
        phrases, spans = [tokens], [(spans[0][0], spans[-1][1])]
    words = []
    for ph, (a, b) in zip(phrases, spans):
        ws = [_weight(t) for t in ph]
        unit, t0 = (b - a) / sum(ws), a
        for tok, w in zip(ph, ws):
            words.append((round(t0, 3), round(t0 + unit * w, 3), tok))
            t0 += unit * w
    return words


def synthesize(text, voice, out, tempo=1.0):
    """text → out(mp3). [(시작초, 끝초, 어절)] 을 돌려준다."""
    tokens = text.split()
    # v3 = 3.8 모델 + 한국어 말투 태그 + 길이 검사
    key = hashlib.sha1(json.dumps([MODELS[0], STYLE.get(voice), voice, text, tempo, "v3"], ensure_ascii=False).encode()).hexdigest()[:20]
    CACHE.mkdir(parents=True, exist_ok=True)
    mp3 = CACHE / f"{key}.mp3"
    if not mp3.exists():
        pcm, model = _request(text, voice)
        raw = CACHE / f"{key}.pcm"
        raw.write_bytes(pcm)
        # 앞뒤 무음만 자른다. 끝음절('요')이 잘리지 않게 더 조용한 기준(-55dB)에 0.12초 여유를 남긴다
        trim = "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.12"
        af = f"{trim},areverse,{trim},areverse"
        if tempo != 1.0:
            af += f",atempo={tempo}"
        subprocess.run([_ffmpeg(), "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", str(raw),
                        "-af", af, "-ar", "44100", "-b:a", "160k", str(mp3)], check=True)
        raw.unlink()
        print(f"    Gemini 목소리 생성: {voice} ({model})", flush=True)
    shutil.copy(mp3, out)
    return _align(tokens, _speech_spans(mp3))
