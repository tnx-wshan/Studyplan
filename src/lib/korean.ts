/** 마지막 글자의 받침 번호 (없으면 0, 한글이 아니면 0) */
function jong(word: string): number {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 ? code % 28 : 0;
}

/** "공부" → "공부를", "습관" → "습관을" */
export function withEulReul(word: string): string {
  return word + (jong(word) ? "을" : "를");
}

/** "아기" → "아기로", "청소년" → "청소년으로", "물" → "물로" (ㄹ받침은 "로") */
export function withRo(word: string): string {
  const j = jong(word);
  return word + (j === 0 || j === 8 ? "로" : "으로");
}

/** "에코" → "에코가", "쑥쑥이" → "쑥쑥이가", "민준" → "민준이" */
export function withIGa(word: string): string {
  return word + (jong(word) ? "이" : "가");
}

/** "동료" → "동료와", "펫" → "펫과" */
export function withWaGwa(word: string): string {
  return word + (jong(word) ? "과" : "와");
}

/** "에코" → "에코라", "민준" → "민준이라" */
export function withIRa(word: string): string {
  return word + (jong(word) ? "이라" : "라");
}
