import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="복습"
      icon="🃏"
      stage="1단계(MVP)"
      features={["간격 반복 플래시카드: 오늘 복습할 카드를 자동으로 골라줘요", "오답노트: 틀린 이유를 기록하고 다시 풀기", "공부한 단원을 1·3·7·14일 뒤 복습 퀘스트로 등록"]}
    />
  );
}
