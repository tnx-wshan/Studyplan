import { expect, test } from "@playwright/test";
import { TINY_PNG, noHorizontalScroll, rewindTimer, startFresh } from "./helpers";

test("잠금: 로그인 없이는 화면과 API에 접근할 수 없다", async ({ page, request }) => {
  await page.goto("/planner");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/ai/status")).status()).toBe(401);
  await page.getByLabel("메일주소 (아이디)").fill("nobody@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("wrong1234");
  await page.click("button[type=submit]");
  await expect(page.getByText("메일주소나 비밀번호가 맞지 않아요")).toBeVisible();
});

test("플래너 → 시험 계획 → 타이머 → 카드 → 오답노트 → 퀘스트 보상", async ({ page }) => {
  const errors = await startFresh(page);

  // 단원 할 일을 끝내면 간격 복습이 생긴다
  await page.getByRole("navigation").getByRole("link", { name: /플래너/ }).click();
  await page.getByRole("button", { name: "+ 할 일" }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByRole("radio", { name: "수학" }).click();
  await sheet.locator("select").selectOption("인수분해");
  await sheet.getByRole("button", { name: "추가하기" }).click();
  await page.getByRole("checkbox", { name: /인수분해 완료/ }).click();
  await expect(page.getByText("복습 일정도 만들었어요")).toBeVisible();

  // 시험 계획
  await page.getByRole("link", { name: "+ 시험 계획" }).click();
  await page.getByRole("button", { name: "기말고사" }).click();
  await page.getByRole("button", { name: /수학/ }).first().click();
  await page.getByRole("button", { name: "모두 선택" }).click();
  await expect(page.getByText(/할 일 \d+개가 플래너에 들어가요/)).toBeVisible();
  await page.getByRole("button", { name: "계획 만들기" }).click();
  await expect(page.getByText("D-14").first()).toBeVisible();

  // 타이머: 25분이 지난 것처럼 만들면 기록되고 휴식으로 넘어간다
  await page.goto("/timer");
  await page.getByRole("radio", { name: "영어" }).click();
  await page.getByRole("button", { name: "▶ 집중 시작" }).click();
  await expect(page.getByText("집중하는 중")).toBeVisible();
  await rewindTimer(page, 26);
  await expect(page.getByText("휴식 시간")).toBeVisible();
  await page.getByRole("button", { name: "휴식 건너뛰기" }).click();

  // 카드 10장 만들어 복습
  await page.goto("/review/cards");
  await page.getByRole("button", { name: "+ 새 묶음" }).click();
  await page.locator("dialog[open] input").fill("영어 단어");
  await page.locator("dialog[open]").getByRole("button", { name: "만들기" }).click();
  await page.getByText("영어 단어").click();
  await page.getByRole("button", { name: "여러 장 한 번에" }).click();
  await page.locator("dialog[open] textarea").fill(Array.from({ length: 10 }, (_, i) => `word${i} - 뜻${i}`).join("\n"));
  await page.locator("dialog[open]").getByRole("button", { name: "10장 추가하기" }).click();
  await page.getByRole("link", { name: /복습하기 \(10장\)/ }).click();
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "정답 보기" }).first().click();
    await page.getByRole("button", { name: /알맞음/ }).click();
  }
  await expect(page.getByText("오늘 복습 끝!")).toBeVisible();

  // 사진이 있는 오답 기록
  await page.goto("/review/wrong/new");
  await page.getByRole("radio", { name: "수학" }).click();
  await page.locator("input[type=file]").setInputFiles(TINY_PNG);
  await expect(page.getByAltText("문제 사진 미리보기")).toBeVisible();
  await page.locator("textarea").fill("x² - 5x + 6 = 0 의 해를 구하시오");
  await page.getByLabel("정답").fill("x = 2, 3");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/의 해를 구하시오/)).toBeVisible();

  // 일일 퀘스트 보상
  await page.goto("/profile");
  await page.getByRole("button", { name: "+250 받기" }).click();
  await expect(page.getByText(/의뢰 완수 \+250 XP/)).toBeVisible();

  await page.goto("/growth");
  await expect(page.getByText("최근 7일 과목별")).toBeVisible();
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});
