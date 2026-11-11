import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
/** 관리 도구 서버 (같은 빌드, ADMIN_SERVER=1) */
const ADMIN_PORT = 3211;

const env = {
  AI_PROVIDER: "mock",
  AI_LIMIT_TUTOR: "3",
  APP_PASSWORD: "e2e-pass",
  SESSION_SECRET: "e2e-secret",
  ADMIN_PASSWORD: "e2e-admin",
  // 테스트마다 빈 서버 DB에서 시작한다 (앱 서버가 시작할 때 지운다)
  HOMESTUDY_DB_NAME: "e2e.db",
};

/**
 * 브라우저 전체 흐름 테스트. 빌드한 앱을 가짜 AI로 띄워서 검사한다.
 *   npm run build && npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
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
  webServer: [
    {
      command: `rm -f .data/e2e.db .data/e2e.db-wal .data/e2e.db-shm && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env,
    },
    {
      command: `npx next start -p ${ADMIN_PORT}`,
      url: `http://localhost:${ADMIN_PORT}/admin/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...env, ADMIN_SERVER: "1" },
    },
  ],
});
