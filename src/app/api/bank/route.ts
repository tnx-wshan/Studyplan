import { NextResponse } from "next/server";
import { listItems } from "@/lib/server/bank";
import { rejectIfSuspended } from "@/lib/server/guard";

/** 모두의 자료실: 다른 학생들이 AI로 만든 정리 목록 */
export async function GET(request: Request) {
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;
  const url = new URL(request.url);
  const items = listItems({
    kind: "material",
    subject: url.searchParams.get("subject") || undefined,
    grade: url.searchParams.get("grade") || undefined,
    q: url.searchParams.get("q") || undefined,
    limit: 60,
  });
  return NextResponse.json({
    items: items.map((it) => ({ id: it.id, title: it.title, topic: it.topic, grade: it.grade, subject: it.subject, subjectName: it.subjectName, publisher: it.publisher, year: it.year, unit: it.unit, quizzes: it.children, uses: it.uses, sourceKind: it.sourceKind, updatedAt: it.updatedAt })),
  });
}
