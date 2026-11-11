import { GRADES, SUBJECT_GROUPS, type GradeId, type SubjectGroup } from "@/data/curriculum";

/**
 * 다른 AI 에이전트에게 학습 유닛을 대량으로 만들게 할 때 쓰는 지시문.
 * 결과(JSON)는 관리 도구의 '일괄 넣기'(/admin/learn/import)에 그대로 붙여 넣는다.
 * 형식이 바뀌면 src/lib/learn/import.ts, sanitizeSteps(src/lib/learn/check.ts)와 함께 고친다.
 */
export interface AgentPromptInput {
  grade: GradeId;
  subject: SubjectGroup;
  section: string;
  count: number;
  /** 이미 있는 유닛 이름 (겹치지 않게) */
  existing: string[];
}

export function agentPrompt(input: AgentPromptInput): string {
  const grade = GRADES.find((g) => g.id === input.grade);
  const subject = SUBJECT_GROUPS.find((g) => g.id === input.subject)?.label ?? input.subject;
  const math = input.subject === "math" || input.subject === "science";
  return `너는 한국 중·고등학생용 학습 앱 '홈스터디'의 학습 콘텐츠 작성자야.
${grade?.label ?? input.grade} ${subject} 과목의 '${input.section}' 섹션에 들어갈 학습 유닛을 ${input.count}개 만들어 줘.
유닛 하나는 학생이 휴대폰으로 2~3분 동안 핵심 정리를 짧게 읽고 바로 문제를 푸는 분량이야.
${input.existing.length ? `이미 있는 유닛과 겹치지 않게 해: ${input.existing.join(", ")}\n` : ""}
[내용 규칙]
- 한국 교육과정(${grade?.curriculum ?? "2022"} 개정) 범위와 학년 수준에 맞게, 쉬운 해요체로 써.
- 유닛마다 핵심 정리 1~2개(각 5줄 이내) + 문제 5~7개. 유닛끼리는 쉬운 것에서 어려운 순서로.
- 문제 종류(choice, short, blank, puzzle)를 유닛마다 골고루 섞어.
- 확실하지 않은 내용은 넣지 마. 정답은 반드시 직접 다시 풀어서 확인해.

[출력 형식] 아래 JSON만 출력해. 설명 글을 붙이지 마.
{
  "grade": "${input.grade}",
  "subject": "${input.subject}",
  "section": "${input.section}",
  "units": [
    {
      "title": "유닛 이름 (15자 이내)",
      "steps": [
        { "type": "summary", "title": "정리 제목", "body": "마크다운 핵심 정리", "points": ["꼭 기억할 점"] },
        { "type": "choice", "prompt": "문제", "choices": ["보기1", "보기2", "보기3", "보기4"], "answer": "보기 중 하나와 글자까지 똑같이", "explanation": "해설" },
        { "type": "short", "prompt": "문제", "answers": ["정답", "같은 답의 다른 표기"], "explanation": "해설"${math ? ', "math": true' : ""} },
        { "type": "blank", "prompt": "빈칸에 알맞은 말을 고르세요.", "text": "빈칸이 될 낱말을 [[정답]]처럼 감싼 문장", "distractors": ["헷갈리는 낱말1", "헷갈리는 낱말2"], "explanation": "해설" },
        { "type": "puzzle", "prompt": "뜻풀이", "answer": "2~6글자 낱말", "decoys": "섞을 글자 2개", "explanation": "해설" }
      ]
    }
  ]
}

[형식 규칙]
- choice: 보기 3~4개, 번호(①, 1.)를 붙이지 마. answer는 보기 중 하나와 글자까지 같아야 해.
- short: 답이 짧고 하나로 분명한 것만. 같은 답의 다른 표기(예: 8, 8개)는 answers에 함께 넣어.${math ? ' 수식 답이면 "math": true.' : ""}
- blank: 빈칸은 1~2개. 빈칸 순서대로 채점하므로 순서가 바뀌어도 되는 두 빈칸은 만들지 마.
- puzzle: answer는 띄어쓰기 없는 2~6글자. decoys에는 answer에 없는 글자를 써.
- 수식은 $...$ 안에 쓰고, JSON이므로 백슬래시는 두 번 써($2^2 \\\\times 3$, $\\\\frac{1}{2}$). 한글은 $...$ 밖에 써.
- 그림이 도움이 되는 문제(도형, 그래프, 수직선, 표, 실험 장치)는 그 단계에 "figure": "<svg ...>...</svg>"를 넣어.
  SVG는 xmlns와 viewBox를 쓰고 가로 400 이하, 흰 바탕에 검은 선(stroke="#222"), 글자 크기 14 이상. 스크립트·외부 이미지는 쓰지 마.
  그림의 길이·눈금은 문제의 숫자와 정확히 맞게 그려. 문제 글에는 "그림에서"처럼 그림을 가리켜.`;
}
