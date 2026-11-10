import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching(실험 기능)은 쓰지 않는다:
  // 켜 두면 로그인 직후 앱 화면이 준비되지 않고 멈추는 문제가 있었다. 이 앱은 화면을 기기에서 그리므로 필요 없다.
  experimental: {
    // 사진·PDF를 AI에 보낼 때 프록시가 요청 본문을 자르지 않도록 (기본 10MB)
    proxyClientMaxBodySize: "20mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
