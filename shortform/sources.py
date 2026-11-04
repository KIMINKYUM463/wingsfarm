"""장면별 영상 소스 확보.

- AI 장면: 레퍼런스 사진 → (fal.ai 이미지 편집) 세로 9:16 장면 사진 → (fal.ai 이미지→영상) 5초 클립
- 스톡 장면: Pexels에서 세로 영상을 검색해 내려받음
- 키가 없거나 실패하면 None을 돌려주고, 생성기는 레퍼런스 사진으로 대신 만든다.

만든 클립은 상품폴더/_clips/ 에 저장해 두고 다시 쓴다 (후킹 버전 3개가 같은 클립을 공유, 비용은 한 번만).
API 키는 shortform/.env 에 적는다 (.env.example 참고).
"""
import base64
import io
import json
import os
import random
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent

IMAGE_MODEL = "fal-ai/nano-banana-pro/edit"
VIDEO_MODEL = "fal-ai/kling-video/o3/standard/image-to-video"


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                if v.strip():
                    os.environ.setdefault(k.strip(), v.strip())


load_env()

# 한국 품목명 → (AI 프롬프트용 영어 설명, 스톡 검색어)
EN_NAMES = {
    "참외": ("Korean melon (chamoe), an oblong bright-yellow oriental melon with white stripes and crisp white flesh", "melon"),
    "사과": ("Korean apple", "apple"),
    "배": ("Korean pear (large round golden-brown Asian pear)", "pear"),
    "감귤": ("Jeju mandarin orange", "tangerine"),
    "귤": ("Jeju mandarin orange", "tangerine"),
    "한라봉": ("Hallabong, a large Jeju mandarin with a bump on top", "orange"),
    "딸기": ("fresh strawberry", "strawberry"),
    "수박": ("watermelon", "watermelon"),
    "복숭아": ("peach", "peach"),
    "샤인머스캣": ("Shine Muscat green grapes", "green grapes"),
    "포도": ("grapes", "grapes"),
    "고구마": ("Korean sweet potato", "sweet potato"),
    "감자": ("potato", "potato"),
    "토마토": ("tomato", "tomato"),
    "옥수수": ("corn on the cob", "corn"),
    "대게": ("snow crab", "crab"),
    "꽃게": ("blue crab", "crab"),
    "고등어": ("mackerel", "mackerel fish"),
    "갈치": ("silver hairtail fish", "fish market"),
    "굴": ("fresh oysters", "oysters"),
    "전복": ("abalone", "abalone"),
    "새우": ("shrimp", "shrimp"),
    "한우": ("Korean Hanwoo beef with fine marbling", "beef steak"),
    "삼겹살": ("Korean pork belly", "pork belly grill"),
}

STYLE = ("photorealistic vertical 9:16 food commercial shot, natural daylight, appetizing, shallow depth of field, "
         "no text, no logos, no watermark. Keep the product looking exactly like the reference image.")

