import { admin, ok } from "@/lib/server/admin-api";
import { duplicateGroups } from "@/lib/server/bank";

/** 주제가 겹치는 자료 묶음 (정리하거나 유닛 하나로 합칠 후보) */
export async function GET() {
  return admin(() => ok({ groups: duplicateGroups().map((g) => g.map(({ data: _d, ...rest }) => (void _d, rest))) }));
}
