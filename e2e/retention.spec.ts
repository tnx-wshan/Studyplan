import { expect, test } from "@playwright/test";
import { daysAgo, dismissRankUp, noHorizontalScroll, rewindTimer, seedPast, startFresh } from "./helpers";

test("5분만 시작 → 더 할지 묻기, 주간 목표 정하고 달성 보상", async ({ page }) => {
  const errors = await startFresh(page);

  // 주간 목표 정하기
  await expect(page.getByText("이번 주의 서약")).toBeVisible();
  await page.getByRole("button", { name: /^2시간/ }).click();
  await expect(page.getByText(/하루 .+씩이면 달성해요/)).toBeVisible();

  // 5분만 시작
  await page.getByRole("button", { name: "5분 시작" }).click();
  await expect(page).toHaveURL(/\/timer/);
  await expect(page.getByText("집중 5분")).toBeVisible();
  await rewindTimer(page, 6);
  await expect(page.getByText("5분 완료! 오늘 기록이 남았어요 ✓")).toBeVisible();

  // 25분 더 → 목표(2시간)를 넘기도록 시간을 돌린다
  await page.getByRole("button", { name: "25분 더" }).click();
  await expect(page.getByText("집중 25분")).toBeVisible();
  await page.getByRole("button", { name: /그만하기/ }).click(); // 1분 미만이라 기록 없이 끝남
  await page.getByRole("radio", { name: /자유 측정/ }).click();
  await page.getByRole("button", { name: "▶ 집중 시작" }).click();
  await expect(page.getByText("집중하는 중")).toBeVisible();
  await rewindTimer(page, 120);
  await page.getByRole("button", { name: /끝내고 기록/ }).click();
  await expect(page.getByText(/집중 120분 기록/)).toBeVisible();
  await dismissRankUp(page); // 125 XP → RANK 2

  await page.goto("/");
  // 오늘 기록이 생겼으니 '5분 시작' 카드는 사라진다
  await expect(page.getByRole("button", { name: "5분 시작" })).toHaveCount(0);
  await page.getByRole("button", { name: /목표 달성! \+50 XP 받기/ }).click();
  await expect(page.getByText("주간 목표 달성! +50 XP")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("보호권: 하루 빠져도 연속 기록이 유지된다", async ({ page }) => {
  await startFresh(page);
  // 3일 전, 2일 전에 공부했고 어제는 빠짐. 보호권 1개 보유.
  await seedPast(page, [await daysAgo(page, 3), await daysAgo(page, 2)], { freezes: 1 });
  await page.reload();
  await expect(page.getByText(/보호권 1개 소모/)).toBeVisible();
  await expect(page.getByText(/공부 잔디 · 2일 연속/)).toBeVisible();
  await expect(page.getByText("🛡️ 0/2")).toBeVisible();
});

test("복귀 환영: 오래 쉬었다 오면 가벼운 퀘스트를 준다", async ({ page }) => {
  const errors = await startFresh(page);
  await seedPast(page, [await daysAgo(page, 6)]);
  await page.reload();
  await expect(page.getByText("5일 만의 귀환")).toBeVisible();
  await expect(page.getByText("5분의 재개")).toBeVisible();

  // 5분 집중으로 첫 복귀 퀘스트 완료
  await page.getByRole("button", { name: "5분 시작" }).click();
  await expect(page).toHaveURL(/\/timer/);
  await expect(page.getByText("집중 5분")).toBeVisible();
  await rewindTimer(page, 6);
  await expect(page.getByText("5분 완료! 오늘 기록이 남았어요 ✓")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "+30 받기" }).click();
  await expect(page.getByText("복귀 퀘스트 완료! +30 XP")).toBeVisible();
  // 공부를 시작한 뒤에도 그날은 복귀 환영이 유지된다
  await expect(page.getByText("5일 만의 귀환")).toBeVisible();
  expect(errors).toEqual([]);
});
