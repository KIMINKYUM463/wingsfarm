"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
      <p className="text-4xl" aria-hidden>
        🥲
      </p>
      <h1 className="mt-3 text-xl font-bold text-rose-900">화면을 그리다가 문제가 생겼어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-rose-800">
        입력한 데이터는 브라우저에 그대로 남아 있습니다. 다시 시도해도 반복되면 설정에서 데이터를 백업한 뒤 알려 주세요.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-rose-700/60">오류 코드 {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={retry} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          다시 시도
        </button>
        <Link href="/" className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
          대시보드로
        </Link>
      </div>
    </div>
  );
}
