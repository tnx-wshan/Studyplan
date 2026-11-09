import { getDB } from "./index";

const BACKUP_VERSION = 1;

/** 기기에만 저장되므로 백업 파일로 내보내고 불러올 수 있게 한다. (Blob 데이터는 제외) */
export async function exportBackup(): Promise<string> {
  const db = getDB();
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    tables[table.name] = rows.map((r) => {
      if (r && typeof r === "object" && "blob" in r) {
        const { blob: _blob, ...rest } = r as Record<string, unknown>;
        void _blob;
        return rest;
      }
      return r;
    });
  }
  return JSON.stringify({ app: "homestudy", version: BACKUP_VERSION, exportedAt: Date.now(), tables });
}

export async function importBackup(json: string) {
  const data = JSON.parse(json);
  if (data?.app !== "homestudy" || typeof data.tables !== "object") {
    throw new Error("홈스터디 백업 파일이 아니에요.");
  }
  const db = getDB();
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      const rows = data.tables[table.name];
      if (!Array.isArray(rows)) continue;
      await table.clear();
      await table.bulkPut(rows);
    }
  });
}
