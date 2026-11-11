/**
 * 한국어에서는 **'낱말'**에 처럼 굵은 글씨 안쪽 끝에 따옴표·괄호가 있고 바로 뒤에 글자가 붙으면
 * 마크다운 규칙상 굵게 처리되지 않고 별표가 그대로 보인다. 따옴표·괄호를 굵은 글씨 밖으로 옮겨서 고친다.
 */
export function fixKoreanBold(text: string): string {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, (whole, inner: string) => {
    if (inner.includes("\n\n")) return whole;
    const m = inner.match(/^(['"“‘(\[「『《]*)([\s\S]*?)(['"”’)\]」』》.,!?:;]*)$/);
    if (!m || (!m[1] && !m[3]) || !m[2].trim()) return whole;
    return `${m[1]}**${m[2]}**${m[3]}`;
  });
}

