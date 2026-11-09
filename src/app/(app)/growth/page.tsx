import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="성장"
      icon="🌱"
      stage="3·4단계"
      features={["과목별·요일별 공부시간 통계", "주간·월간 성장 리포트와 회고 일기", "배지와 칭호 모음"]}
    />
  );
}
