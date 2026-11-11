import { rmSync } from "node:fs";
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
  HOMESTUDY_DB_NAME: "e2e.db",
};

// 테스트마다 빈 서버 DB에서 시작한다 (Windows에서도 되도록 셸 명령 대신 Node로 지운다).
// 이 설정 파일은 테스트 작업 프로세스에서도 다시 읽히므로, 서버를 띄우는 처음 프로세스에서만 지운다.
if (!process.env.TEST_WORKER_INDEX) for (const f of ["e2e.db", "e2e.db-wal", "e2e.db-shm"]) rmSync(`.data/${f}`, { force: true });

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
      command: `npx next start -p ${PORT}`,
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
