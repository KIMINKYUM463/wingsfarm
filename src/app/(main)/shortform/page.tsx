"use client";

import Link from "next/link";

/**
 * 숏폼 마케팅 스튜디오 (윙스팜에 이식).
 * UI는 public/shortform-app, API·영상 엔진은 /api/shortform → Python bridge (HTTP 서버 없음).
 */
export default function ShortformPage() {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0b1220] md:left-64">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/90 px-4 py-2 text-sm text-white/80 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/marketing" className="shrink-0 rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white">
            ← 마케팅
          </Link>
          <p className="truncate font-semibold text-white">숏폼 스튜디오</p>
        </div>
        <p className="hidden text-xs text-white/45 sm:block">앱 안에 이식됨 · 별도 서버 실행 없음</p>
      </div>
      <iframe title="숏폼 스튜디오" src="/shortform-app/index.html?v=4" className="min-h-0 w-full flex-1 border-0 bg-white" allow="clipboard-read; clipboard-write" />
    </div>
  );
}
