import { expect, test } from "@playwright/test";
import { answerDialog, dismissRankUp, rewindTimer, seedPast, startFresh } from "./helpers";

test("성장: 레벨 10 보상(보호권·두 번째 캐릭터·은빛 테두리) → 캐릭터 고르기 → 학습 지도 꾸미기", async ({ page }) => {
  const errors = await startFresh(page);

  // 처음엔 누아르의 대표 캐릭터 '렌', 레벨 0
  await page.goto("/profile");
  await expect(page.getByText("렌 · 견습 기록관")).toBeVisible();
  await expect(page.getByText("RANK 0")).toBeVisible();
  await expect(page.getByText("0 / 10,000 XP")).toBeVisible();

  // 레벨 10 바로 앞(324,900 XP)에서 10분 집중(100 XP) → 레벨 10
  await seedPast(page, [], { totalXp: 324_900, rewardedLevel: 9 });
  await page.goto("/timer");
  await page.getByRole("radio", { name: /자유 측정/ }).click();
  await page.getByRole("button", { name: "▶ 집중 시작" }).click();
  await rewindTimer(page, 10);
  await page.getByRole("button", { name: /끝내고 기록/ }).click();
  await answerDialog(page);
  await expect(page.getByText("RANK UP")).toBeVisible();
  const rewards = page.getByRole("list", { name: "레벨업 보상" });
  await expect(rewards).toContainText("코인 +500");
  await expect(rewards).toContainText("연속 기록 보호권 +1");
  await expect(rewards).toContainText("다른 대표 캐릭터를 고를 수 있어요");
  await expect(rewards).toContainText("은빛 프로필 테두리");
  await dismissRankUp(page);

  // 프로필: 성장 단계 칭호, 은빛 테두리, 보호권 한도 3
  await page.goto("/profile");
  await expect(page.getByText("렌 · 정식 기록관")).toBeVisible();
  await expect(page.locator(".card-frame-silver")).toHaveCount(1);
  await expect(page.getByText("🛡️ 1/3")).toBeVisible();

  // 두 번째 캐릭터(귀여운 테마의 모아)를 고를 수 있다
  await page.goto("/companion");
  const pick = page.getByRole("radiogroup", { name: "대표 캐릭터" });
  await expect(pick.getByRole("radio", { name: /모아/ })).toBeEnabled();
  await pick.getByRole("radio", { name: /모아/ }).click();
  await expect(pick.getByRole("radio", { name: /모아/ })).toHaveAttribute("aria-checked", "true");

  // 학습 지도 꾸미기: 레벨 5의 '등불 길'은 열리고, 15의 '황동 길'은 아직
  const skins = page.getByRole("radiogroup", { name: "학습 지도 꾸미기" });
  await expect(skins.getByRole("radio", { name: /황동 길/ })).toBeDisabled();
  await skins.getByRole("radio", { name: /등불 길/ }).click();
  await expect(skins.getByRole("radio", { name: /등불 길/ })).toHaveAttribute("aria-checked", "true");

  await page.goto("/profile");
  await expect(page.getByText("모아 · 별빛 마법사")).toBeVisible();

  // 학습 첫 화면: 고른 지도 꾸미기가 길에 보인다
  await page.goto("/");
  await page.getByRole("radio", { name: /중1/ }).click();
  await page.getByRole("button", { name: "중1 수학 유닛 3개" }).click();
  await expect(page.locator(".map-skin-lantern").first()).toBeVisible();

  expect(errors).toEqual([]);
});
