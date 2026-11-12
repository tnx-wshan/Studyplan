import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { answerDialog, dismissRankUp, noHorizontalScroll, rewindTimer, seedPast, startFresh } from "./helpers";

test("학습법 실습 → 습관 진단 → 리포트·회고·AI 코칭", async ({ page }) => {
  const errors = await startFresh(page, "중2");

  await page.goto("/methods");
  await page.getByRole("button", { name: /시험이 3일 남았어요/ }).click();
  await expect(page.getByText("새로 읽기보다 떠올리기와")).toBeVisible();

  // 습관 진단: 다시 읽기만 한다고 답하면 '떠올리며 공부'가 약점으로 나온다
  await page.getByRole("link", { name: "시작" }).click();
  for (let i = 0; i < 12; i++) {
    const text = await page.locator("main p.font-display.text-xl").innerText();
    let choice = "그렇다";
    if (text.includes("여러 번 다시 읽는")) choice = "매우 그렇다";
    if (text.includes("책을 덮고")) choice = "전혀 아니다";
    if (text.includes("휴대폰") || text.includes("몰아서") || text.includes("미루게")) choice = "아니다";
    await page.getByRole("radio", { name: choice, exact: true }).click();
  }
  await expect(page.getByText("떠올리며 공부를 키워 봐요!")).toBeVisible();

  // 백지 복습 + AI 피드백
  await page.goto("/methods/practice?id=blank");
  await page.getByPlaceholder("예: 이차방정식의 풀이").fill("일차함수");
  await page.getByLabel("백지 복습 내용").fill("y = ax + b, 기울기 a, y절편 b");
  await page.getByRole("button", { name: /다 썼어요/ }).click();
  await page.getByRole("button", { name: /AI에게 피드백 받기/ }).click();
  await expect(page.getByText("72점")).toBeVisible();
  await page.getByRole("button", { name: /백지 복습 완료/ }).click();
  await expect(page.getByText(/백지 복습 완료! \+150 XP/)).toBeVisible();

  // 리포트: 회고 → AI 코칭 (목록에 없는 학습법 추천은 걸러진다)
  await page.goto("/growth/report");
  await expect(page.getByText("해본 학습법")).toBeVisible();
  await page.getByRole("radio", { name: "만족도 4" }).click();
  await page.getByLabel("잘한 점 👍").fill("백지 복습을 해 봤다");
  await page.getByRole("button", { name: /회고 저장/ }).click();
  await expect(page.getByText(/회고 완료! \+200 XP/)).toBeVisible();
  await page.getByRole("button", { name: /AI 코칭 받기/ }).click();
  await expect(page.getByText("이번 주는 꾸준히 공부한 날이 많았어요")).toBeVisible();
  await expect(page.getByText("목록에 없는 추천은")).toHaveCount(0);
  await page.getByRole("radio", { name: "월간" }).click();
  await expect(page.getByText("백지 복습을 해 봤다")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("게임: 레벨업 → 업적 → 주간 보상 → 상점 → 칭호 → 테마 전환", async ({ page }) => {
  const errors = await startFresh(page, "고2");
  expect(await page.evaluate(() => document.documentElement.dataset.style)).toBe("noir");

  // 레벨 1 직전(9,000 XP)에서 10시간 집중 → 레벨업(+보상)과 업적
  await seedPast(page, [], { totalXp: 9_000 });
  await page.goto("/timer");
  await page.getByRole("radio", { name: /자유 측정/ }).click();
  await page.getByRole("button", { name: "▶ 집중 시작" }).click();
  await expect(page.getByText("집중하는 중")).toBeVisible();
  await rewindTimer(page, 601);
  await page.getByRole("button", { name: /끝내고 기록/ }).click();
  await answerDialog(page);
  await expect(page.getByText("RANK UP")).toBeVisible();
  // 레벨업 보상: 코인 (레벨 × 50)
  await expect(page.getByRole("list", { name: "레벨업 보상" })).toContainText("코인 +50");
  await dismissRankUp(page);
  await expect(page.getByText(/업적 기록: 첫 번째 장부/)).toBeVisible();

  // 주간 퀘스트(300분) 보상
  await page.goto("/profile");
  await page.getByRole("tab", { name: "주간" }).click();
  await page.getByRole("button", { name: "+1000 받기" }).first().click();
  await expect(page.getByText(/의뢰 완수 \+1000 XP/)).toBeVisible();

  // 상점에서 사서 착용
  await page.goto("/companion");
  await page.getByRole("button", { name: "🪙 40" }).click();
  await answerDialog(page);
  await expect(page.getByText("황동 후광 구매 완료!")).toBeVisible();

  // 칭호
  await page.goto("/growth/badges");
  await page.getByRole("button", { name: /첫 번째 장부/ }).click();
  await expect(page.getByText("칭호: 첫 번째 장부")).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("「첫 번째 장부」")).toBeVisible();

  // 테마 전환과 알림 설정
  await page.goto("/settings");
  await expect(page.getByText("연속 기록 지키기")).toBeVisible();
  await page.getByRole("radio", { name: /귀여운/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.style)).toBe("cute");
  await page.goto("/profile");
  await expect(page.getByText("🎀 꾸미기")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("백업: 사진까지 내보내고 다시 불러온다", async ({ page }) => {
  await startFresh(page);
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /백업 내보내기/ }).click();
  const file = await (await downloadPromise).path();
  const json = JSON.parse(readFileSync(file, "utf8"));
  expect(json.app).toBe("homestudy");
  expect(json.tables.profile[0].pet.name).toBe("에코");
  await page.locator("input[type=file][accept='application/json']").setInputFiles(file);
  await answerDialog(page);
  await expect(page.getByText("백업을 불러왔어요.")).toBeVisible();
});
