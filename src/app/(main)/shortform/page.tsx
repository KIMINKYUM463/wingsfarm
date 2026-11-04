"use client";

import Link from "next/link";

/**
 * 윙스팜 숏폼 Studio — 좌측 사이드바 없이 전체 화면.
 * UI: public/shortform-app · API: /api/shortform (배포는 Node 웹 엔진)
 */
export default function ShortformPage() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]">
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#0b1220]/95 px-4 py-2 text-sm text-white/80 backdrop-blur">
        <Link href="/marketing" className="shrink-0 rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white">
          ← 마케팅
        </Link>
        <p className="truncate font-semibold text-white">윙스팜 숏폼 Studio</p>
      </div>
      <iframe
        title="윙스팜 숏폼 Studio"
        src="/shortform-app/index.html?v=6"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
