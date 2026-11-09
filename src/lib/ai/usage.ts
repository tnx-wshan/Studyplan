import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 하루 AI 사용량 제한 (서버에서 센다).
 * 지금은 개인용이라 프로젝트의 .data 폴더에 파일로 저장한다.
 * 나중에 배포하면 서버 DB(Supabase 등)로 옮겨야 한다.
 */
export type AiFeature = "tutor" | "quiz" | "material" | "coach";

export const DAILY_LIMITS: Record<AiFeature, number> = {
  tutor: Number(process.env.AI_LIMIT_TUTOR) || 30,
  quiz: Number(process.env.AI_LIMIT_QUIZ) || 10,
  material: Number(process.env.AI_LIMIT_MATERIAL) || 10,
  coach: Number(process.env.AI_LIMIT_COACH) || 10,
};

export const FEATURE_LABELS: Record<AiFeature, string> = { tutor: "튜터 질문", quiz: "문제 만들기", material: "자료 정리", coach: "코칭·피드백" };

type Store = { date: string; counts: Partial<Record<AiFeature, number>> };


/** 한국 시간 기준 오늘 날짜 */
export function seoulDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

let memory: Store | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(today: string): Promise<Store> {
  if (!memory) {
    try {
      // 경로를 코드에 고정해야 빌드가 프로젝트 전체를 서버 코드에 넣지 않는다
      memory = JSON.parse(await readFile(path.join(process.cwd(), ".data", "ai-usage.json"), "utf8")) as Store;
    } catch {
      memory = { date: today, counts: {} };
    }
  }
  if (memory.date !== today) memory = { date: today, counts: {} };
  return memory;
}

async function save(store: Store) {
  try {
    await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
    await writeFile(path.join(process.cwd(), ".data", "ai-usage.json.tmp"), JSON.stringify(store));
    await rename(path.join(process.cwd(), ".data", "ai-usage.json.tmp"), path.join(process.cwd(), ".data", "ai-usage.json"));
  } catch {
    // 파일을 못 쓰는 환경이면 메모리로만 센다
  }
}

/** 동시에 들어온 요청도 순서대로 처리한다 */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export function getUsage(now = new Date()) {
  return serial(async () => {
    const store = await load(seoulDate(now));
    return (Object.keys(DAILY_LIMITS) as AiFeature[]).map((f) => ({
      feature: f,
      label: FEATURE_LABELS[f],
      used: store.counts[f] ?? 0,
      limit: DAILY_LIMITS[f],
    }));
  });
}

/** 한 번 쓸 수 있으면 사용량을 올리고 true, 다 썼으면 false */
export function consume(feature: AiFeature, now = new Date()): Promise<boolean> {
  return serial(async () => {
    const store = await load(seoulDate(now));
    const used = store.counts[feature] ?? 0;
    if (used >= DAILY_LIMITS[feature]) return false;
    store.counts[feature] = used + 1;
    await save(store);
    return true;
  });
}

/** AI 호출이 실패하면 사용량을 돌려준다 */
export function refund(feature: AiFeature, now = new Date()): Promise<void> {
  return serial(async () => {
    const store = await load(seoulDate(now));
    store.counts[feature] = Math.max(0, (store.counts[feature] ?? 0) - 1);
    await save(store);
  });
}

/** 테스트용 */
export function resetUsageMemory() {
  memory = null;
}