# 카테고리별 AI 장면: 이름 → (장면 사진 프롬프트, 움직임 프롬프트)
AI_SHOTS = {
    "과일": {
        "hook": ("This {en} cut in half on a rustic wooden cutting board, fresh juicy flesh glistening, water droplets",
                 "A knife finishes slicing through and the halves fall open, juice glistens, slow push-in, slow motion"),
        "detail": ("Macro close-up of the skin of this {en} covered in fresh water droplets",
                   "Slow camera orbit, water droplets slide down the skin, soft light flicker"),
        "crave": ("A hand holding a bite-sized slice of this {en} toward the camera, juicy flesh",
                  "The hand slowly lifts the slice toward the camera, a drop of juice falls, slight handheld motion"),
        "hero": ("A wooden crate full of fresh {en} on a farm table, warm sunlight, green leaves around",
                 "Slow dolly-in toward the crate, sunlight flares gently, leaves sway"),
    },
    "채소": {
        "hook": ("Fresh {en} being rinsed under running water in a kitchen sink, crisp and vibrant",
                 "Water splashes over the vegetables, slow motion, slow push-in"),
        "detail": ("Macro close-up of fresh {en} with water droplets", "Slow orbit, droplets glisten"),
        "crave": ("A finished home-cooked dish made with {en}, steam rising", "Steam rises, chopsticks lift a bite"),
        "hero": ("A box full of freshly harvested {en} on a farm table, sunlight", "Slow dolly-in, soft breeze"),
    },
    "수산": {
        "hook": ("Fresh {en} on crushed ice at a fish market, glossy and fresh", "Ice glistens, slow push-in, light reflections"),
        "detail": ("Macro close-up of fresh {en}, glossy texture", "Slow orbit, light glides across the surface"),
        "crave": ("Cooked {en} on a plate, golden and juicy, steam rising", "Steam rises, chopsticks pull apart tender flesh"),
        "hero": ("A packed box of fresh {en} on ice ready for delivery", "Slow dolly-in, ice sparkles"),
    },
    "축산": {
        "hook": ("{en} sizzling on a hot grill", "Meat sizzles, smoke rises, tongs flip it, slow motion"),
        "detail": ("Macro close-up of raw {en} showing marbling", "Slow orbit, light reveals the marbling"),
        "crave": ("A cut piece of grilled {en} showing juicy pink center", "Tongs lift the piece, juice drips"),
        "hero": ("Premium {en} packed in a gift box", "Slow dolly-in"),
    },
    "가공": {
        "hook": ("This {en} broken in half showing the inside texture", "Hands break it apart slowly, crumbs fall, slow motion"),
        "detail": ("Macro close-up of this {en}", "Slow orbit"),
        "crave": ("A hand picking up this {en} to eat", "Hand lifts it toward the camera"),
        "hero": ("This {en} neatly arranged in its package on a table", "Slow dolly-in"),
    },
}

# 정보형 템플릿(보관법·손질법·물량리빌)에서 쓰는 공통 장면. 상품 product.json의 "shots"가 있으면 그쪽이 우선이다.
EXTRA_SHOTS = {
    "과일": {
        "hold": ("A hand picking up one whole {en} from a pile and weighing it in the palm", "The hand lifts and turns it slightly, slow push-in"),
        "pack": ("Top view of hands placing whole {en} one by one into a brown delivery box, neat rows", "The hands place the last one into the box, slow push-in"),
        "store": ("Whole {en} placed neatly in the vegetable drawer of a clean refrigerator", "The drawer slides open slowly, cool light, gentle push-in"),
        "prep": ("Hands peeling or cutting this {en} with a knife on a wooden cutting board", "The knife moves smoothly, peel curls away, slow motion"),
    },
    "채소": {
        "hold": ("Hands holding a bunch of freshly harvested {en} with soil-fresh look", "The hands lift it toward the camera, slight handheld motion"),
        "pack": ("Hands packing fresh {en} into a brown delivery box", "The hands press the last bunch into the box, slow push-in"),
        "store": ("Fresh {en} wrapped in paper towel inside a refrigerator drawer", "The drawer slides open, gentle push-in"),
        "prep": ("Hands chopping fresh {en} on a wooden cutting board with a knife", "The knife chops rhythmically, pieces fall aside"),
    },
    "수산": {
        "hold": ("Gloved hands holding up a fresh {en} over crushed ice", "The hands lift it slightly, ice glistens"),
        "pack": ("Hands packing fresh {en} into a styrofoam box with ice packs for delivery", "The hands lay ice packs on top, slow push-in"),
        "store": ("Portioned {en} in sealed freezer bags lying flat in a freezer", "Frost mist drifts, gentle push-in"),
        "prep": ("Hands cleaning and cutting fresh {en} on a cutting board with a sharp knife", "The knife glides through, slow motion, close-up"),
    },
    "축산": {
        "hold": ("Hands holding a vacuum-packed cut of {en}", "The hands tilt the pack toward the camera"),
        "pack": ("Hands packing {en} into an insulated delivery box with ice packs", "The lid closes slowly, push-in"),
        "store": ("Vacuum-sealed {en} placed in a clean refrigerator", "The fridge door opens, cool light"),
        "prep": ("Hands slicing {en} on a wooden board with a sharp knife", "The knife glides through, slow motion"),
    },
    "가공": {
        "hold": ("A hand holding this {en} package toward the camera", "The hand turns it slightly"),
        "pack": ("Hands packing this {en} into a delivery box", "The hands close the box flaps, push-in"),
        "store": ("This {en} sealed in an airtight container on a pantry shelf", "Slow push-in"),
        "prep": ("Hands opening this {en} and pouring it onto a plate", "Contents slide out, slow motion"),
    },
}
for _cat, _shots in EXTRA_SHOTS.items():
    for _k, _v in _shots.items():
        AI_SHOTS[_cat].setdefault(_k, _v)

