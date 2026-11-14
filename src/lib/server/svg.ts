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
  // 글자 속 & 는 XML에서 &amp; 로 써야 한다 (안 그러면 그림 전체가 깨진다)
  s = s.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  return svgProblem(s) ? null : s;
}

/**
 * 브라우저가 그릴 수 없는 SVG인지 본다: 태그가 닫히지 않았거나 짝이 엇갈린 경우.
 * 문제가 있으면 이유, 없으면 null.
 */
export function svgProblem(raw: string): string | null {
  const svg = raw.trim();
  if (!/^<svg[\s>]/i.test(svg)) return "<svg 로 시작하지 않아요.";
  if (!/<\/svg>$/i.test(svg)) return "</svg> 로 끝나지 않아요.";
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*(\/?)>/g;
  let last = 0;
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    // 태그 사이 글자에 < 가 남아 있으면 태그 모양이 깨진 것
    if (svg.slice(last, m.index).includes("<")) return "태그 모양이 올바르지 않아요.";
    last = m.index + m[0].length;
    const [, close, name, , self] = m;
    if (self) continue;
    if (!close) stack.push(name);
    else {
      // 닫는 태그가 나왔는데 열린 태그와 다르면, 열린 쪽이 닫히지 않은 것
      const open = stack.pop();
      if (open !== name) return open ? `<${open}> 태그가 닫히지 않았어요.` : `</${name}> 앞에 여는 태그가 없어요.`;
    }
  }
  if (svg.slice(last).includes("<")) return "태그 모양이 올바르지 않아요.";
  if (stack.length) return `<${stack[stack.length - 1]}> 태그가 닫히지 않았어요.`;
  return null;
}
