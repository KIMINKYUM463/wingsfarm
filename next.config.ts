import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 레버페이지 에디터가 쓰는 React Compiler (자동 메모이제이션)
  reactCompiler: true,
  experimental: {
    // proxy가 요청 본문을 이 크기까지만 버퍼링하고 나머지는 조용히 잘라낸다 (사진 업로드 대비)
    proxyClientMaxBodySize: "50mb",
    // 상세페이지 이미지 합성(서버 액션)용
    serverActions: { bodySizeLimit: "50mb" },
    // 루트 레이아웃이 둘((main)·(lever))이라 전역 404가 필요하다
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      // src/assets/icons 의 SVG만 React 컴포넌트로, 나머지 SVG(illustrations)는 이미지로 둔다
      "*.svg": {
        condition: { path: /src[\\/]assets[\\/]icons[\\/]/ },
        loaders: [{ loader: "@svgr/webpack", options: { expandProps: "end" } }],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
