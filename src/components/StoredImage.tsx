"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { getDB } from "@/lib/db";

export function StoredImage({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const image = useLiveQuery(() => getDB().images.get(id), [id]);
  const url = useMemo(() => (image ? URL.createObjectURL(image.blob) : undefined), [image]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- 기기에 저장된 Blob 이미지
  return <img src={url} alt={alt} className={className} />;
}
