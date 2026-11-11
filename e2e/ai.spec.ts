import { expect, test } from "@playwright/test";
import { TINY_PNG, imagesLoaded, noHorizontalScroll, startFresh } from "./helpers";

test("AI 튜터(힌트·풀이·하루 한도)와 사진으로 문제 만들기 → 퀴즈 → 오답노트·카드", async ({ page }) => {
  const errors = await startFresh(page);

  await page.getByRole("navigation").getByRole("link", { name: /AI 학습실/ }).click();
  await expect(page.getByText("테스트용 가짜 AI")).toBeVisible();

  // 튜터: 사진 첨부 + 힌트 모드
  await page.getByRole("link", { name: /튜터에게 질문/ }).click();
  await page.locator("input[type=file]").setInputFiles(TINY_PNG);
  await expect(page.getByAltText("첨부 사진 1")).toBeVisible();
  const input = page.getByRole("textbox", { name: "질문" });
  await input.fill("x^2-5x+6=0 어떻게 풀어요?");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("두 일차식의 곱").first()).toBeVisible();
  await expect(page).toHaveURL(/tutor\?id=/);
  await expect(page.locator(".katex").first()).toBeVisible();
  // 답이 끝까지 나온 뒤에 다음 질문을 보낸다
  await expect(page.getByText(/오늘 2번 더/)).toBeVisible();

  // 풀이 모드로 바꿔 질문
  await page.getByRole("radio", { name: /풀이 모드/ }).click();
  await input.fill("풀이 보여줘");
  await page.keyboard.press("Enter");
  await expect(page.getByText("정답:").first()).toBeVisible();
  await expect(page.getByText(/오늘 1번 더/)).toBeVisible();

  // 세 번째 질문 뒤에는 한도(3회)에 걸려 보내기가 막힌다
  await input.fill("하나 더");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText(/오늘 질문을 모두 썼어요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "보내기" })).toBeDisabled();

  // 사진으로 자료 정리 → 문제 만들기
  await page.goto("/ai/create");
  await page.getByRole("radio", { name: "수학" }).click();
  await page.locator("input[type=file][accept='image/*']").setInputFiles(TINY_PNG);
  await page.getByRole("button", { name: /자료 정리하기/ }).click();
  await expect(page.getByText("📄 이차방정식의 풀이")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("radio", { name: "3문제" }).click();
  await page.getByRole("button", { name: "서술형" }).click();
  await page.getByRole("button", { name: /✨ 문제 만들기/ }).click();
  await expect(page).toHaveURL(/ai\/quiz\?id=/, { timeout: 15_000 });
  await expect(page.getByText("정답 검산 완료")).toBeVisible();
  // AI가 그린 그림(SVG)이 있는 문제: 서버에 저장된 그림이 문제 아래에 보인다
  await expect(page.getByRole("img", { name: "문제 그림" })).toBeVisible();
  await imagesLoaded(page);

  // 퀴즈: 객관식 정답 → 단답형 오답 → 서술형 자기 채점
  await page.getByRole("button", { name: /^② 5$/ }).click();
  await expect(page.getByText("⭕ 정답!")).toBeVisible();
  await page.getByRole("button", { name: "🃏 카드로" }).click();
  await page.getByRole("button", { name: "다음 문제 →" }).click();
  await page.getByLabel("답", { exact: true }).fill("4");
  await page.getByRole("button", { name: "제출" }).click();
  await expect(page.getByText("❌ 아쉬워요")).toBeVisible();
  await page.getByRole("button", { name: "📝 오답노트에" }).click();
  await page.getByRole("button", { name: "다음 문제 →" }).click();
  await page.getByLabel("서술형 답").fill("인수분해해서 곱이 0이 되는 성질을 쓴다");
  await page.getByRole("button", { name: "모범 답안과 비교하기" }).click();
  await page.getByRole("button", { name: /잘 썼어요/ }).click();
  await page.getByRole("button", { name: "결과 보기" }).click();
  await expect(page.getByText("2 / 3")).toBeVisible();

  // 오답노트와 카드 묶음에 들어갔는지
  await page.goto("/review/wrong");
  await expect(page.getByText(/양수인 근을 쓰시오/)).toBeVisible();
  await page.goto("/review/cards");
  await expect(page.getByText("AI 퀴즈 · 수학")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});
