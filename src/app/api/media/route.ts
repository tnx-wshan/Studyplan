import { getMedia } from "@/lib/server/media";

/** 문제·설명 그림. 한 번 저장한 그림은 바뀌지 않으므로 오래 저장해 둔다 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const media = id ? getMedia(id) : null;
  if (!media) return new Response("Not Found", { status: 404 });
  return new Response(media.data as unknown as BodyInit, {
    headers: {
      "content-type": media.mime,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // SVG 주소를 직접 열어도 스크립트·외부 파일을 불러오지 못하게
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    },
  });
}
