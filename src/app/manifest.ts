import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "홈스터디",
    short_name: "홈스터디",
    description: "펫과 함께 성장하는 중·고등학생 자기주도 학습 앱",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    background_color: "#fff8ef",
    theme_color: "#ff8a3d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
