import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN_URL, adminLogin, imagesLoaded, startFresh } from "./helpers";

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

  // 학생 화면으로 미리 풀기: 같은 화면을 휴대폰 크기로 띄우고, 기록은 남기지 않는다
  await page.getByRole("button", { name: "▶ 학생 화면으로 풀어 보기" }).click();
  const preview = page.getByRole("dialog", { name: "학생 화면 미리 풀기" });
  await expect(preview.getByRole("heading", { name: "수직선" })).toBeVisible();
  await expect(preview.locator(".md img")).toHaveCount(1);
  // 테마를 바꿔 볼 수 있다
  await preview.getByRole("radio", { name: "귀여운 · 밝게" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "cute");
  await preview.getByRole("button", { name: "확인했다" }).or(preview.getByRole("button", { name: "알겠어요" })).click();
  // 객관식 → 주관식(틀린 문제는 끝에 한 번 더 나오므로 끝날 때까지 푼다)
  for (let i = 0; i < 6 && !(await preview.getByRole("heading", { name: /유닛 완료/ }).isVisible()); i++) {
    const answer = preview.getByLabel("답", { exact: true });
    if (await answer.isVisible()) await answer.fill("2");
    else await preview.getByRole("radiogroup", { name: "보기" }).getByRole("radio").first().click();
    await preview.getByRole("button", { name: "확인", exact: true }).click();
    await preview.getByRole("button", { name: "계속" }).click();
  }
  await expect(preview.getByRole("heading", { name: /유닛 완료/ })).toBeVisible();
  await expect(preview.getByText("미리 풀기라 진도·경험치는 기록되지 않아요.")).toBeVisible();
  await preview.getByRole("button", { name: "처음부터 다시 풀기" }).click();
  await expect(preview.getByRole("heading", { name: "수직선" })).toBeVisible();
  await preview.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(preview).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-style", "noir");

  // 초안이라 학생 학습 지도에는 아직 없다
  await page.goto("/learn");
  await page.getByRole("radio", { name: /중1/ }).click();
  await page.getByRole("button", { name: "중1 수학 유닛 3개" }).click();
  await expect(page.getByRole("heading", { name: "정수와 유리수" })).toBeVisible();
  await expect(page.getByText("수직선과 정수")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("관리 도구 일괄 넣기: 다른 AI가 자주 내는 실수(그림 속 큰따옴표, \\( \\) 수식)를 고쳐 읽고, 깨진 그림 유닛은 이유와 함께 건너뛴다", async ({ page }) => {
  const errors = await startFresh(page);
  await adminLogin(page);
  await page.goto(`${ADMIN_URL}/admin/learn/import`);
  const input = page.getByLabel(/JSON 붙여 넣기/);

  // 고칠 수 없는 JSON: 깨진 위치를 알려준다
  await input.fill('{\n "grade": "m1",\n "units": [ { "title": "a" "steps": [] } ]\n}');
  await page.getByRole("button", { name: "검사하기" }).click();
  const jsonError = page.getByRole("alert").filter({ hasText: "JSON 형식" });
  await expect(jsonError).toContainText("3번째 줄");
  await expect(jsonError).toContainText("⟪여기⟫");

  await input.fill(readFileSync("src/test/fixtures/import-agent-sample.txt", "utf8"));
  await page.getByRole("button", { name: "검사하기" }).click();
  await expect(page.getByText("넣을 수 있음 1개 · 이미 있음 0개 · 문제 있음 1개")).toBeVisible();
  await expect(page.getByText(/그림\(SVG\)을 쓸 수 없어요: <\/svg> 로 끝나지 않아요/)).toBeVisible();
  await page.getByRole("button", { name: "유닛 1개 넣기" }).click();
  await page.getByRole("link", { name: "거듭제곱 알아보기" }).click();

  // \( \) 수식이 $ 수식으로 바뀌어 학생 화면에서 수식으로 보인다
  await page.getByRole("button", { name: "▶ 학생 화면으로 풀어 보기" }).click();
  const preview = page.getByRole("dialog", { name: "학생 화면 미리 풀기" });
  await expect(preview.locator(".katex").first()).toBeVisible();
  await expect(preview.getByText(String.raw`\(`)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("관리 도구 학습 과정: 교육과정 대표 단원으로 섹션 채우기 전에 기준과 목록을 보고, 교육과정 과목을 하나 고른다", async ({ page }) => {
  const errors = await startFresh(page);
  await adminLogin(page);
  await page.goto(`${ADMIN_URL}/admin/learn`);
  await expect(page.getByRole("heading", { name: /소인수분해/ })).toBeVisible();
  await page.getByLabel("학년").selectOption("h1");
  await page.getByLabel("과목").selectOption("math");
  await expect(page.getByText(/코스 기준: 고등학교 1학년 · 2022 개정 교육과정/)).toBeVisible();

  await page.getByRole("button", { name: "교육과정 대표 단원으로 섹션 채우기…" }).click();
  const panel = page.getByRole("region", { name: "교육과정 대표 단원으로 섹션 채우기" });
  await expect(panel).toContainText("출판사 교과서의 목차가 아니라 교육과정의 대표 단원");
  // 고1 수학은 교육과정 과목이 둘이라 하나를 고른다 (예전에는 둘을 섞어서 넣었다)
  await expect(panel.getByRole("button", { name: "교육과정 과목을 골라 주세요" })).toBeDisabled();
  await panel.getByRole("radio", { name: "공통수학1" }).click();
  await expect(panel.getByText("기준: 2022 개정 교육과정 · 공통수학1 대표 단원")).toBeVisible();
  await expect(panel.getByRole("list", { name: "만들어질 섹션" })).toContainText("다항식의 연산");
  await panel.getByRole("button", { name: /섹션 \d+개 만들기/ }).click();
  await expect(page.getByText(/섹션 \d+개를 만들었어요 \(2022 개정 교육과정 · 공통수학1 대표 단원\)/)).toBeVisible();
  // 만든 섹션에 기준이 남는다
  await expect(page.getByRole("heading", { name: /^다항식의 연산/ })).toContainText("공통수학1 대표 단원");

  expect(errors).toEqual([]);
});
