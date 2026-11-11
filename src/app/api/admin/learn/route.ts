import { admin, adminError, ok } from "@/lib/server/admin-api";
import { courseOutline, isGrade, isSubject, listCourses } from "@/lib/server/learn";

/** 코스 목록과 (학년·과목을 주면) 그 코스의 섹션·유닛 (초안 포함) */
export async function GET(request: Request) {
  return admin(() => {
    const p = new URL(request.url).searchParams;
    const grade = p.get("grade");
    const subject = p.get("subject");
    if (!grade && !subject) return ok({ courses: listCourses(true) });
    if (!isGrade(grade) || !isSubject(subject)) return adminError(400, "학년과 과목을 골라 주세요.");
    return ok({ courses: listCourses(true), outline: courseOutline(grade, subject, true) });
  });
}
