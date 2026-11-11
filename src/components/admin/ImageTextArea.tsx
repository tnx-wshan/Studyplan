"use client";

import { useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { adminApi } from "@/lib/admin/client";
import { blobToDataUrl } from "@/lib/ai/client";
import { compressImage } from "@/lib/image";
import { fieldClass } from "../kit";
import { toast } from "../Toaster";
import { cn } from "../ui";

/** 이보다 크면 줄여서 올린다 (도형·그래프 그림은 보통 훨씬 작다) */
const KEEP_AS_IS_BYTES = 800 * 1024;
const MAX_SIDE = 1600;
const IMAGE_MD = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** 그림 파일을 서버에 올리고 글에 넣을 마크다운을 받는다 */
async function upload(file: File | Blob, alt: string): Promise<string> {
  let blob: Blob = file;
  // SVG·GIF는 그대로, 큰 사진은 줄인다
  if (!/svg|gif/.test(file.type) && file.size > KEEP_AS_IS_BYTES) blob = await compressImage(file, MAX_SIDE, 0.85);
  const r = await adminApi<{ markdown: string }>("/api/admin/media", { method: "POST", body: { dataUrl: await blobToDataUrl(blob), alt } });
  return r.markdown;
}

/**
 * 관리 도구의 글 칸: 그림을 복사해서 붙여넣기(Ctrl+V), 끌어다 놓기, '그림 넣기' 단추로 넣을 수 있다.
 * 그림은 서버에 저장되고, 글에는 ![그림](/api/media?id=…)가 커서 자리에 들어간다.
 */
export function ImageTextArea({
  label,
  value,
  onChange,
  rows = 3,
  className,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
  hint?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const images = [...value.matchAll(IMAGE_MD)].map((m) => ({ alt: m[1], src: m[2] }));

  async function addFiles(files: File[]) {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (pics.length === 0) return;
    const el = ref.current;
    // 커서 자리를 기억해 두고, 올리는 동안 글이 바뀌어도 그 자리에 넣는다
    const at = el?.selectionStart ?? value.length;
    setBusy((n) => n + pics.length);
    const mds: string[] = [];
    for (const f of pics) {
      try {
        mds.push(await upload(f, "그림"));
      } catch (e) {
        toast(e instanceof Error ? e.message : "그림을 올리지 못했어요.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (mds.length === 0) return;
    const current = ref.current?.value ?? value;
    const pos = Math.min(at, current.length);
    const before = current.slice(0, pos);
    const insert = `${before && !before.endsWith("\n") ? "\n\n" : ""}${mds.join("\n\n")}\n`;
    onChange(before + insert + current.slice(pos));
    toast(`그림 ${mds.length}개를 넣었어요.`);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return; // 글자 붙여넣기는 그대로
    e.preventDefault();
    void addFiles(files);
  }

  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    const files = [...e.dataTransfer.files];
    setOver(false);
    if (!files.some((f) => f.type.startsWith("image/"))) return;
    e.preventDefault();
    void addFiles(files);
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-ink-soft">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => {
          if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        className={cn(fieldClass, "resize-y", over && "border-accent bg-accent/10", className)}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border-2 border-line px-2 py-0.5 text-ink">
          🖼 그림 넣기
        </button>
        <span>{busy > 0 ? `그림 올리는 중… (${busy})` : (hint ?? "그림을 복사해 이 칸에 붙여넣거나(Ctrl+V) 끌어다 놓아도 돼요.")}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          aria-label={`${label}에 넣을 그림 파일`}
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void addFiles(files);
          }}
        />
      </div>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label}에 들어간 그림`}>
          {images.map((img, i) => (
            <li key={`${img.src}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 서버에 올린 그림 미리 보기 */}
              <img src={img.src} alt={img.alt || `그림 ${i + 1}`} className="h-16 max-w-40 rounded-lg border border-line bg-[var(--figure-bg)] object-contain p-1" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
