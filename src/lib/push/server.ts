import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateVAPIDKeys, sendNotification } from "web-push";
import { dueReminders, dueRoutineReminders, reminderMessage, routineKey, routineMessage, seoulClock, type ReminderKind, type ReminderSettings, type SubscriptionState } from "./schedule";

/**
 * 푸시 알림 저장소와 발송. 개인용이라 .data/push.json 파일에 저장한다.
 * VAPID 키는 환경 변수가 없으면 처음 실행할 때 만들어 파일에 보관한다.
 */
export interface StoredSubscription extends SubscriptionState {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
}

interface Store {
  vapid?: { publicKey: string; privateKey: string };
  subscriptions: StoredSubscription[];
}

let memory: Store | null = null;
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Store> {
  if (memory) return memory;
  try {
    memory = JSON.parse(await readFile(path.join(process.cwd(), ".data", "push.json"), "utf8")) as Store;
  } catch {
    memory = { subscriptions: [] };
  }
  return memory;
}

async function save(store: Store) {
  memory = store;
  try {
    await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
    await writeFile(path.join(process.cwd(), ".data", "push.json.tmp"), JSON.stringify(store));
    await rename(path.join(process.cwd(), ".data", "push.json.tmp"), path.join(process.cwd(), ".data", "push.json"));
  } catch (e) {
    console.error("[push] save failed", e);
  }
}

async function vapid(store: Store) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (!store.vapid) {
    store.vapid = generateVAPIDKeys();
    await save(store);
  }
  return store.vapid;
}

export function getPublicKey(): Promise<string> {
  return serial(async () => (await vapid(await load())).publicKey);
}

export function upsertSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, settings: ReminderSettings) {
  return serial(async () => {
    const store = await load();
    const existing = store.subscriptions.find((s) => s.endpoint === sub.endpoint);
    if (existing) {
      existing.keys = sub.keys;
      existing.settings = settings;
    } else {
      store.subscriptions.push({ ...sub, settings, lastSent: {}, createdAt: Date.now() });
    }
    await save(store);
  });
}

export function removeSubscription(endpoint: string) {
  return serial(async () => {
    const store = await load();
    store.subscriptions = store.subscriptions.filter((s) => s.endpoint !== endpoint);
    await save(store);
  });
}

/** 오늘 공부했음을 기록 (연속 학습 알림을 보내지 않도록) */
export function markStudied(date: string) {
  return serial(async () => {
    const store = await load();
    for (const s of store.subscriptions) s.lastStudyDate = date;
    await save(store);
  });
}

async function send(store: Store, sub: StoredSubscription, payload: object): Promise<"ok" | "gone" | "error"> {
  const keys = await vapid(store);
  try {
    await sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
      vapidDetails: { subject: "https://homestudy.local", publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 60 * 60,
    });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] send failed", status ?? e);
    return "error";
  }
}

export function sendTest(endpoint: string) {
  return serial(async () => {
    const store = await load();
    const sub = store.subscriptions.find((s) => s.endpoint === endpoint);
    if (!sub) return "missing" as const;
    const noir = sub.settings.style === "noir";
    return send(store, sub, { title: "홈스터디", body: noir ? "알림 채널이 연결되었다." : "알림이 잘 도착했어요! 🎉", url: "/" });
  });
}

/** 1분마다 불러서 보낼 알림을 보낸다 */
export function runReminders(now = new Date()) {
  return serial(async () => {
    const store = await load();
    if (store.subscriptions.length === 0) return 0;
    const clock = seoulClock(now);
    let sent = 0;
    const gone = new Set<string>();
    for (const sub of store.subscriptions) {
      for (const kind of dueReminders(sub, clock) as ReminderKind[]) {
        const r = await send(store, sub, reminderMessage(kind, sub.settings.style));
        if (r === "gone") gone.add(sub.endpoint);
        if (r === "ok") sent++;
        // 실패해도 같은 날 반복해서 보내지 않도록 기록
        sub.lastSent[kind] = clock.date;
      }
      for (const routine of dueRoutineReminders(sub, clock)) {
        const r = await send(store, sub, routineMessage(routine, sub.settings.style));
        if (r === "gone") gone.add(sub.endpoint);
        if (r === "ok") sent++;
        sub.lastSent[routineKey(routine.id)] = clock.date;
      }
    }
    store.subscriptions = store.subscriptions.filter((s) => !gone.has(s.endpoint));
    await save(store);
    return sent;
  });
}

let started = false;
export function startReminderScheduler() {
  if (started) return;
  started = true;
  setInterval(() => void runReminders().catch((e) => console.error("[push] scheduler", e)), 60_000).unref?.();
}
