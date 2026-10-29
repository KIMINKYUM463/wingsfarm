import "./(main)/globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `페이지를 찾을 수 없어요 · ${BRAND}` };

export default function GlobalNotFound() {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-stone-50 px-4 text-stone-800">
        <div className="max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🌾
          </p>
          <h1 className="mt-3 text-xl font-bold text-stone-900">페이지를 찾을 수 없어요</h1>
          <p className="mt-2 text-sm text-stone-500">주소가 바뀌었거나 없는 메뉴입니다.</p>
          <Link href="/" className="mt-5 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            대시보드로
          </Link>
        </div>
      </body>
    </html>
  );
}
