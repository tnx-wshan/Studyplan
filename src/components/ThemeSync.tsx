"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/hooks";
import type { Profile } from "@/lib/db/types";
import { DEFAULT_STYLE as DEFAULT_STYLE_VALUE, STYLE_KEY, THEME_KEY } from "@/lib/theme";

export type UiStyle = NonNullable<Profile["style"]>;
export const DEFAULT_STYLE: UiStyle = DEFAULT_STYLE_VALUE;

/** 누아르 스타일은 항상 어두운 화면 */
export function applyTheme(theme: Profile["theme"], style: UiStyle = DEFAULT_STYLE) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(STYLE_KEY, style);
  } catch {}
  const root = document.documentElement;
  root.dataset.style = style;
  const dark = style === "noir" || theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
}

export function useUiStyle(): UiStyle {
  return useProfile()?.style ?? DEFAULT_STYLE;
}

export function ThemeSync() {
  const profile = useProfile();
  const theme = profile?.theme ?? "system";
  const style = profile?.style ?? DEFAULT_STYLE;
  useEffect(() => {
    applyTheme(theme, style);
    if (theme !== "system" || style === "noir") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system", style);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, style]);
  return null;
}
