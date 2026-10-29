import Link from "next/link";
import type { ComponentProps } from "react";

/** (main)과 루트 레이아웃이 다른 경로 — 클라이언트 이동 시 Turbopack이 상대 레이아웃 CSS를 못 찾는다 */
const OTHER_ROOT_LAYOUTS = ["/detail-page"];

const isOtherRootLayout = (href: string) =>
  OTHER_ROOT_LAYOUTS.some((prefix) => href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`));

type AppLinkProps = ComponentProps<"a"> & { href: string };

/** 같은 루트 레이아웃이면 Link, 다른 루트 레이아웃이면 일반 a 태그(전체 페이지 이동) */
export function AppLink(props: AppLinkProps) {
  return isOtherRootLayout(props.href) ? <a {...props} /> : <Link {...props} />;
}
