import type { Metadata } from 'next';

// 프로덕션 URL은 Vercel 환경변수에서 NEXT_PUBLIC_SITE_URL로 설정
// 개발 환경은 localhost 사용
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return 'http://localhost:3000';
};

export const SITE_METADATA = {
  SITE_TITLE: 'leverpage',
  SITE_DESCRIPTION: 'AI 기반 상품 상세 페이지 에디터',
  COPY_RIGHT: '© 2025 Sellfarm. All rights reserved.',
  GITHUB_URL: 'https://github.com/sellfarmb2b/leverpage',
  VERCEL_DEPLOY_URL: getBaseUrl(),
  AUTHOR: 'Sellfarm',
  SITE_NAME: 'leverpage',
  DESCRIPTION: 'AI 기반 상품 상세 페이지 에디터',
};

export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_METADATA.VERCEL_DEPLOY_URL),
  description: SITE_METADATA.DESCRIPTION,
  keywords: [
    'leverpage',
    '상품 상세 페이지',
    '페이지 빌더',
    'Figma',
    'Konva',
    '에디터',
    'Page Editor',
    'AI 텍스트 생성',
    'AI 이미지 생성',
    '상세 페이지 제작',
    'Sellfarm',
    'E-commerce',
    'Product Page',
    'Canvas Editor',
  ],
  authors: [{ name: SITE_METADATA.AUTHOR }],
  openGraph: {
    title: 'leverpage - 상품 상세 페이지 에디터',
    description: SITE_METADATA.DESCRIPTION,
    url: SITE_METADATA.VERCEL_DEPLOY_URL,
    siteName: SITE_METADATA.SITE_NAME,
    locale: 'ko_KR',
    type: 'website',
    // opengraph-image.png는 app/ 디렉토리에 있어 자동 인식됨
  },
  twitter: {
    card: 'summary_large_image',
    title: 'leverpage - 상품 상세 페이지 에디터',
    description: SITE_METADATA.DESCRIPTION,
    // twitter-image.png는 app/ 디렉토리에 있어 자동 인식됨 (opengraph-image 공유)
  },
  // favicon.ico, apple-icon.png는 app/ 디렉토리에 있어 자동 인식됨
};
