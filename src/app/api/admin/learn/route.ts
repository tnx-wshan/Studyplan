import { admin, adminError, ok } from "@/lib/server/admin-api";
import { courseOutline, isGrade, isSubjectFor, listCourses, subjectsFor } from "@/lib/server/learn";

/** 코스 목록과 (학년·과목을 주면) 그 코스의 섹션·유닛 (초안 포함) */
export async function GET(request: Request) {
  return admin(() => {
    const p = new URL(request.url).searchParams;
    const grade = p.get("grade");
    const subject = p.get("subject");
    if (!grade && !subject) return ok({ courses: listCourses(true) });
    // 학년만 주면 그 학년의 과목 목록
    if (isGrade(grade) && !subject) return ok({ courses: listCourses(true), subjects: subjectsFor(grade, true) });
    if (!isGrade(grade) || !isSubjectFor(grade, subject)) return adminError(400, "학년과 과목을 골라 주세요.");
    return ok({ courses: listCourses(true), outline: courseOutline(grade, subject, true), subjects: subjectsFor(grade, true) });
  });
}
