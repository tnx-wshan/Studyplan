import { expect, test } from "@playwright/test";
import { adminLogin, imagesLoaded, startFresh } from "./helpers";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" fill="#fff"/><line x1="10" y1="30" x2="190" y2="30" stroke="#222"/><text x="95" y="52" font-size="14">0</text></svg>';

const DATA = {
  grade: "m1",
  subject: "math",
  section: "정수와 유리수",
  units: [
    {
      title: "수직선과 정수",
      steps: [
        { type: "summary", title: "수직선", body: "수직선에서 0의 오른쪽은 양수, 왼쪽은 음수예요.", points: ["0은 양수도 음수도 아니다"], figure: SVG },
        { type: "choice", prompt: "0보다 작은 수는?", choices: ["$-2$", "$0$", "$3$"], answer: "$-2$", explanation: "음수는 0보다 작아요." },
        { type: "short", prompt: "$-3$보다 5 큰 수는?", answers: ["2"], explanation: "$-3 + 5 = 2$", math: true },
      ],
    },
    { title: "잘못된 유닛", steps: [{ type: "choice", prompt: "q", choices: ["가", "나"], answer: "다", explanation: "" }] },
  ],
};

test("관리 도구 일괄 넣기: 지시문 만들기 → 검사 → 넣기(초안, 그림 포함)", async ({ page }) => {
  const errors = await startFresh(page);
  await adminLogin(page);
  await page.getByRole("navigation", { name: "관리 메뉴" }).getByRole("link", { name: "학습 과정" }).click();
  await page.getByRole("link", { name: "⤓ 일괄 넣기" }).click();
  await expect(page.getByRole("heading", { name: "유닛 일괄 넣기" })).toBeVisible();

  // AI 에이전트용 지시문: 고른 섹션과 이미 있는 유닛이 들어간다
  const prompt = page.getByLabel("AI 에이전트용 지시문");
  await expect(prompt).toHaveValue(/중학교 1학년 수학 과목의 '소인수분해' 섹션/);
  await expect(prompt).toHaveValue(/겹치지 않게 해: 소수와 합성수, 거듭제곱과 소인수분해/);

  // 붙여 넣고 검사 (에이전트가 붙인 ```json 감싸기도 받는다)
  await page.getByLabel(/JSON 붙여 넣기/).fill("결과입니다\n```json\n" + JSON.stringify(DATA) + "\n```");
  await page.getByRole("button", { name: "검사하기" }).click();
  await expect(page.getByText("넣을 수 있음 1개 · 이미 있음 0개 · 문제 있음 1개")).toBeVisible();
  await expect(page.getByText(/정답 "다"이\(가\) 보기에 없어요/)).toBeVisible();

  await page.getByRole("button", { name: "유닛 1개 넣기" }).click();
  await expect(page.getByText("유닛 1개를 넣었어요.")).toBeVisible();

  // 넣은 유닛: 초안, 그림이 정리에 붙어 있다
  await page.getByRole("link", { name: "수직선과 정수" }).click();
  await expect(page.getByRole("heading", { name: "유닛 고치기" })).toBeVisible();
  await expect(page.getByText("초안", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: /핵심 정리.*에 들어간 그림/ }).getByRole("img")).toHaveCount(1);
  await imagesLoaded(page, "ul img");

  // 초안이라 학생 학습 지도에는 아직 없다
  await page.goto("/learn");
  await page.getByRole("radio", { name: /중1/ }).click();
  await page.getByRole("button", { name: "중1 수학 유닛 3개" }).click();
  await expect(page.getByRole("heading", { name: "정수와 유리수" })).toBeVisible();
  await expect(page.getByText("수직선과 정수")).toHaveCount(0);

  expect(errors).toEqual([]);
});
