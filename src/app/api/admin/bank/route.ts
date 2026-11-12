import { admin, ok } from "@/lib/server/admin-api";
import { listItems, listPublishers, type BankKind } from "@/lib/server/bank";

export async function GET(request: Request) {
  return admin(() => {
    const p = new URL(request.url).searchParams;
    const kind = p.get("kind");
    return ok({
      items: listItems({
        kind: kind === "material" || kind === "quiz" ? (kind as BankKind) : undefined,
        grade: p.get("grade") || undefined,
        subject: p.get("subject") || undefined,
        publisher: p.get("publisher") || undefined,
        q: p.get("q") || undefined,
        includeHidden: true,
        limit: 300,
      }).map(({ data: _data, ...rest }) => (void _data, rest)),
      publishers: listPublishers(),
    });
  });
}