STOCK_QUERIES = {
    "과일": {"origin": ["{stock} farm", "fruit orchard harvest", "farmer harvesting fruit"], "product": ["{stock}", "fresh fruit"]},
    "채소": {"origin": ["{stock} field", "vegetable farm harvest"], "product": ["{stock}", "fresh vegetables"]},
    "수산": {"origin": ["fishing boat sea", "fishing port"], "product": ["{stock}", "fish market"]},
    "축산": {"origin": ["cattle farm", "farm countryside"], "product": ["{stock}", "butcher meat"]},
    "가공": {"origin": ["food factory production", "kitchen cooking"], "product": ["{stock}", "snack food"]},
}


def names(p):
    if p.get("en_name"):
        return p["en_name"], p.get("stock_query", p["en_name"])
    for ko, pair in EN_NAMES.items():
        if ko in p["name"]:
            return pair
    return p["name"], p["name"]


# 일부 PC는 파이썬 기본 인증서로 HTTPS 검증이 안 되므로 certifi 인증서를 쓴다
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
UA = "shortform-generator/1.0"


def _http(url, data=None, headers=None, timeout=60):
    h = {"User-Agent": UA, **(headers or {})}
    if data is not None and not isinstance(data, bytes):
        data = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
        return r.read()


def _download(url, out):
    Path(out).write_bytes(_http(url, timeout=300))


def _data_uri(path, max_side=1280):
    """Replicate 입력용: 사진을 줄여 base64 data URI로 만든다."""
    from PIL import Image
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------- AI 제공사 (fal.ai 먼저, 실패하면 Replicate) ----------

REPLICATE_IMAGE = "google/nano-banana-pro"
REPLICATE_VIDEO = "kwaivgi/kling-v2.5-turbo-pro"


def _replicate(model, inp):
    tok = _replicate_token()
    if not tok:
        raise RuntimeError("REPLICATE_API_TOKEN 이 없어요")
    auth = {"Authorization": f"Bearer {tok}"}
    pred = json.loads(_http(f"https://api.replicate.com/v1/models/{model}/predictions",
                            {"input": inp}, {**auth, "Prefer": "wait=60"}, timeout=90))
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(5)
        pred = json.loads(_http(pred["urls"]["get"], headers=auth))
    if pred["status"] != "succeeded":
        raise RuntimeError(f"Replicate {pred['status']}: {pred.get('error')}")
    out = pred["output"]
    return out[0] if isinstance(out, list) else out


def _replicate_token():
    return os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY") or os.environ.get("REPLICATE_TOKEN")


def _providers():
    ps = []
    if os.environ.get("FAL_KEY"):
        ps.append("fal")
    if _replicate_token():
        ps.append("replicate")
    return ps


def _gen_frame(provider, prompt, ref_photo):
    if provider == "fal":
        import fal_client
        img = fal_client.subscribe(IMAGE_MODEL, arguments={
            "prompt": prompt, "image_urls": [fal_client.upload_file(str(ref_photo))],
            "aspect_ratio": "9:16", "resolution": "2K", "output_format": "jpeg"})
        return img["images"][0]["url"]
    return _replicate(REPLICATE_IMAGE, {"prompt": prompt, "image_input": [_data_uri(ref_photo)],
                                        "aspect_ratio": "9:16", "resolution": "2K", "output_format": "jpg"})


