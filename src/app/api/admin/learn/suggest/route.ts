import { admin, adminError, ok } from "@/lib/server/admin-api";
import { suggestForSection } from "@/lib/server/bank";
import { getSection } from "@/lib/server/learn";

/** 섹션에 어울리는 자료 모음 항목 (유닛 재료 후보) */
export async function GET(request: Request) {
  return admin(() => {
    const section = getSection(new URL(request.url).searchParams.get("sectionId") ?? "");
    if (!section) return adminError(404, "섹션을 찾을 수 없어요.");
    return ok({
      items: suggestForSection(section).map(({ item, score }) => ({ id: item.id, title: item.title, topic: item.topic, grade: item.grade, quizzes: item.children, uses: item.uses, score: Math.round(score * 100) / 100 })),
    });
  });
}
