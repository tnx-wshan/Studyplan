import { expect, test } from "@playwright/test";
import { ADMIN_URL, adminLogin, startFresh } from "./helpers";

test("교과 단원으로 자료 만들기: 출판사 구분 없이 교과서 단원 → 학년·과목·단원으로 분류", async ({ page }) => {
  const errors = await startFresh(page, "중1");
  await page.goto("/ai/create");
  await page.getByRole("radio", { name: /교과 단원/ }).click();
  await page.getByRole("radio", { name: "수학" }).click();

  // 중1 수학은 교육과정 과목이 하나라서 다시 고르지 않는다
  await expect(page.getByLabel(/교육과정 과목/)).toHaveCount(0);
  // 출판사·연도는 고르지 않는다 (평소 공부는 통합 과정)
  await expect(page.getByLabel("교과서 출판사")).toHaveCount(0);
  await page.getByLabel("교과서 단원").fill("Ⅰ. 소인수분해 - 1. 소수와 합성수");
  await expect(page.getByLabel("자료 분류")).toContainText(/^🏷️ 중1 · 수학 · Ⅰ\. 소인수분해 - 1\. 소수와 합성수$/);
  await page.getByRole("button", { name: /자료 정리하기/ }).click();
  await expect(page.getByText("📄 이차방정식의 풀이")).toBeVisible({ timeout: 15_000 });

  // 모두의 자료실에도 같은 분류로 보인다
  await page.goto("/ai/library");
  await expect(page.getByRole("button", { name: /중1 · 수학 · Ⅰ\. 소인수분해/ })).toBeVisible();

  // 관리 도구: 분류를 본다 (출판사 거르기는 없다)
  await adminLogin(page);
  await page.goto(`${ADMIN_URL}/admin/content`);
  await expect(page.getByLabel("출판사")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: /중1 · 수학 · Ⅰ\. 소인수분해 - 1\. 소수와 합성수/ })).toBeVisible();

  expect(errors).toEqual([]);
});
