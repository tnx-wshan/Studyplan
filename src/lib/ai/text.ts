/**
 * AI가 준 글을 화면에 그리기 전에 다듬는다.
 * 1) 줄바꿈이 글자 그대로 "\n"으로 온 경우 진짜 줄바꿈으로 바꾼다. (\neq, \nu 같은 수식 명령은 건드리지 않는다)
 * 2) $ 없이 수식(\times, \frac, 5^4 …)이 그대로 온 경우, 한글이 아닌 구간을 $...$로 감싼다.
 */
export function cleanAiText(text: string): string {
  // "\n" 뒤에 영문자가 오면 \neq·\nabla 같은 수식 명령이므로 그대로 둔다
  let out = text.replace(/\\n(?![a-zA-Z])/g, "\n");
  if (!out.includes("$")) out = out.split("\n").map(wrapBareMath).join("\n");
  return out;
}

/** 수식 명령(\times)이나 거듭제곱(5^4) */
const BARE_MATH = /\\[a-zA-Z]+|[A-Za-z0-9)}\]]\^/;

function wrapBareMath(line: string): string {
  if (!BARE_MATH.test(line)) return line;
  // 한글·마크다운 강조(*)가 아닌 연속 구간 중 수식이 들어 있는 것만 감싼다
  return line.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ*]+/g, (run) => {
    if (!BARE_MATH.test(run)) return run;
    const lead = run.match(/^\s*/)![0];
    const trail = run.match(/\s*$/)![0];
    const core = run.trim();
    return core ? `${lead}$${core}$${trail}` : run;
  });
}
