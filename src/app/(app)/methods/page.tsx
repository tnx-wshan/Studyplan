import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="학습법"
      icon="💡"
      stage="3단계"
      features={["백지 복습, 코넬 노트, 파인만 기법, 인출 연습 등 학습법 라이브러리", "상황별·과목별 학습법 추천", "학습 성향 진단과 AI 주간 코칭"]}
    />
  );
}
