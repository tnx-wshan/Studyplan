import { expect, test } from "@playwright/test";
import { answerDialog, daysAgo, noHorizontalScroll, rewindTimer, startFresh } from "./helpers";

test("동료의 기록: 레벨이 오르면 새 기록이 열리고 읽을 수 있다", async ({ page }) => {
  const errors = await startFresh(page);
  // 처음에는 모두 잠겨 있다
  await page.goto("/companion/records");
  await expect(page.getByText("0 / 15")).toBeVisible();
  await expect(page.getByText("RANK 2에서 열림")).toBeVisible();

  // 2시간 집중 → RANK 2
  await page.goto("/timer");
  await page.getByRole("radio", { name: /자유 측정/ }).click();
  await page.getByRole("button", { name: "▶ 집중 시작" }).click();
  await expect(page.getByText("집중하는 중")).toBeVisible();
  await rewindTimer(page, 120);
  await page.getByRole("button", { name: /끝내고 기록/ }).click();
  await answerDialog(page);
  await expect(page.getByText("RANK UP")).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole("link", { name: /새 기록이 열렸다 — 「봉인이 풀린 날」/ }).click();

  await expect(page).toHaveURL(/companion\/records/);
  await expect(page.getByText("NEW")).toBeVisible();
  await page.getByRole("button", { name: /봉인이 풀린 날/ }).click();
  await expect(page.getByRole("heading", { name: "봉인이 풀린 날" })).toBeVisible();
  await expect(page.getByText(/종이 넘기는 소리/)).toBeVisible();
  // 동료 종류(덩굴)에 따른 문단
  await expect(page.getByText(/덩굴은 벽을 부수지 않는다/)).toBeVisible();
  await page.getByRole("button", { name: "‹ 목록으로" }).click();
  await expect(page.getByText("NEW")).toHaveCount(0);
  await expect(page.getByText("1 / 15")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("고정 루틴: 만들면 플래너에 매주 들어간다", async ({ page }) => {
  const errors = await startFresh(page);
  await page.goto("/planner/routines");
  await page.getByRole("button", { name: "+ 루틴" }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByPlaceholder("예: 수학 문제집 3쪽").fill("영단어 20개");
  await sheet.getByRole("button", { name: "매일" }).click();
  await sheet.getByRole("button", { name: "루틴 만들기" }).click();
  await expect(page.getByText("루틴을 만들었어요. 플래너에 넣었어요!")).toBeVisible();
  await expect(page.getByText("매일 · 30분")).toBeVisible();

  await page.goto("/planner");
  await expect(page.getByText("영단어 20개")).toBeVisible();
  await expect(page.getByText("🔁 루틴").first()).toBeVisible();
  await expect(page.getByText("20:00").first()).toBeVisible();
  // 이번 주 남은 날에도 들어가 있다
  await page.getByRole("button", { name: "다음 주" }).click();
  await page.getByRole("button", { name: /할 일 1개/ }).first().click();
  await expect(page.getByText("영단어 20개")).toBeVisible();

  // 끄면 앞으로의 할 일이 빠진다
  await page.goto("/planner/routines");
  await page.getByRole("switch", { name: /영단어 20개/ }).click();
  await expect(page.getByText(/루틴을 쉬어요/)).toBeVisible();
  await page.goto("/planner");
  await expect(page.getByText("영단어 20개")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("기억 지도: 공부한 단원의 기억 상태와 복습 예보", async ({ page }) => {
  const errors = await startFresh(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: "+ 할 일" }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByRole("radio", { name: "수학" }).click();
  await sheet.locator("select").selectOption("인수분해");
  await sheet.getByRole("button", { name: "추가하기" }).click();
  await page.getByRole("checkbox", { name: /인수분해 완료/ }).click();
  await expect(page.getByText("복습 일정도 만들었어요")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText(/내일 복습 1개 예정/)).toBeVisible();
  await page.getByRole("link", { name: /기억 지도/ }).click();
  await expect(page.getByText(/카드 0 · 오답 0 · 간격 복습 1/)).toBeVisible(); // 예보: 내일
  const unit = page.getByRole("button", { name: /인수분해/ });
  await expect(unit).toContainText("100%");
  await expect(unit).toContainText("선명");
  await unit.click();
  await page.getByRole("button", { name: /오늘 복습 할 일로 넣기/ }).click();
  await expect(page.getByText("오늘 할 일에 복습을 넣었어요")).toBeVisible();

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("시험 결과: 끝난 시험의 점수를 기록하면 성적 그래프에 나온다", async ({ page }) => {
  const errors = await startFresh(page);
  const yesterday = await daysAgo(page, 1);
  // 어제 끝난 시험을 넣는다 (목표 점수 포함)
  await page.evaluate(
    (date) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("homestudy");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["subjects", "exams"], "readwrite");
          const all = tx.objectStore("subjects").getAll();
          all.onsuccess = () => {
            const math = all.result.find((s: { group: string }) => s.group === "math");
            const eng = all.result.find((s: { group: string }) => s.group === "english");
            tx.objectStore("exams").put({
              id: "exam-e2e",
              title: "중간고사",
              date,
              ranges: [
                { subjectId: math.id, units: [] },
                { subjectId: eng.id, units: [] },
              ],
              minutesPerDay: 60,
              restDays: [],
              goals: { [math.id]: 80 },
              createdAt: 1,
              updatedAt: 1,
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    yesterday,
  );

  await page.goto("/planner");
  await page.getByRole("link", { name: /중간고사 수고했어요/ }).click();
  await expect(page.getByText("시험 끝")).toBeVisible();
  await expect(page.getByText("목표 80")).toBeVisible();
  await page.getByLabel("수학 점수").fill("86");
  await page.getByLabel("영어 점수").fill("74");
  await page.getByLabel("다음 시험에서 바꿀 한 가지 🔧").fill("오답을 그때그때 다시 풀기");
  await page.getByRole("button", { name: /결과 저장/ }).click();
  await expect(page.getByText("시험 결과 기록 완료! +30 XP")).toBeVisible();
  await expect(page.getByText("목표를 모두 이뤘어요! 🎉")).toBeVisible();
  await expect(page.getByText("+6", { exact: true })).toBeVisible();

  await page.goto("/growth/exams");
  await expect(page.getByRole("img", { name: "과목별 시험 점수 변화 그래프" })).toBeVisible();
  await page.getByText("표로 보기").click();
  await expect(page.getByRole("cell", { name: "86 / 80" })).toBeVisible();
  // 기록한 뒤에는 플래너의 안내가 사라진다
  await page.goto("/planner");
  await expect(page.getByRole("link", { name: /중간고사 수고했어요/ })).toHaveCount(0);

  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test("고치기: 할 일과 오답 내용을 나중에 바꿀 수 있다", async ({ page }) => {
  const errors = await startFresh(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: "+ 할 일" }).click();
  await page.locator("dialog[open] input").first().fill("수학 익힘책");
  await page.locator("dialog[open]").getByRole("button", { name: "추가하기" }).click();
  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("button", { name: "고치기" }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByLabel("할 일").fill("수학 익힘책 40~45쪽");
  await sheet.getByLabel("예상 시간(분)").fill("50");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("수학 익힘책 40~45쪽")).toBeVisible();
  await expect(page.getByText("약 50분").first()).toBeVisible();

  await page.goto("/review/wrong/new");
  await page.locator("textarea").fill("1+1은?");
  await page.getByLabel("정답").fill("3");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("1+1은?").click();
  await page.getByRole("button", { name: "고치기" }).click();
  await page.locator("dialog[open]").getByLabel("정답").fill("2");
  await page.locator("dialog[open]").getByRole("button", { name: "저장" }).click();
  await expect(page.locator("main b", { hasText: /^2$/ })).toBeVisible();

  // 지우기 확인 창: 취소하면 남고, 확인하면 지워진다
  await page.goto("/planner");
  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("button", { name: "삭제" }).click();
  await answerDialog(page, false);
  await expect(page.getByText("수학 익힘책 40~45쪽")).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).click();
  await answerDialog(page);
  await expect(page.getByText("수학 익힘책 40~45쪽")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("시험 고치기와 하루 새 카드 수", async ({ page }) => {
  const errors = await startFresh(page);
  await page.getByRole("navigation").getByRole("link", { name: /플래너/ }).click();
  await page.getByRole("link", { name: "+ 시험 계획" }).click();
  await page.getByRole("button", { name: "기말고사" }).click();
  await page.getByRole("button", { name: /수학/ }).first().click();
  await page.getByRole("button", { name: "모두 선택" }).click();
  await page.getByRole("button", { name: "계획 만들기" }).click();
  await expect(page.getByText("D-14").first()).toBeVisible();

  await page.getByRole("button", { name: /시험 고치기/ }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByLabel("시험 이름").fill("수학 기말");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("heading", { name: "수학 기말" })).toBeVisible();
  await page.getByRole("button", { name: /시험 고치기/ }).click();
  await sheet.getByRole("button", { name: "6시간" }).or(sheet.getByRole("button", { name: "4시간" })).click();
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText(/다시 짰어요/)).toBeVisible();

  // 새 카드 상한: 5장으로 줄이면 8장 중 5장만 복습에 나온다
  await page.goto("/settings");
  await page.getByLabel("하루에 새로 배우는 카드").selectOption("5");
  await page.goto("/review/cards");
  await page.getByRole("button", { name: "+ 새 묶음" }).click();
  await page.locator("dialog[open] input").fill("영어 단어");
  await page.locator("dialog[open]").getByRole("button", { name: "만들기" }).click();
  await page.getByText("영어 단어").click();
  await page.getByRole("button", { name: "여러 장 한 번에" }).click();
  await page.locator("dialog[open] textarea").fill(Array.from({ length: 8 }, (_, i) => `word${i} - 뜻${i}`).join("\n"));
  await page.locator("dialog[open]").getByRole("button", { name: "8장 추가하기" }).click();
  await expect(page.getByRole("link", { name: /복습하기 \(5장\)/ })).toBeVisible();
  expect(errors).toEqual([]);
});
