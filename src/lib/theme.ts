// 테마 초기화에 쓰는 값들. 서버 레이아웃과 클라이언트 컴포넌트가 함께 쓰므로
// "use client" 파일에 두면 안 된다 (서버에서 문자열이 아니라 '클라이언트 참조'가 되어
// 스크립트 파일이 늦게 도착할 때 React 하이드레이션 오류 #418이 난다).
export const THEME_KEY = "hs-theme";
export const STYLE_KEY = "hs-style";
export const DEFAULT_STYLE = "noir" as const;

/** 첫 화면 깜빡임을 막기 위해 <head>에서 실행하는 스크립트 */
export const themeInitScript = `(function(){try{var r=document.documentElement;var s=localStorage.getItem('${STYLE_KEY}')||'${DEFAULT_STYLE}';r.dataset.style=s;var t=localStorage.getItem('${THEME_KEY}')||'system';var d=s==='noir'||t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'dark':'light';}catch(e){}})();`;
