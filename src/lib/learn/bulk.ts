import { FILE_KEY, numberedTitle, readImportText } from "./import";

/**
 * 대량 JSON 파일 일괄 넣기 (관리 도구 /admin/learn/import).
 * 파일을 브라우저에서 읽어 코스로 펼친 뒤, 서버 요청 하나가 너무 커지지 않게 묶음으로 나눠 차례로 보낸다.
 * 서버는 묶음마다 검사·넣기를 하므로(넣기는 묶음마다 한 번에, 실패하면 그 묶음만 되돌림),
 * 묶음 사이의 이름 겹침과 새 섹션 표시는 여기서 결과를 합치며 맞춘다.
 */

export type Course = Record<string, unknown>;

export interface BulkFile {
  name: string;
  size: number;
  courses: Course[];
  units: number;
  error?: string;
}

/** 서버 검사·넣기 결과 한 줄 (src/lib/server/learn-import.ts의 ImportRow와 같은 모양) */
export interface ImportRow {
  where: string;
  grade: string;
  subject: string;
  section: string;
  title: string;
  status: "ok" | "duplicate" | "error";
  problems: string[];
  steps: number;
  questions: number;
  figures: number;
  newSection: boolean;
  unitId?: string;
  renamedFrom?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  problems: string[];
  applied: boolean;
  added: number;
  sectionsAdded: number;
}

const unitCount = (c: Course) => (Array.isArray(c.units) ? c.units.length : 0);

/** 파일들을 읽어 코스로 펼친다. 코스마다 파일 이름을 붙여 결과 표에서 어느 파일인지 보이게 한다 */
export async function readBulkFiles(files: { name: string; size: number; text(): Promise<string> }[]): Promise<BulkFile[]> {
  return Promise.all(
    files.map(async (f) => {
      const parsed = readImportText(await f.text());
      if (parsed.error) return { name: f.name, size: f.size, courses: [], units: 0, error: parsed.error };
      const list = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map((c) => ({ ...((c ?? {}) as Course), [FILE_KEY]: f.name }));
      return { name: f.name, size: f.size, courses: list, units: list.reduce((n, c) => n + unitCount(c), 0) };
    }),
  );
}

/**
 * 코스들을 서버에 보낼 묶음으로 나눈다: 묶음 하나는 글자 수 maxChars, 유닛 maxUnits 이하.
 * 유닛이 아주 많은 코스는 같은 학년·과목·섹션 정보를 가진 여러 코스로 쪼갠다.
 */
export function packBatches(courses: Course[], maxChars = 2_000_000, maxUnits = 150): Course[][] {
  const pieces: Course[] = [];
  for (const c of courses) {
    const units = Array.isArray(c.units) ? c.units : null;
    if (!units || units.length <= maxUnits) {
      pieces.push(c);
      continue;
    }
    for (let i = 0; i < units.length; i += maxUnits) pieces.push({ ...c, units: units.slice(i, i + maxUnits) });
  }
  const batches: Course[][] = [];
  let cur: Course[] = [];
  let chars = 0;
  let count = 0;
  for (const p of pieces) {
    const size = JSON.stringify(p).length;
    const n = unitCount(p);
    if (cur.length && (chars + size > maxChars || count + n > maxUnits)) {
      batches.push(cur);
      cur = [];
      chars = 0;
      count = 0;
    }
    cur.push(p);
    chars += size;
    count += n;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/**
 * 묶음별 결과를 하나로 합친다. 검사 결과는 묶음마다 따로 나왔으므로
 * 앞 묶음과 같은 섹션·같은 이름이면 '이미 있음'(숫자 붙이기를 골랐으면 다음 숫자)으로, 앞 묶음이 만들 섹션은 '새 섹션' 표시를 뗀다.
 * 넣기 결과는 서버가 앞 묶음을 이미 넣은 뒤에 처리했으므로 그대로 합친다.
 */
export function mergeResults(parts: ImportResult[], renameDuplicates: boolean): ImportResult {
  const applied = parts.some((p) => p.applied);
  const titles = new Map<string, Set<string>>();
  const sections = new Set<string>();
  const rows: ImportRow[] = [];
  for (const part of parts) {
    // 같은 묶음 안의 이름은 서버가 이미 맞췄으므로, 앞 묶음들의 이름과만 비교한다
    const before = new Map([...titles].map(([k, v]) => [k, new Set(v)]));
    for (const raw of part.rows) {
      let row = raw;
      const key = `${row.grade}|${row.subject}|${row.section}`;
      if (!applied && row.status === "ok") {
        const prev = before.get(key);
        if (prev?.has(row.title)) {
          if (renameDuplicates) {
            const original = row.renamedFrom ?? row.title;
            const title = numberedTitle(original, new Set([...prev, ...(titles.get(key) ?? [])]));
            row = { ...row, title, renamedFrom: original, problems: [...row.problems.filter((p) => !p.startsWith("같은 이름이 있어서")), `같은 이름이 있어서 '${title}'(으)로 바꿔 넣어요.`] };
          } else {
            row = { ...row, status: "duplicate", problems: [...row.problems, "앞 파일에 같은 섹션·같은 이름의 유닛이 있어서 건너뛰어요."] };
          }
        }
        if (row.newSection && sections.has(key)) row = { ...row, newSection: false };
      }
      if (row.status === "ok") {
        if (!titles.has(key)) titles.set(key, new Set());
        titles.get(key)!.add(row.title);
        sections.add(key);
      }
      rows.push(row);
    }
  }
  return {
    rows,
    problems: parts.flatMap((p) => p.problems),
    applied,
    added: parts.reduce((n, p) => n + p.added, 0),
    sectionsAdded: parts.reduce((n, p) => n + p.sectionsAdded, 0),
  };
}
