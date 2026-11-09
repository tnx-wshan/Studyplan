"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  text: string;
}

const EVENT = "hs-toast";
let seq = 0;

export function toast(text: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const item = { id: ++seq, text: (e as CustomEvent<string>).detail };
      setItems((xs) => [...xs, item]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== item.id)), 2600);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className="toast-in font-display rounded-2xl bg-ink px-4 py-2 text-sm text-bg shadow-lg">
          {t.text}
        </div>
      ))}
    </div>
  );
}
