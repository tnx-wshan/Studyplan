import { NextResponse } from "next/server";
import { GRADES } from "@/data/curriculum";
import { listCourses, subjectsFor } from "@/lib/server/learn";

/** 공개된 유닛이 있는 코스(학년 × 과목) 목록과, 학년마다의 과목(기본 5과목 + 추가한 과목) */
export async function GET() {
  return NextResponse.json({
    courses: listCourses().filter((c) => c.units > 0),
    subjects: Object.fromEntries(GRADES.map((g) => [g.id, subjectsFor(g.id)])),
  });
}
