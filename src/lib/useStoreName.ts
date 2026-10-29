import { useCallback, useState } from "react";

const STORE_NAME_KEY = "wingsfarm-ai-store-name";

/** 스토어(업체)명 — 출고 지연 안내·상세페이지 제작이 같은 값을 공유 (ClientOnly 안에서만 사용) */
export function useStoreName() {
  const [storeName, setStoreName] = useState(() => localStorage.getItem(STORE_NAME_KEY) ?? "");
  const save = useCallback((value: string) => {
    setStoreName(value);
    localStorage.setItem(STORE_NAME_KEY, value);
  }, []);
  return [storeName, save] as const;
}
