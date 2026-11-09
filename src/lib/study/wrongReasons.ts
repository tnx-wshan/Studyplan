import type { WrongAnswer } from "@/lib/db/types";

export const WRONG_REASONS: Record<WrongAnswer["reason"], { label: string; icon: string; tip: string }> = {
  concept: { label: "개념 부족", icon: "📖", tip: "교과서에서 개념을 다시 읽고, 안 보고 설명해 보세요." },
  mistake: { label: "실수", icon: "✏️", tip: "어디서 실수했는지 표시하고, 같은 실수를 막을 나만의 규칙을 적어두세요." },
  time: { label: "시간 부족", icon: "⏰", tip: "시간을 재고 다시 풀어보세요. 비슷한 문제를 여러 번 풀면 빨라져요." },
  other: { label: "기타", icon: "❓", tip: "왜 틀렸는지 한 줄로 적어두면 다음에 도움이 돼요." },
};
