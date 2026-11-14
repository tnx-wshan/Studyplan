import { expect, test } from "@playwright/test";
import { ADMIN_URL, E2E_PASSWORD, adminLogin, answerDialog, noHorizontalScroll, signUp, startFresh } from "./helpers";

async function logout(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await answerDialog(page);
  await expect(page).toHaveURL(/\/login/);
}

async function login(page: import("@playwright/test").Page, email: string, password = E2E_PASSWORD) {
  await page.getByLabel("메일주소 (아이디)").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.click("button[type=submit]");
}

test("회원가입 검사: 형식·약한 비밀번호·확인 불일치·중복 메일", async ({ page }) => {
  await page.goto("/login");
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.getByLabel("메일주소 (아이디)").fill("not-an-email");
  await page.getByLabel("비밀번호", { exact: true }).fill("abcd1234");
  await page.getByLabel("비밀번호 확인").fill("abcd1234");
  await page.click("button[type=submit]");
  await expect(page.getByRole("alert")).toHaveText(/메일주소 형식/);

  await page.getByLabel("메일주소 (아이디)").fill("dup@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("onlyletters");
  await page.getByLabel("비밀번호 확인").fill("onlyletters");
  await page.click("button[type=submit]");
  await expect(page.getByRole("alert")).toHaveText(/영문자와 숫자/);

  await page.getByLabel("비밀번호", { exact: true }).fill("abcd1234");
  await page.getByLabel("비밀번호 확인").fill("abcd9999");
  await page.click("button[type=submit]");
  await expect(page.getByRole("alert")).toHaveText(/확인이 달라요/);

  const email = `dup-${Date.now()}@example.com`;
  await signUp(page, email);
  await expect(page.getByRole("heading", { name: /반가워요/ })).toBeVisible();
  await page.context().clearCookies();
  await signUp(page, email);
  await expect(page.getByRole("alert")).toHaveText(/이미 가입된 메일/);
});

test("로그인 유지: 새로 고침·다시 열어도 같은 계정, 로그아웃해도 기록은 남고 다시 로그인하면 돌아온다", async ({ page }) => {
  const errors = await startFresh(page);
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/profile");
  await expect(page.getByText("공부왕").first()).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText(/@example\.com/)).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await answerDialog(page);
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/planner");
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});

test("같은 기기에서 다른 계정은 기록이 섞이지 않고, 원래 계정은 기록이 그대로 돌아온다", async ({ page }) => {
  const errors = await startFresh(page);
  const first = await page.evaluate(() => localStorage.getItem("hs-account"));
  expect(first).toBeTruthy();
  await page.goto("/settings");
  const emailText = (await page.getByText(/@example\.com/).textContent()) ?? "";
  await logout(page);

  // 두 번째 계정: 이 기기의 첫 번째 계정 기록이 보이지 않고 첫 실행 설정부터 다시 시작한다
  await signUp(page);
  await expect(page.getByRole("heading", { name: /반가워요/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("hs-account"))).not.toBe(first);
  await page.context().clearCookies();
  await page.goto("/login");
  await login(page, emailText.trim());
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/profile");
  await expect(page.getByText("공부왕").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("비밀번호 변경: 현재 비밀번호 확인, 새 비밀번호로 다시 로그인, 옛 비밀번호는 안 됨", async ({ page }) => {
  await startFresh(page);
  await page.goto("/settings");
  const email = ((await page.getByText(/@example\.com/).textContent()) ?? "").trim();
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await page.getByLabel("현재 비밀번호").fill("wrong-pass1");
  await page.getByLabel("새 비밀번호", { exact: true }).fill("brandnew99");
  await page.getByLabel("새 비밀번호 확인").fill("brandnew99");
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).last().click();
  await expect(page.getByRole("alert")).toHaveText(/현재 비밀번호가 맞지 않아요/);

  await page.getByLabel("현재 비밀번호").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).last().click();
  await expect(page.getByText(/비밀번호를 바꿨어요/)).toBeVisible();
  // 이 기기는 계속 로그인된 상태
  await page.reload();
  await expect(page).toHaveURL(/\/settings/);

  await page.getByRole("button", { name: "로그아웃" }).click();
  await answerDialog(page);
  await login(page, email, E2E_PASSWORD);
  await expect(page.getByRole("alert")).toHaveText(/맞지 않아요/);
  await login(page, email, "brandnew99");
  await expect(page).not.toHaveURL(/\/login/);
});

test("관리 도구: 메일주소가 보이고 임시 비밀번호로 로그인할 수 있다 (다른 기기 로그인은 풀림)", async ({ page, browser }) => {
  await startFresh(page);
  await page.goto("/settings");
  const email = ((await page.getByText(/@example\.com/).textContent()) ?? "").trim();
  // 동기화가 서버에 요약을 보낼 때까지 기다린다
  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  await admin.goto(`${ADMIN_URL}/admin/users`);
  await expect(admin.getByText(email)).toBeVisible({ timeout: 30_000 });
  await admin.getByRole("link", { name: "공부왕" }).first().click();
  await expect(admin.getByText(email).first()).toBeVisible();
  await admin.getByRole("button", { name: /임시 비밀번호 만들기/ }).click();
  await answerDialog(admin);
  const temp = (await admin.locator("code").textContent())!.trim();
  expect(temp.length).toBeGreaterThanOrEqual(8);

  // 다른 기기(이 브라우저)의 로그인은 풀린다
  await page.goto("/planner");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page).toHaveURL(/\/login|\/planner/);
  await page.context().clearCookies();
  await page.goto("/login");
  await login(page, email, temp);
  await expect(page).not.toHaveURL(/\/login/);
});
