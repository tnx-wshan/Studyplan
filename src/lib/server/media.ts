import "server-only";
import { createHash } from "node:crypto";
import { newServerId, serverDb } from "./db";
import { sanitizeSvg } from "./svg";

/**
 * 문제·설명에 들어가는 그림. 서버 DB(media 표)에 저장하고 /api/media?id= 로 보여준다.
 * 글에는 마크다운 그림 ![설명](/api/media?id=…) 으로 넣는다.
 */
export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const mediaUrl = (id: string) => `/api/media?id=${id}`;
export const mediaMarkdown = (id: string, alt = "그림") => `![${alt.replace(/[[\]]/g, "")}](${mediaUrl(id)})`;

export interface Media {
  id: string;
  mime: MediaType;
  data: Uint8Array;
}

/** 그림을 저장하고 id를 돌려준다. 같은 그림은 한 번만 저장한다. 쓸 수 없는 그림이면 null */
export function saveMedia(mime: string, bytes: Uint8Array, source: "admin" | "ai", now = Date.now()): string | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(mime)) return null;
  let data = bytes;
  if (mime === "image/svg+xml") {
    const svg = sanitizeSvg(new TextDecoder().decode(bytes));
    if (!svg) return null;
    data = new TextEncoder().encode(svg);
  }
  if (data.byteLength === 0 || data.byteLength > MAX_MEDIA_BYTES) return null;
  const hash = createHash("sha256").update(data).digest("hex");
  const db = serverDb();
  const found = db.prepare("SELECT id FROM media WHERE sha = ?").get(hash) as { id: string } | undefined;
  if (found) return found.id;
  const id = newServerId();
  db.prepare("INSERT INTO media (id, mime, data, size, sha, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, mime, data, data.byteLength, hash, source, now);
  return id;
}

export function getMedia(id: string): Media | null {
  const r = serverDb().prepare("SELECT id, mime, data FROM media WHERE id = ?").get(id) as { id: string; mime: MediaType; data: Uint8Array } | undefined;
  return r ? { id: r.id, mime: r.mime, data: new Uint8Array(r.data) } : null;
}

/** data:image/png;base64,... → 저장 */
export function saveDataUrl(dataUrl: string, source: "admin" | "ai"): string | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  return saveMedia(m[1], Buffer.from(m[2], "base64"), source);
}

/** AI가 만든 SVG 그림을 저장하고 글 끝에 붙일 마크다운을 돌려준다 (쓸 수 없으면 빈 글자) */
export function figureMarkdown(svg: string | undefined, alt = "문제 그림"): string {
  if (!svg?.trim()) return "";
  const id = saveMedia("image/svg+xml", new TextEncoder().encode(svg), "ai");
  return id ? mediaMarkdown(id, alt) : "";
}
