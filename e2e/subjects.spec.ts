import { expect, test } from "@playwright/test";
import { ADMIN_URL, adminLogin, startFresh } from "./helpers";

const UNIT = {
  grade: "h1",
  subject: "수학2",
  section: "다항함수의 미분",
  units: [
    {
      title: "미분계수의 뜻",
      steps: [
        { type: "summary", title: "미분계수", body: "미분계수는 한 점에서의 순간변화율이에요.", points: ["$f'(a)$로 써요"] },
        { type: "choice", prompt: "미분계수는 무엇을 나타낼까요?", choices: ["순간변화율", "평균", "넓이"], answer: "순간변화율", explanation: "한 점에서 얼마나 빨리 변하는지예요." },
        { type: "short", prompt: "$f(x)=x^2$일 때 $f'(1)$의 값은?", answers: ["2"], explanation: "$f'(x)=2x$", math: true },
      ],
    },
  ],
};

test("관리 도구에서 학년마다 과목(수학2, 역사)을 추가하면 일괄 넣기와 학생 과목 고르기에 나온다", async ({ page }) => {
  const errors = await startFresh(page, "고1");
  // 학생: 기본 5과목만 있다
  await expect(page.getByRole("button", { name: /^고1 수학2/ })).toHaveCount(0);

  await adminLogin(page);
  await page.goto(`${ADMIN_URL}/admin/learn`);
  await expect(page.getByRole("heading", { name: /소인수분해/ })).toBeVisible();
  await page.getByLabel("학년").selectOption("h1");

  // 수학2: 비슷한 기본 과목은 수학
  await page.getByRole("button", { name: "+ 과목" }).click();
  const form = page.getByRole("region", { name: "과목 추가" });
  await form.getByLabel("과목 이름").fill("수학2");
  await form.getByLabel(/아이콘 글자/).fill("수2");
  await form.getByLabel("비슷한 기본 과목").selectOption("math");
  await form.getByRole("button", { name: "과목 추가" }).click();
  await expect(page.getByText("과목 '수학2'을(를) 추가했어요.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "과목", exact: true })).toHaveValue(/^s-/);
  await expect(page.getByRole("combobox", { name: "과목", exact: true }).locator("option:checked")).toHaveText("수학2 (유닛 0) · 추가한 과목");

  // 역사: 비슷한 기본 과목 없음
  await page.getByRole("button", { name: "+ 과목" }).click();
  await form.getByLabel("과목 이름").fill("역사");
  await form.getByRole("button", { name: "과목 추가" }).click();
  await expect(page.getByRole("combobox", { name: "과목", exact: true }).locator("option:checked")).toHaveText("역사 (유닛 0) · 추가한 과목");
  // 같은 이름은 다시 추가하지 못한다
  await page.getByRole("button", { name: "+ 과목" }).click();
  await form.getByLabel("과목 이름").fill("역사");
  await form.getByRole("button", { name: "과목 추가" }).click();
  await expect(form.getByRole("alert")).toContainText("이미 있어요");

  // 일괄 넣기: 지시문에 추가한 과목이 보이고, 과목 이름으로 넣는다
  await page.goto(`${ADMIN_URL}/admin/learn/import`);
  await page.getByRole("combobox", { name: "학년", exact: true }).selectOption("h1");
  await expect(page.getByRole("combobox", { name: "과목", exact: true }).locator("option", { hasText: "수학2" })).toHaveCount(1);
  await page.getByRole("combobox", { name: "과목", exact: true }).selectOption({ label: "수학2" });
  const prompt = page.getByLabel("AI 에이전트용 지시문");
  await expect(prompt).toHaveValue(/고등학교 1학년 수학2 과목/);
  await expect(prompt).toHaveValue(/여러 출판사 교과서의 중단원·소단원/);
  await expect(prompt).toHaveValue(/"subject": "수학2"/);

  await page.getByLabel(/JSON 붙여 넣기/).fill(JSON.stringify(UNIT));
  await page.getByRole("button", { name: "검사하기" }).click();
  await page.getByRole("checkbox", { name: /넣으면서 바로 공개하기/ }).check();
  await page.getByRole("button", { name: "유닛 1개 넣기" }).click();
  await expect(page.getByText("바로 공개했어요.")).toBeVisible();

  // 학생: 고1에 수학2(유닛 1개)와 역사(준비 중)가 보이고, 수학2를 배운다
  await page.goto("/");
  await expect(page.getByRole("button", { name: "고1 역사 준비 중" })).toBeDisabled();
  await page.getByRole("button", { name: "고1 수학2 유닛 1개" }).click();
  await expect(page.getByRole("heading", { name: "다항함수의 미분" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코스 바꾸기 (지금: 고1 수학2)" })).toBeVisible();
  await page.getByRole("link", { name: "이어서 하기: 미분계수의 뜻" }).click();
  await expect(page.getByRole("heading", { name: "미분계수" })).toBeVisible();

  expect(errors).toEqual([]);
});
