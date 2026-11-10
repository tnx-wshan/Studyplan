import { expect, test } from "@playwright/test";
import { startFresh } from "./helpers";

test("오프라인: 열어본 적 없는 화면도 열리고 기록이 저장된다", async ({ page, context }) => {
  await startFresh(page);

  // 서비스 워커가 주요 화면을 미리 저장할 때까지 기다린다
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const pages = names.find((n) => n.startsWith("hs-pages-"));
          if (!pages) return 0;
          return (await (await caches.open(pages)).keys()).length;
        }),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(20);
  // 화면에 필요한 스크립트 파일 저장이 끝날 시간을 준다
  await page.waitForTimeout(5000);

  await context.setOffline(true);

  // 한 번도 열지 않은 화면으로 직접 이동
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: /플래너/ })).toBeVisible();
  await page.getByRole("button", { name: "+ 할 일" }).click();
  await page.locator("dialog[open] input").first().fill("오프라인에서 추가한 할 일");
  await page.locator("dialog[open]").getByRole("button", { name: "추가하기" }).click();
  await expect(page.getByText("오프라인에서 추가한 할 일")).toBeVisible();

  // 하단 메뉴로 이동
  await page.getByRole("navigation").getByRole("link", { name: /복습/ }).click();
  await expect(page.getByRole("heading", { name: "🃏 복습" })).toBeVisible();

  await page.goto("/methods/detail?id=blank");
  await expect(page.getByText("빈 종이에 아는 것을 모두 써 보기").first()).toBeVisible();

  await context.setOffline(false);
});
