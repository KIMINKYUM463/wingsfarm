"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * localStorage에 저장된 데이터와 서버 렌더링 결과가 달라 생기는
 * hydration 불일치를 막기 위해 클라이언트 마운트 후에만 렌더링한다.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <div className="p-10 text-sm text-stone-400">불러오는 중…</div>;
  return <>{children}</>;
}
