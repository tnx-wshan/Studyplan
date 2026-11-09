import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="AI 학습실"
      icon="🤖"
      stage="2단계"
      features={["AI 튜터: 힌트 모드와 풀이 모드 중 선택", "사진·PDF·웹 검색 자료로 문제 만들기", "틀린 문제는 오답노트로, 핵심 개념은 플래시카드로 저장"]}
    />
  );
}
