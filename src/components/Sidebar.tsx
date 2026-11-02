"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/AppLink";
import { Logo, LogoMark } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { useAppStore } from "@/store/useAppStore";

type NavItem = { href: string; label: string; short: string; icon: string };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "",
    items: [
      { href: "/", label: "대시보드", short: "홈", icon: "🏠" },
      { href: "/roadmap", label: "수강생 로드맵", short: "로드맵", icon: "🎓" },
      { href: "/archive", label: "보관함", short: "보관함", icon: "🗂️" },
    ],
  },
  {
    title: "찾기",
    items: [
      { href: "/keywords", label: "키워드 분석", short: "키워드", icon: "🔍" },
      { href: "/season", label: "제철·콘텐츠 캘린더", short: "제철", icon: "🍑" },
      { href: "/prices", label: "도매 시세", short: "시세", icon: "📈" },
      { href: "/farm-map", label: "전국 산지 지도", short: "산지", icon: "🗺️" },
    ],
  },
  {
    title: "만들기",
    items: [
      { href: "/titles", label: "상품명 제조기", short: "상품명", icon: "✍️" },
      { href: "/tags", label: "검색 태그", short: "태그", icon: "🏷️" },
      { href: "/thumbnails", label: "썸네일 제조기", short: "썸네일", icon: "🖼️" },
      { href: "/detail-page", label: `${BRAND} 상세페이지`, short: "상세", icon: "📄" },
      { href: "/marketing", label: `${BRAND} 마케팅`, short: "마케팅", icon: "📣" },
      { href: "/listing-check", label: "등록 전 검수", short: "검수", icon: "🛡️" },
    ],
  },
  {
    title: "운영",
    items: [
      { href: "/margin", label: "가격·마진", short: "마진", icon: "🧮" },
      { href: "/ads", label: "쿠팡 광고 분석", short: "광고", icon: "🎯" },
      { href: "/cs", label: "CS 도우미", short: "CS", icon: "💬" },
      { href: "/reviews", label: "리뷰 분석", short: "리뷰", icon: "⭐" },
      { href: "/ops", label: "운영 체크리스트", short: "체크", icon: "✅" },
    ],
  },
  {
    title: "",
    items: [{ href: "/settings", label: "설정", short: "설정", icon: "⚙️" }],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function WorkingProduct() {
  const product = useAppStore((s) => s.workingProduct);
  const setProduct = useAppStore((s) => s.setWorkingProduct);
  if (!product) return null;
  return (
    <div className="mx-1 mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-100">
      <p className="text-xs font-semibold tracking-wide text-emerald-700/80">작업 중인 상품</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="truncate font-semibold" title={product}>
          {product}
        </span>
        <button type="button" onClick={() => setProduct("")} aria-label="작업 상품 비우기" className="shrink-0 text-emerald-700/60 hover:text-emerald-900">
          ✕
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-white px-3 py-5 md:flex">
      <Link href="/" className="mb-5 px-3">
        <Logo />
      </Link>
      <WorkingProduct />
      <nav className="flex flex-col gap-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.title && <p className="px-3 pb-1 text-xs font-semibold tracking-widest text-stone-500">{group.title}</p>}
            {group.items.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <AppLink
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-emerald-50 font-semibold text-emerald-700" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </AppLink>
              );
            })}
          </div>
        ))}
      </nav>
      <p className="mt-auto px-3 pt-4 text-xs leading-relaxed text-stone-500">데이터는 이 브라우저에만 저장됩니다. 설정에서 백업하세요.</p>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2 md:hidden">
      <Link href="/" className="mr-1 shrink-0" aria-label={`${BRAND} 홈`}>
        <LogoMark size={28} />
      </Link>
      {NAV.map((item) => (
        <AppLink
          key={item.href}
          href={item.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${isActive(item.href, pathname) ? "bg-emerald-50 font-semibold text-emerald-700" : "text-stone-600"}`}
        >
          {item.icon} {item.short}
        </AppLink>
      ))}
    </nav>
  );
}
