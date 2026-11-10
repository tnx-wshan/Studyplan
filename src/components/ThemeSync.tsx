"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/hooks";
import type { Profile } from "@/lib/db/types";

export const THEME_KEY = "hs-theme";
export const STYLE_KEY = "hs-style";
export type UiStyle = NonNullable<Profile["style"]>;
export const DEFAULT_STYLE: UiStyle = "noir";

/** 첫 화면 깜빡임을 막기 위해 <head>에서 실행하는 스크립트 */
export const themeInitScript = `(function(){try{var r=document.documentElement;var s=localStorage.getItem('${STYLE_KEY}')||'${DEFAULT_STYLE}';r.dataset.style=s;var t=localStorage.getItem('${THEME_KEY}')||'system';var d=s==='noir'||t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'dark':'light';}catch(e){}})();`;

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
