"use client";

/**
 * 윙스팜 숏폼 Studio — 사이드바·앱 크롬 없이 스튜디오만 전체 화면.
 */
export default function ShortformPage() {
  return (
    <iframe
      title="윙스팜 숏폼 Studio"
      src="/shortform-app/index.html?v=33"
      className="fixed inset-0 z-50 h-full w-full border-0 bg-[#f7f5ef]"
      allow="clipboard-read; clipboard-write"
    />
  );
}
