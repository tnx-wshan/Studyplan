import { z } from "zod";
import { GRADES, SUBJECT_GROUPS } from "@/data/curriculum";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, withQuota } from "@/lib/ai/route-helpers";
import { makeUnit } from "@/lib/ai/service";
import { figureMarkdown } from "@/lib/server/media";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { childrenOf, getItem, type MaterialData, type QuizData } from "@/lib/server/bank";
import { courseOutline, createUnit, getSection } from "@/lib/server/learn";

const Body = z.object({ sectionId: z.string(), itemIds: z.array(z.string()).min(1).max(8), focus: z.string().max(100).optional() });

/**
 * 모아 둔 자료 여러 개를 AI가 합쳐 유닛 초안을 만든다. 겹치는 내용은 하나로 정리한다.
 * 초안으로 저장되므로 관리자가 확인·수정한 뒤 공개한다.
 */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Body);
    if (body instanceof Response) return body;
    const section = getSection(body.sectionId);
    if (!section) return adminError(404, "섹션을 찾을 수 없어요.");
    const items = body.itemIds.map(getItem).filter((x) => x && x.kind === "material");
    if (items.length === 0) return adminError(400, "재료로 쓸 자료를 하나 이상 골라 주세요.");

    let ai: ReturnType<typeof getModel>;
    try {
      ai = getModel();
    } catch (e) {
      return friendlyAiError(e);
    }
    const outline = courseOutline(section.grade, section.subject, true);
    const existing = outline.sections.find((s) => s.id === section.id)?.units.map((u) => u.title) ?? [];
    return withQuota("unit", async () => {
      const made = await makeUnit(
        {
          grade: GRADES.find((g) => g.id === section.grade)?.label ?? section.grade,
          subject: SUBJECT_GROUPS.find((g) => g.id === section.subject)?.label ?? section.subject,
          section: section.title,
          existing,
          focus: body.focus,
          sources: items.map((it) => {
            const data = it!.data as MaterialData;
            return {
              title: it!.title,
              summary: data.summary,
              keyPoints: data.keyPoints,
              questions: childrenOf(it!.id).flatMap((q) => (q.data as QuizData).questions.map((x) => ({ prompt: x.prompt, answer: x.answer }))),
            };
          }),
        },
        ai.models,
        section.subject === "math",
        figureMarkdown,
      );
      if (made.steps.length === 0) throw new Error("no usable steps");
      const r = createUnit(section.id, { title: made.title, steps: made.steps, status: "draft", sourceIds: items.map((x) => x!.id) });
      if (r.problems) return adminError(502, `AI가 만든 유닛을 저장하지 못했어요: ${r.problems.join(", ")}`);
      return ok({ unit: r.unit, dropped: made.problems });
    });
  });
}
