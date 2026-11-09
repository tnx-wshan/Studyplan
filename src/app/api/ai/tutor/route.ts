import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { TutorRequestSchema } from "@/lib/ai/schemas";
import { tutorStream } from "@/lib/ai/service";

export async function POST(request: Request) {
  const body = await parseBody(request, TutorRequestSchema);
  if (body instanceof Response) return body;
  let ai: ReturnType<typeof getModel>;
  try {
    ai = getModel();
  } catch (e) {
    return friendlyAiError(e);
  }
  return withQuota("tutor", async () => {
    const parts = tutorStream(body, ai.model).fullStream[Symbol.asyncIterator]();

    // 첫 글자가 나올 때까지 기다린다. 그 전에 오류(키 오류 등)가 나면 던져서
    // 사용량을 돌려주고 오류 응답을 보낸다.
    let first = "";
    while (!first) {
      const next = await parts.next();
      if (next.done) throw new Error("AI가 빈 답을 보냈어요.");
      if (next.value.type === "error") throw next.value.error;
      if (next.value.type === "text-delta") first = next.value.text;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(first));
      },
      async pull(controller) {
        try {
          for (;;) {
            const next = await parts.next();
            if (next.done) return controller.close();
            if (next.value.type === "error") throw next.value.error;
            if (next.value.type === "text-delta") return controller.enqueue(encoder.encode(next.value.text));
          }
        } catch (e) {
          console.error("[ai] tutor stream", e);
          controller.enqueue(encoder.encode("\n\n(응답이 중간에 끊겼어요. 다시 질문해 주세요.)"));
          controller.close();
        }
      },
      cancel() {
        void parts.return?.();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  });
}
