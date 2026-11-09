"use client";

import { useEffect } from "react";
import { useProfile } from "@/lib/hooks";

export const THEME_KEY = "hs-theme";

/** 첫 화면 깜빡임을 막기 위해 <head>에서 실행하는 스크립트 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export function applyTheme(theme: "system" | "light" | "dark") {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeSync() {
  const profile = useProfile();
  const theme = profile?.theme ?? "system";
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}
