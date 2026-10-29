import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center">
      <p className="text-4xl" aria-hidden>
        🌾
      </p>
      <h1 className="mt-3 text-xl font-bold text-stone-900">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-sm text-stone-500">주소가 바뀌었거나 없는 메뉴입니다.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
        대시보드로
      </Link>
    </div>
  );
}
