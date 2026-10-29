import type { Metadata } from "next";
import "./globals.css";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import { ClientOnly } from "@/components/ClientOnly";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: `${BRAND_TAGLINE} — 트렌드·키워드·상품명·썸네일·마케팅·마진·CS를 한곳에서`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full bg-stone-50 text-stone-800">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
            <ClientOnly>{children}</ClientOnly>
          </main>
        </div>
      </body>
    </html>
  );
}
