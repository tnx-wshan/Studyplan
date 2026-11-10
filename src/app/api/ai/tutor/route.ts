import { getModel } from "@/lib/ai/provider";
import { friendlyAiError, parseBody, withQuota } from "@/lib/ai/route-helpers";
import { TutorRequestSchema } from "@/lib/ai/schemas";
import { startTutorStream } from "@/lib/ai/service";

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
    // 첫 글자가 나올 때까지 기다린다. 그 전에 오류(키 오류, 서버 혼잡, 시간 초과)가 나면
    // 다음 모델로 넘어가고, 모두 실패하면 던져서 사용량을 돌려주고 오류 응답을 보낸다.
    const { first, rest } = await startTutorStream(body, ai.models, ai.fastOptions);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(first));
      },
      async pull(controller) {
        try {
          for (;;) {
            const next = await rest.next();
            if (next.done) return controller.close();
            if (next.value.type === "error") throw next.value.error;
            if (next.value.type === "text-delta" && next.value.text) return controller.enqueue(encoder.encode(next.value.text));
          }
        } catch (e) {
          console.error("[ai] tutor stream", e instanceof Error ? e.message : e);
          try {
            controller.enqueue(encoder.encode("\n\n(응답이 중간에 끊겼어요. 다시 질문해 주세요.)"));
            controller.close();
          } catch {
            // 학생 쪽에서 이미 연결을 닫은 경우
          }
        }
      },
      cancel() {
        void rest.return?.();
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  });
}
