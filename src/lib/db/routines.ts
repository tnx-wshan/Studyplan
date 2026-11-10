import { getDB, newId } from "./index";
import type { Routine, Task } from "./types";
import { addDays, parseDateKey, toDateKey } from "@/lib/date";

const now = () => Date.now();

/** 앞으로 며칠 치 할 일을 미리 만들어 둘지 */
export const ROUTINE_HORIZON = 7;

/** from~to(포함) 사이에서 루틴 요일에 해당하는 날짜들 */
export function routineDates(days: number[], from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (days.includes(parseDateKey(d).getDay())) out.push(d);
  return out;
}

export type RoutineInput = Pick<Routine, "title" | "subjectId" | "minutes" | "days" | "time">;

/**
 * 루틴 할 일 만들기: 오늘부터 일주일 치를 채운다.
 * 이미 만든 날짜(generatedThrough)까지는 다시 만들지 않으므로, 학생이 지운 할 일이 되살아나지 않는다.
 */
export async function generateRoutineTasks(today = toDateKey()): Promise<number> {
  const db = getDB();
  const until = addDays(today, ROUTINE_HORIZON - 1);
  let created = 0;
  await db.transaction("rw", db.routines, db.tasks, async () => {
    for (const r of await db.routines.toArray()) {
      if (!r.active) continue;
      const from = r.generatedThrough && r.generatedThrough >= today ? addDays(r.generatedThrough, 1) : today;
      if (from > until) continue;
      const t = now();
      const tasks: Task[] = routineDates(r.days, from, until).map((date) => ({
        id: newId(),
        date,
        title: r.title,
        subjectId: r.subjectId,
        kind: "custom",
        estimatedMinutes: r.minutes,
        done: false,
        // 시각이 있으면 그 순서대로 위쪽에 오도록
        order: r.time ? Number(r.time.replace(":", "")) / 10000 : 50,
        routineId: r.id,
        time: r.time,
        createdAt: t,
        updatedAt: t,
      }));
      await db.tasks.bulkAdd(tasks);
      await db.routines.update(r.id, { generatedThrough: until, updatedAt: t });
      created += tasks.length;
    }
  });
  return created;
}

/** 오늘 이후의 끝내지 않은 루틴 할 일을 지운다 (루틴을 고치거나 끌 때) */
async function clearUpcoming(routineId: string, today: string) {
  const db = getDB();
  const upcoming = await db.tasks.where("routineId").equals(routineId).filter((t) => !t.done && t.date >= today).toArray();
  await db.tasks.bulkDelete(upcoming.map((t) => t.id));
}

export async function addRoutine(input: RoutineInput, today = toDateKey()) {
  const t = now();
  const routine: Routine = { id: newId(), ...input, title: input.title.trim(), active: true, createdAt: t, updatedAt: t };
  await getDB().routines.add(routine);
  await generateRoutineTasks(today);
  return routine;
}

/** 루틴을 고치면 앞으로의 할 일을 새 내용으로 다시 만든다 */
export async function updateRoutine(id: string, patch: Partial<RoutineInput & { active: boolean }>, today = toDateKey()) {
  const db = getDB();
  await clearUpcoming(id, today);
  await db.routines.update(id, { ...patch, ...(patch.title ? { title: patch.title.trim() } : {}), generatedThrough: undefined, updatedAt: now() });
  await generateRoutineTasks(today);
}

export async function deleteRoutine(id: string, today = toDateKey()) {
  await clearUpcoming(id, today);
  await getDB().routines.delete(id);
}

/** 알림에 쓸 루틴 목록 (켜져 있고 시각이 있는 것) */
export async function routinesForReminders() {
  return (await getDB().routines.toArray())
    .filter((r) => r.active && r.time && r.days.length > 0)
    .map((r) => ({ id: r.id, title: r.title.slice(0, 40), time: r.time!, days: r.days, minutes: r.minutes }));
}
