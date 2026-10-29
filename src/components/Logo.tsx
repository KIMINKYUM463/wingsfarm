import { useId } from "react";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";

/** 잎사귀 두 장이 날개처럼 펼쳐진 윙스팜AI 심볼 */
export function LogoMark({ size = 36 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${BRAND} 로고`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <g fill="#ffffff">
        <path d="M32 46C22 44 10 36 9 20c11 0 21 8 23 26Z" opacity="0.7" />
        <path d="M32 46c10-2 22-10 23-26-11 0-21 8-23 26Z" opacity="0.7" />
        <path d="M32 46c-7-6-14-16-14-32 9 4 14 16 14 32Z" />
        <path d="M32 46c7-6 14-16 14-32-9 4-14 16-14 32Z" />
      </g>
      <path d="M32 44v10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-xl font-extrabold tracking-tight text-emerald-800">
          윙스팜<span className="ml-0.5 bg-linear-to-r from-emerald-500 to-amber-500 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="block text-[11px] text-stone-400">{BRAND_TAGLINE}</span>
      </span>
    </span>
  );
}
