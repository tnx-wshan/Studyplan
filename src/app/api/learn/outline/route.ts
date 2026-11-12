import { NextResponse } from "next/server";
import { jsonError } from "@/lib/ai/route-helpers";
import { courseOutline, isGrade, isSubjectFor } from "@/lib/server/learn";

/** 코스의 섹션과 유닛 목록 (문제 내용 없이) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const grade = url.searchParams.get("grade");
  const subject = url.searchParams.get("subject");
  if (!isGrade(grade) || !isSubjectFor(grade, subject)) return jsonError(400, "학년과 과목을 골라 주세요.");
  return NextResponse.json(courseOutline(grade, subject));
}
