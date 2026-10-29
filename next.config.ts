import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy가 요청 본문을 이 크기까지만 버퍼링하고 나머지는 조용히 잘라낸다 (사진 data URL 요청 대비)
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
