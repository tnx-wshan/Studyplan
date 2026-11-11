import { admin, ok } from "@/lib/server/admin-api";
import { unitCourseMap } from "@/lib/server/learn";
import { listUsers } from "@/lib/server/users";

/** 사용자 목록. 끝낸 유닛 수를 코스별로 센다 */
export async function GET() {
  return admin(() => {
    const units = unitCourseMap();
    return ok({
      users: listUsers().map((u) => {
        const perCourse: Record<string, number> = {};
        for (const id of u.snapshot.learnDone ?? []) {
          const info = units.get(id);
          if (info) perCourse[`${info.grade}:${info.subject}`] = (perCourse[`${info.grade}:${info.subject}`] ?? 0) + 1;
        }
        return { ...u, learnByCourse: perCourse };
      }),
    });
  });
}
