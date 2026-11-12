import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CHARACTERS } from "@/data/characters";

/**
 * 캐릭터 그림 목록: public/characters/<id>/ 에 들어 있는 파일 이름.
 * 그림을 넣기만 하면 화면이 저절로 그 그림을 쓰도록, 서버가 파일이 있는지 알려준다.
 */
export async function GET() {
  const result: Record<string, string[]> = {};
  for (const c of CHARACTERS) {
    try {
      const files = await readdir(path.join(process.cwd(), "public", "characters", c.id));
      result[c.id] = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    } catch {
      result[c.id] = [];
    }
  }
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
