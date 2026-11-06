"""윙스팜 Next 앱용 숏폼 엔진 (HTTP 서버 없음).

stdin에 JSON 한 줄 → stdout에 JSON 한 줄.
Next.js API가 이 프로세스를 붙잡아 두고 요청을 넘긴다. 사용자는 스튜디오 서버를 따로 켜지 않는다.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
import urllib.parse
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
ROOT = STUDIO.parent
sys.path.insert(0, str(STUDIO))
sys.path.insert(0, str(ROOT))

# wingsfarm 루트 .env.local 키도 읽는다 (부모가 넘겨준 환경변수 우선)
def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            if v.strip():
                os.environ.setdefault(k.strip(), v.strip())


_load_env_file(ROOT / ".env")
_load_env_file(ROOT.parent / ".env.local")
_load_env_file(ROOT.parent / ".env")

import server  # noqa: E402


def _media_url(path: Path) -> str:
    rel = Path(path).resolve().relative_to(server.OUTPUT.resolve())
    return "/api/shortform/media/output/" + "/".join(urllib.parse.quote(p) for p in rel.parts)


server.media_url = _media_url  # type: ignore[assignment]

_orig_product_info = server.product_info


def _product_info(pdir: Path):
    info = _orig_product_info(pdir)
    photo = info.get("photo")
    if isinstance(photo, str) and photo.startswith("/media/"):
        info["photo"] = "/api/shortform" + photo
    return info


server.product_info = _product_info  # type: ignore[assignment]

server.JOBS = server.Jobs()


def _ok(result):
    return {"ok": True, "result": result}


def _err(message: str, status: int = 400):
    return {"ok": False, "error": message, "status": status}


def handle(req: dict):
    method = req.get("method")
    body = req.get("params") or {}

    try:
        if method == "ping":
            return _ok({"pong": True})

        if method == "bootstrap":
            refs = server.load_references()
            return _ok({
                "templates": server.load_templates(),
                "references": refs["items"],
                "hooks": refs["hooks"],
                "collected": refs.get("collected"),
                "scenes": server.SCENES,
                "products": server.list_products(),
                "moods": list(server.music.MOODS) + ["없음"],
                "voices": list(server.VOICES),
                "keys": {
                    "fal": bool(os.environ.get("FAL_KEY")),
                    "replicate": bool(
                        os.environ.get("REPLICATE_API_TOKEN")
                        or os.environ.get("REPLICATE_API_KEY")
                        or os.environ.get("REPLICATE_TOKEN")
                    ),
                    "openai": bool(os.environ.get("OPENAI_API_KEY")),
                    "pexels": bool(os.environ.get("PEXELS_API_KEY")),
                    "gemini": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
                    "aiScene": bool(
                        os.environ.get("FAL_KEY")
                        or os.environ.get("REPLICATE_API_TOKEN")
                        or os.environ.get("REPLICATE_API_KEY")
                        or os.environ.get("REPLICATE_TOKEN")
                    ),
                    "serpapi": bool(os.environ.get("SERPAPI_API_KEY")),
                    "youtubeCc": bool(os.environ.get("YOUTUBE_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
                    "ccSearch": bool(
                        os.environ.get("YOUTUBE_API_KEY")
                        or os.environ.get("GOOGLE_API_KEY")
                        or os.environ.get("SERPAPI_API_KEY")
                    ),
                },
            })

        if method == "products":
            return _ok(server.list_products())

        if method == "jobs":
            return _ok(server.JOBS.snapshot())

        if method == "job":
            job = server.JOBS.get(body.get("id") or "")
            return _ok(job) if job else _err("없는 작업", 404)

        if method == "analysis":
            a = server.analyzer.load(body.get("id") or "")
            return _ok(a) if a else _err("아직 해부하지 않은 영상이에요", 404)

        if method == "product":
            return _ok(server.upsert_product(body))

        if method == "draft":
            templates = server.load_templates()
            tpl = templates[body["template"]]
            pdir = server.product_dir(body["product"])
            p = server.read_product(pdir)
            refs = server.load_references()
            ref = next((r for r in refs["items"] if r["id"] == body.get("ref")), None)
            fields, via = server.copywriter.draft(body["template"], tpl, p, ref, refs["hooks"])
            return _ok({"fields": fields, "via": via})

        if method == "render":
            return _ok(server.JOBS.add(body, server.load_templates()))

        if method == "analyze":
            vid = server.analyzer.video_id(body.get("url") or body.get("id"))
            ref = server.find_ref(vid)
            a = server.analyzer.analyze(
                vid,
                {"title": ref["title"], "views": ref["views"]} if ref else None,
                force=bool(body.get("force")),
            )
            if not ref:
                server.add_user_ref(a)
            return _ok({"analysis": a, "ref": server.find_ref(vid)})

        if method == "clone_draft":
            p = server.read_product(server.product_dir(body["product"]))
            rid = server.analyzer.video_id(body["ref"])
            ref = server.find_ref(rid)
            a = server.analyzer.analyze(rid, {"title": ref["title"], "views": ref["views"]} if ref else None)
            fields, via = server.analyzer.clone_draft(a, p)
            return _ok({"fields": fields, "via": via, "analysis": a})

        if method == "chat":
            p = server.read_product(server.product_dir(body["product"]))
            kind = "레퍼런스 복제" if body["template"] == "clone" else server.load_templates()[body["template"]]["name"]
            fields, reply = server.copywriter.chat_edit(
                kind,
                body["fields"],
                body["message"],
                p,
                [s["id"] for s in server.SCENES],
            )
            return _ok({"fields": fields, "reply": reply})

        if method == "post":
            job = server.JOBS.get(body["job"])
            if not job or not job.get("result"):
                raise ValueError("완성된 영상이 있어야 올릴 글을 쓸 수 있어요")
            p = server.read_product(server.PRODUCTS / job["product"])
            script = (job["result"].get("script") or "").replace("*", "")
            pack = server.copywriter.post_pack(p, script, job["template_name"])
            texts = []
            for v in pack.values():
                if isinstance(v, dict):
                    texts += [str(x) for x in v.values() if isinstance(x, str)]
            job["post"] = pack
            server.JOBS.save()
            return _ok({"post": pack, "lint": server.guard.lint(texts, p)})

        if method == "hooks":
            p = server.read_product(server.product_dir(body["product"]))
            hooks = server.copywriter.hook_variants(p, body.get("kind", ""), body.get("hook", ""), body.get("rest", []))
            if not hooks:
                raise ValueError("훅을 만들지 못했어요. 다시 시도해 주세요")
            return _ok({"hooks": hooks})

        if method == "plan":
            return _ok(server.make_plan(body["product"], int(body.get("n") or 5)))

        if method == "plan_run":
            items = body.get("items") or []
            import threading

            threading.Thread(
                target=server.run_plan,
                args=(body["product"], items, body.get("mode", "photo")),
                daemon=True,
            ).start()
            return _ok({"queued": len(items)})

        if method == "jobs_hide":
            job = server.JOBS.get(body["job"])
            if not job:
                raise ValueError("이미 목록에 없는 영상이에요")
            if job["status"] not in ("done", "error"):
                raise ValueError("만드는 중인 영상은 뺄 수 없어요. 끝난 뒤에 빼 주세요")
            server.JOBS.drop(job["id"])
            server.JOBS.save()
            return _ok({"ok": True})

        if method == "lint":
            pdir = body.get("product") and server.product_dir(body["product"])
            p = server.read_product(pdir) if pdir and (pdir / "product.json").exists() else None
            return _ok({"hits": server.guard.lint(body.get("texts", []), p)})

        if method == "reshoot":
            return _ok(_reshoot(body))

        return _err(f"unknown method: {method}", 404)

    except KeyError as e:
        return _err(f"필요한 값이 빠졌어요({e}). 화면을 새로 고친 뒤 다시 해 주세요", 400)
    except ValueError as e:
        return _err(str(e), 400)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        return _err(str(e) or "알 수 없는 문제가 생겼어요", 500)


def _reshoot(body: dict):
    # server 모듈에 함수로 안 빼고 POST 핸들러에만 있던 로직
    import re
    import shutil
    import time

    pdir = server.product_dir(body["product"])
    shot = re.sub(r"\W", "", body["shot"])
    cache = pdir / "_clips"
    bak = cache / f"_old_{time.strftime('%Y%m%d_%H%M%S')}"
    moved = [f for f in cache.glob(f"ai_{shot}.*")]
    if moved:
        bak.mkdir(exist_ok=True)
        for f in moved:
            shutil.move(str(f), bak / f.name)
    return {"ok": True, "moved": len(moved), "product": server.product_info(pdir)}


def main():
    sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None
    sys.stderr.reconfigure(encoding="utf-8") if hasattr(sys.stderr, "reconfigure") else None
    # 준비 완료 신호
    print(json.dumps({"ok": True, "result": {"ready": True}}, ensure_ascii=False), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            rid = req.get("id")
            out = handle(req)
            out["id"] = rid
            print(json.dumps(out, ensure_ascii=False), flush=True)
        except Exception as e:
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"id": None, "ok": False, "error": str(e), "status": 500}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
