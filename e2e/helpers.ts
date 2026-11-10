import { expect, type Page } from "@playwright/test";

/** 로그인하고 첫 실행 설정을 마친다 (누아르 테마 기준 문구) */
export async function startFresh(page: Page, grade = "고1") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  await expect(page.getByRole("tab", { name: "주간" })).toBeVisible();
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
