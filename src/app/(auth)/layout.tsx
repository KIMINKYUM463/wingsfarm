import type { Metadata } from "next";
import "../(main)/globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `로그인 · ${BRAND}`,
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-[#07140f] text-white">{children}</body>
    </html>
  );
}
