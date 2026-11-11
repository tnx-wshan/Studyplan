import { expect, test } from "@playwright/test";
import { ADMIN_URL, TINY_PNG, adminLogin, answerDialog, imagesLoaded, startFresh } from "./helpers";

test("관리 도구: 다른 포트로만 열림, 자료 모음 수집·재사용·편집, AI로 유닛 만들기, 사용자 정지·값 고치기", async ({ page }) => {
  const errors = await startFresh(page);

  // 학생 서버에서는 관리 화면이 없다
  const res = await page.request.get("/admin");
  expect(res.status()).toBe(404);
  expect((await page.request.get("/api/admin/stats")).status()).toBe(404);

  // 학생이 AI 학습실에서 자료를 만들면 자료 모음에 쌓이고, 같은 요청은 AI를 다시 부르지 않는다
  await page.goto("/ai/create");
  await page.getByRole("radio", { name: /웹 검색/ }).click();
  await page.getByRole("radio", { name: "과학" }).click();
  await page.getByPlaceholder("예: 광합성과 호흡의 차이").fill("광합성 원리");
  await page.getByRole("button", { name: /자료 정리하기/ }).click();
  await expect(page.getByText("📄 광합성 원리")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/모두의 자료실에서 가져왔어요/)).toBeHidden();
  await page.reload();
  await page.getByRole("radio", { name: /웹 검색/ }).click();
  await page.getByRole("radio", { name: "과학" }).click();
  await page.getByPlaceholder("예: 광합성과 호흡의 차이").fill("광합성  원리?");
  await page.getByRole("button", { name: /자료 정리하기/ }).click();
  await expect(page.getByText(/모두의 자료실에서 가져왔어요/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /✨ 문제 만들기/ }).click();
  await expect(page).toHaveURL(/ai\/quiz\?id=/, { timeout: 15_000 });

  // 모두의 자료실: AI 없이 다른 학생이 만든 문제를 가져와 푼다
  await page.goto("/ai/library");
  await page.getByRole("button", { name: /광합성 원리/ }).click();
  await expect(page.getByText("이 자료로 만든 문제")).toBeVisible();
  await page.getByRole("button", { name: "풀어 보기" }).first().click();
  await expect(page).toHaveURL(/ai\/quiz\?id=/);

  // 관리 도구 로그인 (관리 서버 포트)
  await adminLogin(page);
  const adminNav = page.getByRole("navigation", { name: "관리 메뉴" });
  await expect(page.getByText("모인 정리")).toBeVisible();

  // 자료 고치기
  await adminNav.getByRole("link", { name: "자료 모음" }).click();
  await page.getByRole("link", { name: "광합성 원리" }).first().click();
  await page.getByLabel("제목").fill("광합성 (검토함)");
  await page.getByLabel("핵심 (한 줄에 하나)").fill("엽록체에서 일어난다\n산소가 나온다");
  // 복사한 그림을 정리 칸에 붙여넣기(Ctrl+V)
  const summary = page.getByRole("textbox", { name: /^정리 \(마크다운/ });
  await summary.evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "copied.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, TINY_PNG.buffer.toString("base64"));
  await expect(page.getByText("그림 1개를 넣었어요.")).toBeVisible();
  await expect(summary).toHaveValue(/!\[그림\]\(\/api\/media\?id=[0-9a-f-]+\)/);
  await imagesLoaded(page, "ul img");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/저장했어요/)).toBeVisible();

  // 학습 과정: 섹션을 만들고 모인 자료로 AI 유닛 초안 → 공개
  await adminNav.getByRole("link", { name: "학습 과정" }).click();
  // 기본으로 보이는 예제 코스(중1 수학)가 그려진 뒤에 고른다
  await expect(page.getByRole("heading", { name: "소인수분해" })).toBeVisible();
  await page.getByLabel("학년").selectOption("h1");
  await page.getByLabel("과목").selectOption("science");
  await page.getByRole("button", { name: "+ 섹션" }).click();
  await page.locator("dialog[open] input").fill("광합성");
  await answerDialog(page);
  await expect(page.getByRole("heading", { name: "광합성" })).toBeVisible();
  await page.getByRole("button", { name: "✨ AI로 유닛 만들기" }).click();
  await expect(page.getByRole("checkbox", { name: /광합성 \(검토함\)/ })).toBeChecked();
  await page.getByRole("button", { name: /자료 1개로 유닛 초안 만들기/ }).click();
  await expect(page.getByRole("heading", { name: "유닛 고치기" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("유닛 이름")).toHaveValue("광합성의 원리");
  // AI가 만든 잘못된 문제(정답이 보기에 없음)는 빠져 있다
  await expect(page.getByText(/단계 5개/)).toBeVisible();
  // AI가 그린 정리 그림이 들어 있고, 관리자가 그림을 더 넣을 수 있다
  await expect(page.getByRole("list", { name: /핵심 정리.*에 들어간 그림/ }).getByRole("img")).toHaveCount(1);
  await page.getByLabel(/핵심 정리.*에 넣을 그림 파일/).setInputFiles(TINY_PNG);
  await expect(page.getByText("그림 1개를 넣었어요.")).toBeVisible();
  await expect(page.getByRole("list", { name: /핵심 정리.*에 들어간 그림/ }).getByRole("img")).toHaveCount(2);
  await imagesLoaded(page, "ul img");
  await page.getByRole("button", { name: "저장하고 공개" }).click();
  await expect(page.getByText(/학생의 학습 탭에 보여요/)).toBeVisible();

  // 잘못된 단계는 저장되지 않는다
  await page.getByRole("button", { name: "+ 객관식" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("저장하지 못했어요")).toBeVisible();
  await page.getByRole("button", { name: "6번 빼기" }).click();

  // 사용자: 학생이 앱을 열 때 보낸 요약이 보인다
  await adminNav.getByRole("link", { name: "사용자" }).click();
  await page.getByRole("link", { name: "공부왕" }).first().click();
  await expect(page.getByRole("heading", { name: /공부왕/ })).toBeVisible();
  await page.getByLabel("총 경험치").fill("500");
  await page.getByRole("button", { name: /경험치 적용/ }).click();
  await expect(page.getByText("적용 대기", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "🔒 이용 정지" }).click();
  await answerDialog(page);
  await expect(page.getByRole("button", { name: "🔓 정지 풀기" })).toBeVisible();

  // 학생 화면: 정지되면 잠기고, 고친 경험치가 적용된다
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "이용이 잠시 멈췄어요" })).toBeVisible();
  await page.goto(`${ADMIN_URL}/admin/users`);
  await page.getByRole("link", { name: "공부왕" }).first().click();
  await expect(page.getByText(/적용됨/)).toBeVisible();
  await page.getByRole("button", { name: "🔓 정지 풀기" }).click();
  await expect(page.getByRole("button", { name: "🔒 이용 정지" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Lv.4")).toBeVisible();

  // 공개한 유닛이 학생의 학습 탭(고1 과학)에 나타난다
  await page.getByRole("navigation").getByRole("link", { name: "학습", exact: true }).click();
  await page.getByRole("button", { name: "고1 과학 유닛 1개" }).click();
  await expect(page.getByRole("link", { name: "광합성의 원리 (지금 할 유닛)" })).toBeVisible();
  // 학생 학습 화면: 핵심 정리에 AI 그림과 관리자가 넣은 그림이 보인다
  await page.getByRole("link", { name: "광합성의 원리 (지금 할 유닛)" }).click();
  await expect(page.locator(".md img")).toHaveCount(2);
  await imagesLoaded(page);

  expect(errors).toEqual([]);
});
