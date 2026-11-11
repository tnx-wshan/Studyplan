/** 학생이 쓴 식을 미리 보기용 KaTeX 식으로 바꾼다 (채점은 따로 한다) */
export function toLatex(input: string): string {
  let s = input
    .replace(/\\/g, "")
    .replace(/[{}]/g, "")
    .replace(/√\(([^()]*)\)/g, "\\sqrt{$1}")
    .replace(/√([0-9a-zA-Z]+)/g, "\\sqrt{$1}")
    .replace(/\^\(([^()]*)\)/g, "^{$1}")
    .replace(/\^(-?[0-9a-zA-Z]+)/g, "^{$1}")
    .replace(/²/g, "^{2}")
    .replace(/³/g, "^{3}");
  // 간단한 분수: 3/4, x/2, (a+b)/c
  s = s.replace(/(\([^()]*\)|[0-9a-zA-Z.]+)\/(\([^()]*\)|[0-9a-zA-Z.]+)/g, (_, a: string, b: string) => `\\frac{${a.replace(/^\((.*)\)$/, "$1")}}{${b.replace(/^\((.*)\)$/, "$1")}}`);
  return s
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/±/g, "\\pm ")
    .replace(/π/g, "\\pi ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ");
}
