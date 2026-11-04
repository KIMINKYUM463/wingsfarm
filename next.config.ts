import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 레버페이지 에디터가 쓰는 React Compiler (자동 메모이제이션)
  reactCompiler: true,
  // 네이티브 바이너리는 번들하지 않고 node_modules에서 그대로 불러온다 (ffmpeg 경로 계산·canvas 네이티브 바인딩)
  serverExternalPackages: ["ffmpeg-static", "@napi-rs/canvas"],
  // 실행 파일·자막 글꼴은 코드에서 import되지 않아 자동으로 배포 묶음에 안 들어가므로 직접 포함시킨다 (Vercel 움직이는 컷)
  // 자막은 drawtext 대신 @napi-rs/canvas로 PNG를 그려 overlay — 글꼴 파일이 배포에 있어야 한다
  outputFileTracingIncludes: {
    "/api/lever/**": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/ffmpeg.exe",
      "./assets/fonts/Pretendard-Bold.otf",
    ],
  },
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
