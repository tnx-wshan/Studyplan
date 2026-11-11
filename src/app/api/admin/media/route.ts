import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { MAX_MEDIA_BYTES, mediaMarkdown, mediaUrl, saveDataUrl } from "@/lib/server/media";

const Body = z.object({ dataUrl: z.string().max(Math.ceil(MAX_MEDIA_BYTES * 1.4) + 100), alt: z.string().max(100).optional() });

/** 관리자가 붙여넣거나 고른 그림을 저장하고, 글에 넣을 마크다운을 돌려준다 */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Body);
    if (body instanceof Response) return body;
    const id = saveDataUrl(body.dataUrl, "admin");
    if (!id) return adminError(400, "그림을 저장하지 못했어요. PNG·JPG·WEBP·GIF·SVG 그림을 5MB 이하로 넣어 주세요.");
    return ok({ id, url: mediaUrl(id), markdown: mediaMarkdown(id, body.alt || "그림") });
  });
}
