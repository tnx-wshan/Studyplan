import type { Metadata, Viewport } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import { themeInitScript } from "@/components/ThemeSync";
import "./globals.css";

const display = Jua({ variable: "--font-display", weight: "400", subsets: ["latin"], preload: false });
const body = Noto_Sans_KR({ variable: "--font-body", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "홈스터디",
  description: "펫과 함께 성장하는 중·고등학생 자기주도 학습 앱",
  applicationName: "홈스터디",
  appleWebApp: { capable: true, title: "홈스터디", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8ef" },
    { media: "(prefers-color-scheme: dark)", color: "#17151f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
