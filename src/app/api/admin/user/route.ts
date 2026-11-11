import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { unitCourseMap } from "@/lib/server/learn";
import { deleteUser, getUser, updateUser } from "@/lib/server/users";

export async function GET(request: Request) {
  return admin(() => {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const user = getUser(id);
    if (!user) return adminError(404, "사용자를 찾을 수 없어요.");
    const units = unitCourseMap();
    const done = (user.snapshot.learnDone ?? []).map((unitId) => ({ unitId, ...(units.get(unitId) ?? { title: "(지워진 유닛)", section: "", grade: "", subject: "" }) }));
    return ok({ user, done });
  });
}

const PatchSchema = z.object({ id: z.string(), status: z.enum(["active", "suspended"]).optional(), memo: z.string().max(1000).optional() });

export async function PATCH(request: Request) {
  return admin(async () => {
    const body = await readBody(request, PatchSchema);
    if (body instanceof Response) return body;
    const user = updateUser(body.id, body);
    return user ? ok({ user }) : adminError(404, "사용자를 찾을 수 없어요.");
  });
}

/** 목록에서 지운다 (기기 데이터는 지워지지 않고, 다음에 접속하면 다시 나타난다) */
export async function DELETE(request: Request) {
  return admin(() => {
    deleteUser(new URL(request.url).searchParams.get("id") ?? "");
    return ok();
  });
}