def _gen_video(provider, motion, frame_path, frame_url, p):
    if provider == "fal":
        import fal_client
        url = frame_url if frame_url and "fal" in frame_url else fal_client.upload_file(str(frame_path))
        vid = fal_client.subscribe(p.get("video_model", VIDEO_MODEL), arguments={
            "image_url": url, "prompt": motion, "duration": "5", "generate_audio": False})
        return vid["video"]["url"]
    url = frame_url if frame_url and "replicate" in frame_url else _data_uri(frame_path)
    return _replicate(REPLICATE_VIDEO, {"prompt": motion, "start_image": url, "duration": 5,
                                        "aspect_ratio": "9:16", "negative_prompt": "text, watermark, distorted"})


FAILED = set()  # 이번 실행에서 실패한 장면은 다른 버전에서 다시 시도하지 않는다 (비용 낭비 방지)


def ai_clip(shot, p, ref_photo, cache):
    out = cache / f"ai_{shot}.mp4"
    frame = cache / f"ai_{shot}.jpg"
    if out.exists():
        return out
    providers = _providers()
    if shot in FAILED or not providers:
        return None
    en, _ = names(p)
    # product.json의 "shots"로 상품 전용 장면을 추가할 수 있다 (예: 정보형의 냉장 보관 장면)
    spec = p.get("shots", {}).get(shot) or AI_SHOTS[p["category"]][shot]
    img_prompt, motion = (s.format(en=en) for s in spec)

    frame_url = None
    if not frame.exists():  # 장면 사진은 한 번 만들면 저장해 두고 다시 쓴다
        for prov in providers:
            try:
                print(f"    AI 장면 사진 생성: {shot} ({prov})")
                frame_url = _gen_frame(prov, f"{img_prompt}. {STYLE}", ref_photo)
                _download(frame_url, frame)
                break
            except Exception as e:
                print(f"    ! 장면 사진 실패({shot}, {prov}): {e}")
        else:
            FAILED.add(shot)
            return None

    for prov in providers:
        try:
            print(f"    AI 영상 생성: {shot} ({prov}, 1~3분)")
            _download(_gen_video(prov, motion, frame, frame_url, p), out)
            return out
        except Exception as e:
            print(f"    ! 영상 생성 실패({shot}, {prov}): {e}")
    FAILED.add(shot)
    return None


# ---------- 스톡 ----------

def stock_clip(shot, p, cache, min_len=5):
    out = cache / f"stock_{shot}.mp4"
    if out.exists():
        return out
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return None
    _, stock = names(p)
    for q in p.get("stock_shots", {}).get(shot) or STOCK_QUERIES[p["category"]][shot]:
        q = q.format(stock=stock)
        url = "https://api.pexels.com/v1/videos/search?" + urllib.parse.urlencode(
            {"query": q, "orientation": "portrait", "size": "medium", "per_page": 15})
        try:
            videos = json.loads(_http(url, headers={"Authorization": key})).get("videos", [])
        except Exception as e:
            print(f"    ! Pexels 검색 실패({q}): {e}")
            return None
        videos = [v for v in videos if v.get("duration", 0) >= min_len]
        if not videos:
            continue
        v = random.Random(p["name"] + shot).choice(videos[:8])
        files = [f for f in v["video_files"] if f.get("height") and f["height"] >= 1280 and f["height"] >= f["width"]]
        if not files:
            continue
        best = min(files, key=lambda f: abs(f["height"] - 1920))
        print(f"    스톡 영상: '{q}' → {v['url']}")
        _download(best["link"], out)
        credits = cache / "credits.txt"
        with open(credits, "a", encoding="utf-8") as f:
            f.write(f"{shot}: Video by {v['user']['name']} on Pexels — {v['url']}\n")
        return out
    return None


def get_clip(source, p, ref_photo, pdir):
    """source 예: 'ai:hook', 'stock:origin', 'photo:1'. 클립 경로 또는 None (None이면 사진으로 만든다)."""
    cache = pdir / "_clips"
    cache.mkdir(exist_ok=True)
    kind, shot = source.split(":")
    if kind == "photo":
        return None
    if kind == "ai":
        return ai_clip(shot, p, ref_photo, cache)
    return stock_clip(shot, p, cache)
