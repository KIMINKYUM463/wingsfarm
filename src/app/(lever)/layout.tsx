import type { Metadata } from 'next';
import '@/assets/styles/index.css';
import { pretendard, materialSymbols } from '@/assets/fonts/fonts';
import { DialogProvider } from '@/shared/ui/Dialog';
import { LoadingProvider } from '@/shared/ui/Loading';
import Providers from '@/shared/providers/Providers';
import { BRAND } from '@/lib/brand';

/**
 * 상세페이지 제작(레버페이지) 전용 루트 레이아웃
 *
 * 레버페이지 전역 CSS(h1·p·button·회색 변수 등)가 윙스팜AI 화면에 섞이지 않도록
 * 별도 루트 레이아웃으로 분리한다. 루트 레이아웃이 다르면 이동 시 전체 새로고침된다.
 */
export const metadata: Metadata = {
  title: { default: `상세페이지 제작 · ${BRAND}`, template: `%s · 상세페이지 제작 · ${BRAND}` },
};

export default function LeverRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${materialSymbols.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers>
          {children}
          <DialogProvider />
          <LoadingProvider />
        </Providers>
      </body>
    </html>
  );
}
