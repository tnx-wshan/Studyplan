import { NextResponse } from "next/server";
import { listCourses } from "@/lib/server/learn";

/** 공개된 유닛이 있는 코스(학년 × 과목) 목록 */
export async function GET() {
  return NextResponse.json({ courses: listCourses().filter((c) => c.units > 0) });
}
