/**
 * 교육과정 기본 데이터 (국·영·수·사·과)
 *
 * 2026학년도 기준 적용 교육과정:
 *   - 중1·중2·고1·고2: 2022 개정 교육과정
 *   - 중3·고3: 2015 개정 교육과정 (2027학년도부터 2022 개정으로 전환)
 *
 * 단원 이름은 교과서 출판사마다 조금씩 다르므로 '대표 단원'만 담는다.
 * 단원 목록이 비어 있는 선택과목은 학생이 직접 단원을 추가해서 쓴다(1단계 과목 관리 화면).
 */

export type SchoolLevel = "middle" | "high";
export type GradeId = "m1" | "m2" | "m3" | "h1" | "h2" | "h3";
export type SubjectGroup = "korean" | "english" | "math" | "social" | "science";
export type CurriculumVersion = "2015" | "2022";

export const GRADES: { id: GradeId; label: string; level: SchoolLevel; curriculum: CurriculumVersion }[] = [
  { id: "m1", label: "중학교 1학년", level: "middle", curriculum: "2022" },
  { id: "m2", label: "중학교 2학년", level: "middle", curriculum: "2022" },
  { id: "m3", label: "중학교 3학년", level: "middle", curriculum: "2015" },
  { id: "h1", label: "고등학교 1학년", level: "high", curriculum: "2022" },
  { id: "h2", label: "고등학교 2학년", level: "high", curriculum: "2022" },
  { id: "h3", label: "고등학교 3학년", level: "high", curriculum: "2015" },
];

export const SUBJECT_GROUPS: { id: SubjectGroup; label: string; short: string; color: string }[] = [
  { id: "korean", label: "국어", short: "국", color: "#ef6b6b" },
  { id: "english", label: "영어", short: "영", color: "#5b8def" },
  { id: "math", label: "수학", short: "수", color: "#d4881c" },
  { id: "social", label: "사회", short: "사", color: "#47b881" },
  { id: "science", label: "과학", short: "과", color: "#9b6bdf" },
];

export interface Course {
  id: string;
  grade: GradeId;
  group: SubjectGroup;
  name: string;
  /** 수능 출제 과목 여부(고3 기준) */
  csat?: boolean;
  units: string[];
}

const KOREAN_DOMAINS = ["듣기·말하기", "읽기", "쓰기", "문법", "문학", "매체"];
const ENGLISH_DOMAINS = ["듣기", "말하기", "읽기", "쓰기", "어휘", "문법"];
const SCIENCE_DOMAINS = ["운동과 에너지(물리)", "물질(화학)", "생명(생명과학)", "지구와 우주(지구과학)"];

type CourseSeed = Omit<Course, "id" | "grade" | "group">;

