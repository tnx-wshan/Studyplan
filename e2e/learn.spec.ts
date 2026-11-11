import { expect, test } from "@playwright/test";
import { noHorizontalScroll, startFresh } from "./helpers";

test("학습 탭: 코스 고르기 → 핵심 정리와 다섯 가지 문제 → 틀린 문제 다시 → 완료와 하루 목표", async ({ page }) => {
  const errors = await startFresh(page);

  await page.getByRole("navigation").getByRole("link", { name: "학습", exact: true }).click();
  await expect(page.getByText("과정을 고른다.")).toBeVisible();
  // 고1은 아직 유닛이 없어 준비 중, 중1 수학에 예제 유닛 3개
  await expect(page.getByRole("button", { name: "고1 수학 준비 중" })).toBeDisabled();
  await page.getByRole("radio", { name: /중1/ }).click();
  await page.getByRole("button", { name: "중1 수학 유닛 3개" }).click();

  // 학습 지도: 섹션(목차)과 유닛 길
  await expect(page.getByRole("heading", { name: "소인수분해" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "일차방정식" })).toBeVisible();
  await expect(page.getByLabel("거듭제곱과 소인수분해 (잠김: 앞 유닛을 먼저 끝내세요)")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "소수와 합성수 (지금 할 유닛)" }).click();

  // 1. 핵심 정리
  await expect(page.getByRole("heading", { name: "소수와 합성수" })).toBeVisible();
  await page.getByRole("button", { name: "확인했다" }).click();

  // 2. 객관식
  const check = page.getByRole("button", { name: "확인", exact: true });
  await expect(check).toBeDisabled();
  await page.getByRole("radio", { name: "17", exact: true }).click();
  await check.click();
  await expect(page.getByText("정확하다.")).toBeVisible();
  await page.getByRole("button", { name: "계속" }).click();

  // 3. 빈칸 채우기: 낱말 상자에서 순서대로 고르고, 잘못 넣은 칸은 눌러서 뺀다
  await page.getByRole("button", { name: "약수", exact: true }).click();
  await page.getByRole("button", { name: "빈칸 1: 약수" }).click();
  await page.getByRole("button", { name: "소수", exact: true }).click();
  await page.getByRole("button", { name: "합성수", exact: true }).click();
  await check.click();
  await expect(page.getByText("정확하다.")).toBeVisible();
  await page.getByRole("button", { name: "계속" }).click();

  // 4. 주관식 + 수식 도구: 일부러 틀린다
  await expect(page.getByRole("group", { name: "수식 기호" })).toBeVisible();
  await page.getByLabel("답", { exact: true }).fill("7");
  await page.getByRole("button", { name: "제곱", exact: true }).click();
  await expect(page.getByLabel("답", { exact: true })).toHaveValue("7²");
  await expect(page.getByLabel("수식 미리 보기").locator(".katex")).toBeVisible();
  await check.click();
  await expect(page.getByText("틀렸다.")).toBeVisible();
  await expect(page.getByText("정답:")).toBeVisible();
  await page.getByRole("button", { name: "계속" }).click();

  // 5. 낱말 퍼즐
  await page.getByRole("button", { name: "합", exact: true }).click();
  await page.getByRole("button", { name: "약", exact: true }).click();
  await page.getByRole("button", { name: "⌫ 한 글자 지우기" }).click();
  await page.getByRole("button", { name: "성", exact: true }).click();
  await page.getByRole("button", { name: "수", exact: true }).click();
  await check.click();
  await expect(page.getByText("정확하다.")).toBeVisible();
  await page.getByRole("button", { name: "계속" }).click();

  // 6. 객관식
  await page.getByRole("radio", { name: "소수도 합성수도 아니다" }).click();
  await check.click();
  await page.getByRole("button", { name: "계속" }).click();

  // 틀린 문제를 끝에 한 번 더
  await expect(page.getByText("다시 확인한다.")).toBeVisible();
  await page.getByLabel("답", { exact: true }).fill("8개");
  await page.keyboard.press("Enter");
  await expect(page.getByText("정확하다.")).toBeVisible();
  await page.getByRole("button", { name: "계속" }).click();

  // 완료: 처음에 맞힌 4문제 → 10 + 4×2 = 18 경험치
  await expect(page.getByRole("heading", { name: "유닛 완료." })).toBeVisible();
  await expect(page.getByText("+18")).toBeVisible();
  await expect(page.getByText("80%")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "오늘 학습 목표" })).toBeVisible();
  await noHorizontalScroll(page);

  // 다음 유닛이 열리고, 학습 지도에 완료로 표시된다
  await page.getByRole("link", { name: "학습 지도로" }).click();
  await expect(page.getByRole("link", { name: "소수와 합성수 (완료)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "거듭제곱과 소인수분해 (지금 할 유닛)" })).toBeVisible();
  await expect(page.getByText("1/3 유닛")).toBeVisible();

  // 그만두기: 확인 창에서 취소하면 그대로, 그만두면 학습 지도로
  await page.getByRole("link", { name: "거듭제곱과 소인수분해 (지금 할 유닛)" }).click();
  await page.getByRole("button", { name: "학습 그만하기" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "그만하기" }).click();
  await expect(page).toHaveURL(/\/learn$/);

  // 홈에도 하루 학습 목표 카드
  await page.getByRole("navigation").getByRole("link", { name: /홈/ }).click();
  await expect(page.getByText("오늘의 학습 5분")).toBeVisible();
  await expect(page.getByRole("link", { name: "이어서 하기" })).toBeVisible();

  expect(errors).toEqual([]);
});
