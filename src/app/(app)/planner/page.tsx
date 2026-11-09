import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="플래너"
      icon="🗓️"
      stage="1단계(MVP)"
      features={["시험 D-day 역산 플래너: 시험일과 범위를 넣으면 할 일을 자동 배분", "주간·일간 계획과 미완료 항목 넘기기", "뽀모도로 집중 타이머와 공부시간 자동 기록"]}
    />
  );
}
