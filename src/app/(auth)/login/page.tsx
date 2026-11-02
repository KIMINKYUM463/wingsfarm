"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { LogoMark } from "@/components/Logo";
import { safeNext } from "@/lib/auth";
import { BRAND_TAGLINE } from "@/lib/brand";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) return window.location.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "로그인하지 못했어요.");
      setPassword("");
    } catch {
      setError("서버에 연결하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 size-96 animate-float rounded-full bg-sky-400/10 blur-3xl [animation-delay:-6s]" />

      <form onSubmit={submit} className="relative w-full max-w-sm animate-pop-in rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <p className="text-xl font-extrabold tracking-tight">
              윙스팜<span className="ml-0.5 bg-linear-to-r from-emerald-300 to-amber-300 bg-clip-text text-transparent">AI</span>
            </p>
            <p className="text-xs text-white/50">{BRAND_TAGLINE}</p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Image src="/assistant-robot.webp" alt="" width={44} height={44} className="animate-bob rounded-full ring-2 ring-white/60" priority />
          <p className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-stone-800">비밀번호를 입력하면 들어갈 수 있어요.</p>
        </div>

        <label htmlFor="password" className="mt-6 block text-sm font-medium text-white/70">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
          placeholder="비밀번호"
        />
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password.trim()}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-[#07140f] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
        <p className="mt-4 text-center text-xs text-white/40">한 번 들어오면 이 브라우저에서 30일 동안 유지돼요.</p>
      </form>
    </main>
  );
}
