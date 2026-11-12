import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { createSubject, deleteSubject, isGrade, subjectsFor, updateSubject } from "@/lib/server/learn";

const Group = z.enum(["korean", "english", "math", "social", "science"]).nullable().optional();

/** 학습 과정에 과목 추가 (예: 중2 '역사', 고2 '수학Ⅰ') */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, z.object({ grade: z.string(), name: z.string().max(20), short: z.string().max(2).optional(), group: Group }));
    if (body instanceof Response) return body;
    if (!isGrade(body.grade)) return adminError(400, "학년을 골라 주세요.");
    const r = createSubject(body.grade, body);
    return r.problem ? adminError(400, r.problem) : ok({ subject: r.subject, subjects: subjectsFor(body.grade, true) });
  });
}

export async function PUT(request: Request) {
  return admin(async () => {
    const body = await readBody(request, z.object({ grade: z.string(), key: z.string(), name: z.string().max(20).optional(), short: z.string().max(2).optional(), group: Group }));
    if (body instanceof Response) return body;
    if (!isGrade(body.grade)) return adminError(400, "학년을 골라 주세요.");
    const r = updateSubject(body.grade, body.key, body);
    return r.problem ? adminError(400, r.problem) : ok({ subject: r.subject });
  });
}

/** 추가한 과목을 지우면 그 과목의 섹션·유닛도 지워진다 */
export async function DELETE(request: Request) {
  return admin(() => {
    const p = new URL(request.url).searchParams;
    const grade = p.get("grade");
    if (!isGrade(grade)) return adminError(400, "학년을 골라 주세요.");
    return deleteSubject(grade, p.get("key") ?? "") ? ok() : adminError(400, "기본 과목은 지울 수 없어요.");
  });
}
