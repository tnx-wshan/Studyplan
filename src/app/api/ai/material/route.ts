import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { MaterialRequestSchema, type MaterialRequest } from "@/lib/ai/schemas";
import { makeMaterial } from "@/lib/ai/service";
import { addItem, findByKey, gradeId, markUsed, materialLookupKey, subjectId, type MaterialData } from "@/lib/server/bank";
import { rejectIfSuspended } from "@/lib/server/guard";
import { currentUserId } from "@/lib/server/identity";

/** 같은 요청인지 알아보는 데 쓰는 글자: 검색어, "과목 단원", 사진·PDF 내용 */
function lookupTopic(body: MaterialRequest): string {
  switch (body.kind) {
    case "web":
      return body.query;
    case "curriculum":
      return [body.course, body.publisher ?? "", body.year ?? "", body.unit].join(" ");
    case "photo":
      return body.images.join("|");
    case "pdf":
      return body.pdf;
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request, MaterialRequestSchema);
  if (body instanceof Response) return body;
  const blocked = await rejectIfSuspended();
  if (blocked) return blocked;

  const grade = gradeId(body.grade);
  const subject = subjectId(body.subjectGroup, body.kind === "curriculum" ? body.course : body.subject);
  const lookupKey = materialLookupKey({ kind: body.kind, grade, subject, topic: lookupTopic(body) });

  // 누군가 이미 정리한 내용이면 AI를 부르지 않고 그대로 준다 (사용 횟수도 쓰지 않는다)
  const saved = findByKey(lookupKey);
  if (saved) {
    markUsed(saved.id);
    const data = saved.data as MaterialData;
    return NextResponse.json({ title: saved.title, summary: data.summary, keyPoints: data.keyPoints, sources: data.sources, notice: data.notice, bankId: saved.id, fromBank: true });
  }

  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("material", async () => {
    const result = await makeMaterial(body, ai.models, ai.webSearch);
    const item = addItem({
      kind: "material",
      lookupKey,
      sourceKind: body.kind,
      grade,
      subject,
      subjectName: body.kind === "curriculum" ? body.course : (body.subject ?? ""),
      topic: body.kind === "web" ? body.query : body.kind === "curriculum" ? `${body.course} ${body.unit}` : result.title,
      ...(body.kind === "curriculum" ? { publisher: body.publisher ?? "", year: body.year ?? null, unit: body.unit } : {}),
      title: result.title,
      data: { summary: result.summary, keyPoints: result.keyPoints, sources: result.sources, ...(result.notice ? { notice: result.notice } : {}) },
      createdBy: await currentUserId(),
      madeBy: ai.setup.provider,
    });
    return NextResponse.json({ ...result, bankId: item.id });
  });
}
