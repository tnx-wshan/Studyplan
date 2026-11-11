/**
 * AI가 준 글을 화면에 그리기 전에 다듬는다.
 * 1) 줄바꿈이 글자 그대로 "\n"으로 온 경우 진짜 줄바꿈으로 바꾼다. (\neq, \nu 같은 수식 명령은 건드리지 않는다)
 * 2) $ 없이 수식(\times, \frac, 5^4 …)이 그대로 온 경우, 한글이 아닌 구간을 $...$로 감싼다.
 */
export function cleanAiText(text: string): string {
  // "\n" 뒤에 영문자가 오면 \neq·\nabla 같은 수식 명령이므로 그대로 둔다
  let out = repairLatexEscapes(text).replace(/\\n(?![a-zA-Z])/g, "\n");
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

/**
 * 모델이 JSON 안에 수식 명령의 백슬래시를 하나만 쓰면(\times, \frac …) JSON 규칙상
 * \t·\f·\b·\r·\n이 탭·폼피드·백스페이스·CR·줄바꿈 문자로 바뀌어 "imes", "rac"처럼 보인다.
 * 이런 제어 문자 뒤에 영문자가 붙어 있으면 원래 수식 명령으로 되돌린다.
 * 진짜 줄바꿈과 헷갈릴 수 있는 \n은 수식($...$) 안에 있고 알려진 명령(\neq, \nabla …)일 때만 되돌린다.
 */
export function repairLatexEscapes(text: string): string {
  if (!/[\t\f\b\r\n]/.test(text)) return text;
  let out = text
    .replace(/\t(?=[a-zA-Z])/g, "\\t")
    .replace(/\f(?=[a-zA-Z])/g, "\\f")
    .replace(/\x08(?=[a-zA-Z])/g, "\\b")
    .replace(/\r(?=[a-zA-Z])/g, "\\r");
  if (out.includes("\n") && out.includes("$")) {
    let result = "";
    let dollars = 0;
    for (let i = 0; i < out.length; i++) {
      const c = out[i];
      if (c === "$" && out[i - 1] !== "\\") {
        // $$...$$도 수식 한 덩어리로 센다
        if (out[i + 1] === "$") {
          result += "$$";
          i++;
        } else result += c;
        dollars++;
        continue;
      }
      if (c === "\n" && dollars % 2 === 1 && N_COMMAND.test(out.slice(i + 1, i + 12))) {
        result += "\\n";
        continue;
      }
      result += c;
    }
    out = result;
  }
  return out;
}

/** \n으로 시작하는 수식 명령에서 n 뒤의 글자 */
const N_COMMAND = /^(eq|e|abla|u|otin|ot|i|mid|geq|leq|eg|exists|ewline|subseteq|parallel)(?![a-zA-Z])/;

/** 객체·배열 안의 모든 글자에 repairLatexEscapes를 적용한다 (저장된 자료 고치기용) */
export function repairDeep<T>(value: T): T {
  if (typeof value === "string") return repairLatexEscapes(value) as T;
  if (Array.isArray(value)) return value.map(repairDeep) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairDeep(v)])) as T;
  return value;
}

/** 마크다운 그림 ![설명](주소)을 "[그림: 설명]"으로 바꾼다 (그림을 그릴 수 없는 곳: 암기 카드 등) */
export function stripImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => `[그림${alt.trim() ? `: ${alt.trim()}` : ""}]`);
}