const SEED: Record<GradeId, Record<SubjectGroup, CourseSeed[]>> = {
  m1: {
    korean: [{ name: "국어", units: KOREAN_DOMAINS }],
    english: [{ name: "영어", units: ENGLISH_DOMAINS }],
    math: [
      {
        name: "수학",
        units: [
          "소인수분해",
          "정수와 유리수",
          "문자의 사용과 식의 계산",
          "일차방정식",
          "좌표평면과 그래프",
          "기본 도형",
          "작도와 합동",
          "평면도형의 성질",
          "입체도형의 성질",
          "자료의 정리와 해석",
        ],
      },
    ],
    social: [{ name: "사회", units: ["지리 영역", "일반사회 영역"] }],
    science: [{ name: "과학", units: SCIENCE_DOMAINS }],
  },
  m2: {
    korean: [{ name: "국어", units: KOREAN_DOMAINS }],
    english: [{ name: "영어", units: ENGLISH_DOMAINS }],
    math: [
      {
        name: "수학",
        units: [
          "유리수와 순환소수",
          "식의 계산",
          "일차부등식",
          "연립일차방정식",
          "일차함수와 그래프",
          "일차함수와 일차방정식의 관계",
          "삼각형의 성질",
          "사각형의 성질",
          "도형의 닮음",
          "피타고라스 정리",
          "경우의 수와 확률",
        ],
      },
    ],
    social: [
      { name: "사회", units: ["지리 영역", "일반사회 영역"] },
      { name: "역사", units: ["세계사 영역", "한국사 영역"] },
    ],
    science: [{ name: "과학", units: SCIENCE_DOMAINS }],
  },
  m3: {
    korean: [{ name: "국어", units: KOREAN_DOMAINS }],
    english: [{ name: "영어", units: ENGLISH_DOMAINS }],
    math: [
      {
        name: "수학",
        units: [
          "제곱근과 실수",
          "다항식의 곱셈과 인수분해",
          "이차방정식",
          "이차함수",
          "삼각비",
          "원의 성질",
          "대푯값과 산포도",
          "상관관계",
        ],
      },
    ],
    social: [
      { name: "사회", units: ["지리 영역", "일반사회 영역"] },
      { name: "역사", units: ["세계사 영역", "한국사 영역"] },
    ],
    science: [{ name: "과학", units: SCIENCE_DOMAINS }],
  },
  h1: {
    korean: [
      { name: "공통국어1", units: KOREAN_DOMAINS },
      { name: "공통국어2", units: KOREAN_DOMAINS },
    ],
    english: [
      { name: "공통영어1", units: ENGLISH_DOMAINS },
      { name: "공통영어2", units: ENGLISH_DOMAINS },
    ],
    math: [
      {
        name: "공통수학1",
        units: [
          "다항식의 연산",
          "항등식과 나머지정리",
          "인수분해",
          "복소수와 이차방정식",
          "이차방정식과 이차함수",
          "여러 가지 방정식과 부등식",
          "경우의 수",
          "행렬",
        ],
      },
      {
        name: "공통수학2",
        units: [
          "평면좌표",
          "직선의 방정식",
          "원의 방정식",
          "도형의 이동",
          "집합",
          "명제",
          "함수",
          "유리함수와 무리함수",
        ],
      },
    ],
    social: [
      {
        name: "통합사회1",
        units: ["통합적 관점", "인간, 사회, 환경과 행복", "자연환경과 인간", "문화와 다양성", "생활공간과 사회"],
      },
      {
        name: "통합사회2",
        units: [
          "인권 보장과 헌법",
          "사회정의와 불평등",
          "시장경제와 지속가능발전",
          "국제 사회와 평화",
          "미래와 지속가능한 삶",
        ],
      },
      { name: "한국사1", units: [] },
      { name: "한국사2", units: [] },
    ],
    science: [
      { name: "통합과학1", units: ["과학의 기초", "물질과 규칙성", "시스템과 상호작용"] },
      { name: "통합과학2", units: ["변화와 다양성", "환경과 에너지", "과학과 미래 사회"] },
    ],
  },
  h2: {
    korean: [
      { name: "화법과 언어", units: [] },
      { name: "독서와 작문", units: [] },
      { name: "문학", units: [] },
    ],
    english: [
      { name: "영어Ⅰ", units: [] },
      { name: "영어Ⅱ", units: [] },
      { name: "영어 독해와 작문", units: [] },
    ],
    math: [
      { name: "대수", units: ["지수와 로그", "지수함수와 로그함수", "삼각함수", "수열"] },
      { name: "미적분Ⅰ", units: ["함수의 극한과 연속", "미분", "적분"] },
      { name: "확률과 통계", units: ["경우의 수", "확률", "통계"] },
    ],
    social: [
      { name: "세계시민과 지리", units: [] },
      { name: "사회와 문화", units: [] },
      { name: "현대사회와 윤리", units: [] },
      { name: "세계사", units: [] },
    ],
    science: [
      { name: "물리학", units: [] },
      { name: "화학", units: [] },
      { name: "생명과학", units: [] },
      { name: "지구과학", units: [] },
    ],
  },
  h3: {
    korean: [
      { name: "독서", csat: true, units: [] },
      { name: "문학", csat: true, units: [] },
      { name: "화법과 작문", csat: true, units: [] },
      { name: "언어와 매체", csat: true, units: [] },
    ],
    english: [
      {
        name: "영어(수능)",
        csat: true,
        units: ["듣기", "주제·요지·제목", "빈칸 추론", "순서·문장 삽입", "요약문", "어법", "어휘", "장문 독해"],
      },
    ],
    math: [
      { name: "수학Ⅰ", csat: true, units: ["지수함수와 로그함수", "삼각함수", "수열"] },
      { name: "수학Ⅱ", csat: true, units: ["함수의 극한과 연속", "미분", "적분"] },
      { name: "미적분", csat: true, units: ["수열의 극한", "미분법", "적분법"] },
      { name: "확률과 통계", csat: true, units: ["경우의 수", "확률", "통계"] },
      { name: "기하", csat: true, units: ["이차곡선", "평면벡터", "공간도형과 공간좌표"] },
    ],
    social: [
      "생활과 윤리",
      "윤리와 사상",
      "한국지리",
      "세계지리",
      "동아시아사",
      "세계사",
      "경제",
      "정치와 법",
      "사회·문화",
    ].map((name) => ({ name, csat: true, units: [] })),
    science: ["물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ", "물리학Ⅱ", "화학Ⅱ", "생명과학Ⅱ", "지구과학Ⅱ"].map(
      (name) => ({ name, csat: true, units: [] }),
    ),
  },
};

export const COURSES: Course[] = (Object.keys(SEED) as GradeId[]).flatMap((grade) =>
  (Object.keys(SEED[grade]) as SubjectGroup[]).flatMap((group) =>
    SEED[grade][group].map((c, i) => ({ ...c, id: `${grade}-${group}-${i + 1}`, grade, group })),
  ),
);

export function coursesFor(grade: GradeId, group?: SubjectGroup): Course[] {
  return COURSES.filter((c) => c.grade === grade && (!group || c.group === group));
}

export function gradeLabel(id: GradeId): string {
  return GRADES.find((g) => g.id === id)?.label ?? id;
}

/** 처음 과목을 만들 때 연결할 교육과정 과목: 선택지가 2개 이하이면 모두, 많으면(선택과목) 비워두고 학생이 고른다. */
export function defaultCourseIds(grade: GradeId, group: SubjectGroup): string[] {
  const list = coursesFor(grade, group);
  return list.length <= 2 ? list.map((c) => c.id) : [];
}

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

/** 과목의 단원 목록: 연결한 교육과정 단원 + 직접 추가한 단원 (중복 제거, 순서 유지) */
export function unitsForSubject(subject: { courseIds: string[]; customUnits: string[] }): string[] {
  const units = subject.courseIds.flatMap((id) => courseById(id)?.units ?? []);
  return [...new Set([...units, ...subject.customUnits])];
}

/**
 * 학습 과정 '교육과정 대표 단원으로 섹션 채우기'의 기준 설명.
 * 출판사 교과서의 목차가 아니라, 이 파일에 담은 교육과정 대표 단원이다.
 */
export function curriculumSourceLabel(course: Course): string {
  const version = GRADES.find((g) => g.id === course.grade)?.curriculum ?? "";
  return `${version} 개정 교육과정 · ${course.name} 대표 단원`;
}
