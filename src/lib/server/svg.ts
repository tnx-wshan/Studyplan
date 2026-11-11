/**
 * AI가 만든(또는 관리자가 올린) SVG 그림에서 위험한 부분을 지운다.
 * 그림은 <img>로만 보여주므로 스크립트가 실행되지 않지만, 주소를 직접 열 때를 대비해 한 번 더 막는다.
 * 쓸 수 없는 SVG면 null.
 */
export const MAX_SVG_BYTES = 100_000;

export function sanitizeSvg(raw: string): string | null {
  let s = raw.trim();
  // ```svg ... ``` 로 감싸서 오는 경우
  s = s.replace(/^```(?:svg|xml|html)?\s*/i, "").replace(/```$/, "").trim();
  s = s.replace(/^<\?xml[^>]*>\s*/i, "").replace(/<!DOCTYPE[^>]*>\s*/i, "").replace(/<!--[\s\S]*?-->/g, "");
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return null;
  if (new TextEncoder().encode(s).length > MAX_SVG_BYTES) return null;
  s = s
    // 실행될 수 있는 요소
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<(iframe|embed|object|audio|video|animate|set|handler)[\s\S]*?(<\/\1\s*>|\/>)/gi, "")
    // onload= 같은 이벤트 속성
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // 외부 링크 (그림 안의 #참조만 허용)
    .replace(/\s+(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/javascript:/gi, "")
    // 스타일 안의 외부 불러오기
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none");
  if (!/^<svg[^>]*\sxmlns=/i.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
