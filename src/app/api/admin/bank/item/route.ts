import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { childrenOf, deleteItem, getItem, updateItem } from "@/lib/server/bank";
import { QuestionSchema } from "@/lib/ai/schemas";
import { normalizeQuestion } from "@/lib/ai/service";

export async function GET(request: Request) {
  return admin(() => {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const item = getItem(id);
    if (!item) return adminError(404, "항목을 찾을 수 없어요.");
    return ok({ item, children: childrenOf(id, true), parent: item.parentId ? getItem(item.parentId) : null });
  });
}

const MaterialData = z.object({
  summary: z.string().max(30_000),
  keyPoints: z.array(z.string().max(500)).max(20),
  sources: z.array(z.object({ title: z.string().max(200), url: z.string().max(1000) })).max(20),
  notice: z.string().max(500).optional(),
});
const QuizData = z.object({ questions: z.array(QuestionSchema).max(30), verified: z.boolean(), difficulty: z.enum(["easy", "normal", "hard"]) });

const Body = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(100).optional(),
  topic: z.string().max(200).optional(),
  grade: z.string().max(4).optional(),
  subject: z.string().max(10).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  data: z.union([MaterialData, QuizData]).optional(),
});

/** 관리자가 설명이나 문제를 고친다. 객관식 정답이 보기에 없으면 저장하지 않는다 */
export async function PUT(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Body);
    if (body instanceof Response) return body;
    const item = getItem(body.id);
    if (!item) return adminError(404, "항목을 찾을 수 없어요.");
    let data = body.data;
    if (data) {
      if ((item.kind === "quiz") !== ("questions" in data)) return adminError(400, "항목 종류와 내용이 맞지 않아요.");
      if ("questions" in data) {
        const fixed = data.questions.map((q) => normalizeQuestion(q));
        const bad = fixed.findIndex((q) => !q);
        if (bad >= 0) return adminError(400, `${bad + 1}번 문제: 문제와 정답이 있어야 하고, 객관식은 정답이 보기 중 하나여야 해요.`);
        data = { ...data, questions: fixed.filter((q) => !!q) };
      }
    }
    return ok({ item: updateItem(body.id, { ...body, data }) });
  });
}

export async function DELETE(request: Request) {
  return admin(() => {
    deleteItem(new URL(request.url).searchParams.get("id") ?? "");
    return ok();
  });
}
