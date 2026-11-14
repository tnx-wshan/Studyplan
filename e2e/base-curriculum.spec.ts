import { expect, test } from "@playwright/test";
import { ADMIN_URL, adminLogin, answerDialog, startFresh } from "./helpers";

test("학기별 기본 단원: 학습 지도에 학기·중단원, 고2 선택과목, 지시문에 목차, 빠진 섹션 다시 채우기", async ({ page }) => {
  const errors = await startFresh(page, "중1");

  // 학생: 중1 수학 학습 지도의 섹션 밑에 학기와 중단원이 보인다
  await page.getByRole("button", { name: "중1 수학 유닛 3개" }).click();
  await expect(page.getByRole("heading", { name: "소인수분해" })).toBeVisible();
  await expect(page.getByText("1학기 · 수학 1 · 중단원: 소인수분해 / 최대공약수와 최소공배수")).toBeVisible();

  await adminLogin(page);
  await page.goto(`${ADMIN_URL}/admin/learn`);
  await expect(page.getByRole("heading", { name: /소인수분해/ })).toBeVisible();
  await expect(page.getByText("2학기 · 수학 1 · 중단원: 점·선·면·각, 위치 관계, 평행선 / 작도와 합동")).toBeVisible();

  // 고2: 선택과목(대수 …)이 과목으로 들어 있다
  await page.getByRole("combobox", { name: "학년", exact: true }).selectOption("h2");
  const subject = page.getByRole("combobox", { name: "과목", exact: true });
  await expect(subject.locator("option", { hasText: "대수 (유닛 0) · 추가한 과목" })).toHaveCount(1);
  await subject.selectOption({ label: "대수 (유닛 0) · 추가한 과목" });
  await expect(page.getByRole("heading", { name: /수열/ })).toBeVisible();

  // 섹션 하나를 지우고 기본 단원으로 다시 채운다
  await page.getByRole("button", { name: "수열 지우기" }).click();
  await answerDialog(page);
  await expect(page.getByRole("heading", { name: /수열/ })).toHaveCount(0);
  await page.getByRole("button", { name: "학기별 기본 단원으로 섹션 채우기…" }).click();
  const panel = page.getByRole("region", { name: "학기별 기본 단원으로 섹션 채우기" });
  await expect(panel.getByRole("list", { name: "기본 단원 섹션" })).toContainText("지수함수와 로그함수 (이미 있음)");
  await panel.getByRole("button", { name: "섹션 1개 만들기" }).click();
  await expect(page.getByText("섹션 1개를 만들었어요 (학기별 기본 단원).")).toBeVisible();
  await expect(page.getByRole("heading", { name: /수열/ })).toBeVisible();

  // 일괄 넣기 지시문에 섹션의 학기·중단원이 들어간다
  await page.goto(`${ADMIN_URL}/admin/learn/import`);
  await page.getByRole("combobox", { name: "학년", exact: true }).selectOption("h1");
  await page.getByRole("combobox", { name: "섹션", exact: true }).selectOption("다항식");
  await expect(page.getByLabel("AI 에이전트용 지시문")).toHaveValue(/이 섹션의 목차: 1학기 · 공통수학 1 · 중단원: 다항식의 연산 \/ 항등식과 나머지정리 \/ 인수분해/);

  expect(errors).toEqual([]);
});
