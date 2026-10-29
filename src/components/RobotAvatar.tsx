"use client";

import { useId } from "react";

export function RobotAvatar({ size = 40, thinking = false }: { size?: number; thinking?: boolean }) {
  const id = useId();
  const eye = "origin-center animate-blink [transform-box:fill-box]";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={`shrink-0 ${thinking ? "animate-bob" : ""}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <line x1="24" y1="5" x2="24" y2="11" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="4.5" r="3" fill="#fcd34d" className={thinking ? "animate-pulse" : ""} />
      <rect x="3" y="21" width="4" height="10" rx="2" fill="#047857" />
      <rect x="41" y="21" width="4" height="10" rx="2" fill="#047857" />
      <rect x="6" y="11" width="36" height="30" rx="11" fill={`url(#${id})`} />
      <rect x="11" y="17" width="26" height="16" rx="7" fill="#07140f" />
      <ellipse cx="18.5" cy="24" rx="2.6" ry="3" fill="#fcd34d" className={eye} />
      <ellipse cx="29.5" cy="24" rx="2.6" ry="3" fill="#fcd34d" className={eye} />
      <path d="M20 29.5 Q24 31.5 28 29.5" stroke="#6ee7b7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
