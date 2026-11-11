import { z } from "zod";
import { readImportText } from "@/lib/learn/import";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { importUnits } from "@/lib/server/learn-import";

const Body = z.object({
  /** 붙여 넣은 글 또는 파일 내용 (JSON) */
  text: z.string().min(1).max(15_000_000),
  /** false면 검사만 한다 */
  apply: z.boolean(),
  /** 넣으면서 바로 공개 (기본: 초안) */
  publish: z.boolean().optional(),
});

/** 학습 유닛 일괄 넣기: 먼저 검사(apply: false)로 결과를 보고, 넣기(apply: true)를 한다 */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Body);
    if (body instanceof Response) return body;
    const parsed = readImportText(body.text);
    if (parsed.error) return adminError(400, parsed.error);
    return ok(importUnits(parsed.data, { apply: body.apply, status: body.publish ? "published" : "draft" }));
  });
}
