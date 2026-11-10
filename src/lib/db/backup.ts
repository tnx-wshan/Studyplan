import { getDB } from "./index";
import { defaultCourseIds, type GradeId, type SubjectGroup } from "@/data/curriculum";

const BACKUP_VERSION = 2;
const BLOB_KEY = "__blob";

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 기기에만 저장되므로 백업 파일로 내보내고 불러올 수 있게 한다. 사진도 함께 담는다. */
export async function exportBackup(): Promise<string> {
  const db = getDB();
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    tables[table.name] = await Promise.all(
      rows.map(async (r) => {
        if (r && typeof r === "object" && "blob" in r && r.blob instanceof Blob) {
          const { blob, ...rest } = r as { blob: Blob } & Record<string, unknown>;
          return { ...rest, [BLOB_KEY]: { type: blob.type, data: await blobToBase64(blob) } };
        }
        return r;
      }),
    );
  }
  return JSON.stringify({ app: "homestudy", version: BACKUP_VERSION, schema: db.verno, exportedAt: Date.now(), tables });
}

type Row = Record<string, unknown>;

/**
 * 예전 버전에서 만든 백업도 지금 구조에 맞게 채운다.
 * (DB 업그레이드는 기기 안의 데이터에만 적용되고, 불러온 백업에는 적용되지 않기 때문)
 */
export function normalizeRow(table: string, row: Row, grade?: GradeId): Row | null {
  const blob = row[BLOB_KEY] as { type: string; data: string } | undefined;
  if (blob) {
    const { [BLOB_KEY]: _omit, ...rest } = row;
    void _omit;
    row = { ...rest, blob: base64ToBlob(blob.data, blob.type) };
  }
  switch (table) {
    case "images":
      // 사진 데이터가 없는(1판 백업) 항목은 버린다
      return row.blob instanceof Blob ? row : null;
    case "subjects":
      return {
        ...row,
        courseIds: Array.isArray(row.courseIds) ? row.courseIds : grade ? defaultCourseIds(grade, row.group as SubjectGroup) : [],
        customUnits: Array.isArray(row.customUnits) ? row.customUnits : [],
        color: row.color === "#f2a93b" ? "#d4881c" : row.color,
      };
    case "tasks":
      return { ...row, kind: row.kind ?? "custom" };
    case "wrongAnswers":
      return { ...row, streak: row.streak ?? 0, mastered: row.mastered ?? false, retries: Array.isArray(row.retries) ? row.retries : [] };
    case "quizzes":
      return { ...row, attempts: Array.isArray(row.attempts) ? row.attempts : [], difficulty: row.difficulty ?? "normal", verified: row.verified ?? false, madeBy: row.madeBy ?? "AI" };
    case "questions":
      return { ...row, choices: Array.isArray(row.choices) ? row.choices : [], concept: row.concept ?? "", order: row.order ?? 0 };
    case "materials":
      return { ...row, summary: row.summary ?? "", keyPoints: Array.isArray(row.keyPoints) ? row.keyPoints : [], sources: Array.isArray(row.sources) ? row.sources : [] };
    case "methodLogs":
      return { ...row, fields: row.fields ?? {} };
    default:
      return row;
  }
}

export async function importBackup(json: string) {
  let data: { app?: string; tables?: Record<string, Row[]> };
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("백업 파일을 읽을 수 없어요.");
  }
  if (data?.app !== "homestudy" || typeof data.tables !== "object" || !data.tables) {
    throw new Error("홈스터디 백업 파일이 아니에요.");
  }
  const tables = data.tables;
  const grade = (tables.profile?.[0]?.grade as GradeId | undefined) ?? undefined;
  const db = getDB();
  // 사진 변환 등은 트랜잭션 밖에서 먼저 끝낸다
  const prepared = new Map<string, Row[]>();
  for (const table of db.tables) {
    const rows = tables[table.name];
    if (!Array.isArray(rows)) continue;
    prepared.set(table.name, rows.map((r) => normalizeRow(table.name, r, grade)).filter((r): r is Row => !!r));
  }
  // 사진이 사라진 항목이 깨진 사진을 가리키지 않게 정리
  const imageIds = new Set((prepared.get("images") ?? []).map((r) => r.id));
  for (const name of ["wrongAnswers", "tutorMessages"]) {
    const rows = prepared.get(name);
    if (!rows) continue;
    prepared.set(
      name,
      rows.map((r) => ({
        ...r,
        ...(typeof r.imageId === "string" && !imageIds.has(r.imageId) ? { imageId: undefined } : {}),
        ...(Array.isArray(r.imageIds) ? { imageIds: (r.imageIds as string[]).filter((id) => imageIds.has(id)) } : {}),
      })),
    );
  }
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      const rows = prepared.get(table.name);
      if (!rows) continue;
      await table.clear();
      await table.bulkPut(rows);
    }
  });
}
