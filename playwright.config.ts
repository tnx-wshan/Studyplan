import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * 브라우저 전체 흐름 테스트. 빌드한 앱을 가짜 AI로 띄워서 검사한다.
 *   npm run build && npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // 알려진 문제: 로그인 직후 가끔 화면이 멈추는 현상이 있어(PLAN.md 참고) 고칠 때까지 한 번 재시도한다
  retries: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    ...devices["iPhone 13"],
    // 설치된 Chromium으로 휴대폰 화면 크기를 흉내 낸다
    browserName: "chromium",
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      AI_PROVIDER: "mock",
      AI_LIMIT_TUTOR: "3",
      APP_PASSWORD: "e2e-pass",
      SESSION_SECRET: "e2e-secret",
    },
  },
});
