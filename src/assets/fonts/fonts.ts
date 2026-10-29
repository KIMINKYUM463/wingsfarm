import localFont from 'next/font/local';

// Pretendard 폰트
export const pretendard = localFont({
  src: './PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Apple SD Gothic Neo',
    'Malgun Gothic',
    'sans-serif',
  ],
});

// Material Symbols 아이콘 폰트
export const materialSymbols = localFont({
  src: './MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2',
  display: 'block', // 아이콘 폰트는 block이 표준 (ligature 텍스트 노출 방지)
  weight: '100 700', // Variable font 범위
  variable: '--font-material-symbols',
  adjustFontFallback: false, // 아이콘은 fallback 불필요
});
