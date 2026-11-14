import { z } from "zod";
import { coursesFor, curriculumSourceLabel } from "@/data/curriculum";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { fillCourseFromBase } from "@/lib/server/base-curriculum";
import { serverDb } from "@/lib/server/db";
import { courseOutline, createSection, deleteSection, isGrade, isSubjectFor, moveSection, subjectFor, updateSection } from "@/lib/server/learn";

const Create = z.object({
  grade: z.string(),
  subject: z.string(),
  title: z.string().trim().max(60).optional(),
  description: z.string().max(300).optional(),
  /** 교육과정 대표 단원으로 섹션(목차)을 한꺼번에 만든다 */
  fromCurriculum: z.boolean().optional(),
  /** 학년·과목·학기별 기본 단원 중 빠진 섹션을 덧붙인다 */
  fromBase: z.boolean().optional(),
  /** 대표 단원을 가져올 교육과정 과목 (과목에 여럿이면 꼭 고른다) */
  courseId: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Create);
    if (body instanceof Response) return body;
    const { grade, subject } = body;
    if (!isGrade(grade) || !isSubjectFor(grade, subject)) return adminError(400, "학년과 과목을 골라 주세요.");
    if (body.fromBase) {
      const r = fillCourseFromBase(serverDb(), grade, subject, subjectFor(grade, subject)?.name ?? "");
      if (!r) return adminError(400, "이 과목에는 기본 단원 자료가 없어요.");
      return ok({ added: r.added, source: "기본 단원" });
    }
    if (body.fromCurriculum) {
      const group = subjectFor(grade, subject)?.group;
      const list = group ? coursesFor(grade, group) : [];
      const course = body.courseId ? list.find((c) => c.id === body.courseId) : list.length === 1 ? list[0] : undefined;
      if (!course) return adminError(400, "대표 단원을 가져올 교육과정 과목을 골라 주세요.");
      if (course.units.length === 0) return adminError(400, `${course.name}은(는) 대표 단원 자료가 없어요. '+ 섹션'으로 직접 만들어 주세요.`);
      const have = new Set(courseOutline(grade, subject, true).sections.map((s) => s.title));
      const titles = course.units.filter((t) => !have.has(t));
      const source = curriculumSourceLabel(course);
      titles.forEach((t) => createSection(grade, subject, t, source));
      return ok({ added: titles.length, source });
    }
    if (!body.title) return adminError(400, "섹션 이름을 써 주세요.");
    return ok({ section: createSection(grade, subject, body.title, body.description) });
  });
}

const Update = z.object({ id: z.string(), title: z.string().trim().min(1).max(60).optional(), description: z.string().max(300).optional(), move: z.union([z.literal(-1), z.literal(1)]).optional() });

export async function PUT(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Update);
    if (body instanceof Response) return body;
    if (body.move) moveSection(body.id, body.move);
    const section = updateSection(body.id, body);
    return section ? ok({ section }) : adminError(404, "섹션을 찾을 수 없어요.");
  });
}

/** 섹션을 지우면 그 안의 유닛도 지워진다 */
export async function DELETE(request: Request) {
  return admin(() => {
    deleteSection(new URL(request.url).searchParams.get("id") ?? "");
    return ok();
  });
}
