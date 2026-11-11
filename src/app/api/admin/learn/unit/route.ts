import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { createUnit, deleteUnit, getUnit, moveUnit, updateUnit } from "@/lib/server/learn";

export async function GET(request: Request) {
  return admin(() => {
    const unit = getUnit(new URL(request.url).searchParams.get("id") ?? "", true);
    return unit ? ok({ unit }) : adminError(404, "유닛을 찾을 수 없어요.");
  });
}

const Create = z.object({ sectionId: z.string(), title: z.string().max(60), steps: z.array(z.unknown()).max(40), status: z.enum(["draft", "published"]).optional() });

export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Create);
    if (body instanceof Response) return body;
    const r = createUnit(body.sectionId, body);
    return r.problems ? adminError(400, r.problems.join("\n")) : ok(r);
  });
}

const Update = z.object({
  id: z.string(),
  sectionId: z.string().optional(),
  title: z.string().max(60).optional(),
  steps: z.array(z.unknown()).max(40).optional(),
  status: z.enum(["draft", "published"]).optional(),
  move: z.union([z.literal(-1), z.literal(1)]).optional(),
});

/** 고친 단계는 저장 전에 검사한다 (객관식 정답이 보기에 있는지, 빈칸이 있는지 등) */
export async function PUT(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Update);
    if (body instanceof Response) return body;
    if (body.move) {
      moveUnit(body.id, body.move);
      return ok({ unit: getUnit(body.id, true) });
    }
    const r = updateUnit(body.id, body);
    return r.problems ? adminError(400, r.problems.join("\n")) : ok(r);
  });
}

export async function DELETE(request: Request) {
  return admin(() => {
    deleteUnit(new URL(request.url).searchParams.get("id") ?? "");
    return ok();
  });
}
