import { expect, type Page } from "@playwright/test";

/** 로그인하고 첫 실행 설정을 마친다 (누아르 테마 기준 문구) */
export async function startFresh(page: Page, grade = "고1") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`[${page.url().replace(/^https?:\/\/[^/]+/, "")}] ${e.message}`));
  page.on("dialog", (d) => d.accept());
  await page.goto("/login");
  await page.fill("input[type=password]", "e2e-pass");
  await page.click("button[type=submit]");
  await expect(page.getByRole("heading", { name: /반가워요/ })).toBeVisible();
  await page.fill("input", "공부왕");
  await page.getByRole("button", { name: grade }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.fill("input", "에코");
  await page.getByRole("button", { name: "시작하기" }).click();
  // 첫 화면은 학습: 처음에는 코스를 고르는 화면 (예전 홈 화면은 /profile)
  await expect(page.getByText("과정을 고른다.")).toBeVisible();
  return errors;
}

/** 타이머가 minutes분 전에 시작된 것처럼 만든다 */
export async function rewindTimer(page: Page, minutes: number) {
  await page.evaluate((m) => {
    const s = JSON.parse(localStorage.getItem("hs-timer")!);
    s.runningSince -= m * 60000;
    s.phaseStartedAt -= m * 60000;
    localStorage.setItem("hs-timer", JSON.stringify(s));
  }, minutes);
  await page.reload();
}

/** 레벨업 창이 뜨면 닫는다 */
export async function dismissRankUp(page: Page) {
  await expect(page.getByText("RANK UP")).toBeVisible();
  await page.waitForTimeout(600); // 등장 애니메이션
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByText("RANK UP")).toBeHidden();
}

export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

/** 1x1 PNG (사진 첨부 테스트용) */
export const TINY_PNG = {
  name: "problem.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
};

/** n일 전 날짜 (YYYY-MM-DD, 브라우저 시간대 기준) */
export function daysAgo(page: Page, n: number) {
  return page.evaluate((days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, n);
}

/** 기기 DB에 과거 공부 기록을 넣고, 필요하면 프로필 값을 바꾼다 */
export async function seedPast(page: Page, dates: string[], profilePatch: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ dates, profilePatch }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("homestudy");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["xpEvents", "profile"], "readwrite");
          dates.forEach((date, i) => tx.objectStore("xpEvents").put({ id: `seed-${date}-${i}`, at: new Date(`${date}T12:00:00`).getTime(), date, amount: 10, reason: "task" }));
          const store = tx.objectStore("profile");
          const get = store.get("me");
          get.onsuccess = () => store.put({ ...get.result, ...profilePatch });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dates, profilePatch },
  );
}

/** 앱 안의 확인 창(askConfirm/askText)에서 확인(기본) 또는 취소를 누른다 */
export async function answerDialog(page: Page, accept = true) {
  const dialog = page.locator("dialog[open]:has(p[role=alert])");
  await expect(dialog).toBeVisible();
  await (accept ? dialog.locator("button[type=submit]") : dialog.getByRole("button", { name: "취소" })).click();
  await expect(dialog).toBeHidden();
}

/** 화면의 그림이 모두 실제로 불러와졌는지 (깨진 그림이 없는지) */
export async function imagesLoaded(page: Page, selector = ".md img") {
  await expect
    .poll(() => page.locator(selector).evaluateAll((imgs) => imgs.length > 0 && imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)))
    .toBe(true);
}

/** 관리 도구 서버 주소 (playwright.config.ts의 두 번째 서버) */
export const ADMIN_URL = "http://localhost:3211";

/** 관리 도구에 로그인한다 */
export async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_URL}/admin`);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.fill("input[type=password]", "e2e-admin");
  await page.getByRole("button", { name: "들어가기" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();
}
