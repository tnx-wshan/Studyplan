# 홈스터디 명세 (SPEC)

중·고등학생이 스스로 공부 계획을 세우고, 복습하고, AI에게 묻고, 꾸준히 하도록 돕는 휴대폰용 웹앱(PWA).
단계별 상세 기록은 `PLAN.md`, 한 일과 남은 일은 `TASKS.md`, 작업 규칙은 `AGENTS.md`에 있다.

## 1. 확정된 방향

| 항목 | 결정 |
| --- | --- |
| 이름 | 홈스터디 (HomeStudy) |
| 형태 | 설치할 수 있는 웹앱(PWA), 휴대폰 화면 기준, 오프라인에서도 열림 |
| 사용자 | 지금은 한 명(만든 사람)만 사용. 학생 전용 화면만 있음 (부모·교사 화면 없음) |
| 로그인 | 비밀번호 하나 (`APP_PASSWORD`). 계정·회원가입 없음 |
| 과목 | 국어·영어·수학·사회·과학, 한국 교육과정 (중1~고3) |
| 데이터 | 학생 데이터는 기기 안(IndexedDB)에 저장. 서버 DB 없음. Supabase 동기화는 나중에 |
| AI | Gemini·Claude·OpenAI 중 하나를 환경 변수로 선택. 지금은 Gemini 사용 |
| 분위기 | 기본은 어른스러운 `noir`(림버스 컴퍼니 느낌), 귀여운 `cute`를 고를 수 있음 |
| 배포 | 아직 하지 않음 |

## 2. 기술 구성

- Next.js 16.4.5 (App Router, Turbopack), React 19, TypeScript, Tailwind v4
- 기기 저장: Dexie 4 (IndexedDB, 현재 4번째 버전) + `useLiveQuery`
- AI: Vercel AI SDK v7 (`ai`, `@ai-sdk/google|anthropic|openai`), zod로 답 형식 지정
- 알림: Web Push (`web-push`), 서버 시작 때 스케줄러 실행 (`src/instrumentation.ts`)
- 테스트: Vitest(단위 150개), Playwright(브라우저 17개, 가짜 AI)

### 폴더

```
src/proxy.ts                로그인 게이트 (서명된 쿠키 확인)
src/app/login, onboarding   로그인, 첫 실행 설정
src/app/(app)/              로그인 뒤 화면 (AppShell: 위 막대 + 아래 메뉴 5개)
src/app/api/auth|ai|push    서버 API
src/components/             화면 부품 (ui.tsx, kit.tsx, game/, planner/, ai/, methods/)
src/lib/db/                 표 정의(types.ts), DB(index.ts), 기능별 저장 함수
src/lib/ai/                 provider(회사 선택) · service(호출) · usage(하루 사용량) · client(화면 쪽)
src/lib/game/               경험치·레벨·연속일·퀘스트·업적·상점
src/lib/study/              시험 계획 배분, 간격 복습, 타이머, 기억 지도, 성적 추이
src/lib/push/               알림 구독 저장과 예약
src/data/                   학습법, 진단 문항, 이야기(story.ts) 등 고정 내용
public/sw.js                서비스 워커 (오프라인 저장, 푸시)
e2e/                        브라우저 테스트
```

### 환경 변수 (`.env.local`, 커밋 금지. 예시는 `.env.example`)

| 이름 | 뜻 |
| --- | --- |
| `APP_PASSWORD`, `SESSION_SECRET` | 로그인 비밀번호, 쿠키 서명 값 |
| `AI_PROVIDER` | `gemini` · `claude` · `openai` · `mock`(가짜 AI) |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 고른 회사의 키 하나 |
| `AI_MODEL`, `AI_MODEL_FALLBACKS` | 모델 바꾸기, 예비 모델들(쉼표). Gemini 기본 `gemini-3.5-flash` → `gemini-flash-lite-latest`, `gemini-flash-latest` |
| `AI_LIMIT_TUTOR|QUIZ|MATERIAL|COACH` | 하루 횟수 제한 (기본 30 / 10 / 10 / 10) |
| `VAPID_*` | 푸시 알림 키 |

## 3. 화면과 기능 (모두 구현됨)

| 메뉴 | 주소 | 내용 |
| --- | --- | --- |
| 홈 | `/` | 동료(펫) 카드, 복귀 환영, 빠른 시작, 주간 목표, 퀘스트, 오늘 할 일, 오늘의 학습법, 공부 잔디 |
| 플래너 | `/planner` | 일간·주간 할 일(추가, 고치기, 실제 공부 시간), 시험 D-day 역산 계획 `/planner/exam`, 고정 루틴 `/planner/routines`, 시험 결과 기록 |
| 타이머 | `/timer` | 뽀모도로·자유 집중, 끝나면 경험치와 할 일별 실제 시간 기록 |
| 복습 | `/review` | 암기 카드(간격 복습) `/review/cards`, 오답노트(사진 포함, 고치기, 다시 풀기) `/review/wrong`, 기억 지도와 7일 복습 예보 `/review/map` |
| AI 학습실 | `/ai` | 튜터(실시간 답, 사진 질문) `/ai/tutor`, 자료·문제 만들기(웹 검색 선택) `/ai/create`, 퀴즈 풀기와 피드백 `/ai/quiz` |
| 학습법 | `/methods` | 학습법 안내, 학습 유형 진단, 연습 기록 |
| 성장 | `/growth` | 통계, 주간 리포트와 AI 코칭 `/growth/report`, 업적 `/growth/badges`, 성적 변화 `/growth/exams` |
| 동료 | `/companion` | 동료 성장 단계, 상점(코인), 칭호, 이야기 기록 `/companion/records` |
| 설정 | `/settings` | 이름·학년·하루 새 카드 수·테마, 과목 관리, 알림, 백업/복원(사진 포함) |

### 게임 요소
경험치와 레벨, 코인, 연속 학습일(보호권으로 하루 메움), 일간·주간·시험 퀘스트, 업적과 칭호, 상점, 오래 쉬었다 돌아오면 가벼운 복귀 퀘스트, 레벨이 오르면 열리는 이야기(본편 12편 + 외전 3편, 테마별 문체).

### AI 동작 원칙
- 모든 요청에 제한 시간이 있다. 붐비거나(503) 요청이 너무 많으면(429) 1.5초·4초 기다렸다 같은 모델로 다시 하고, 그래도 안 되면 예비 모델로 넘어간다. 지출 한도·키 오류는 재시도하지 않는다.
- 웹 검색이 실패하면 검색 없이 답하고 그 사실을 화면에 알린다.
- 실패하면 사용 횟수를 돌려주고, 학생이 이해할 말로 이유를 알린다 (`src/lib/ai/route-helpers.ts`).
- 하루 사용량은 서버의 `.data/ai-usage.json`에 서울 날짜 기준으로 저장한다.

### 공개 화면
`/login`, `/intro`(소개 페이지)만 로그인 없이 열린다 (`src/proxy.ts`의 `PUBLIC_PATHS`).

### 확인 창
`confirm`/`prompt`는 쓰지 않는다. `askConfirm`, `askText`(`src/components/Dialogs.tsx`)를 쓴다.

## 4. 데이터 (기기 안 Dexie)

표: `profile`(한 줄, id `me`), `subjects`, `tasks`, `exams`, `studySessions`, `decks`, `cards`, `wrongNotes`, `images`, `xpEvents`, `quizzes`, `materials`, `methodLogs`, `coachReports`, `routines`.
정확한 필드는 `src/lib/db/types.ts`, 버전 이력은 `src/lib/db/index.ts`.

## 5. 품질 기준

- 휴대폰 폭에서 가로 스크롤 없음, 두 테마와 밝은/어두운 화면 모두 정상
- 브라우저 콘솔 오류 0 (브라우저 테스트가 확인), 접근성 검사(axe) 위반 0
- 단위 테스트, lint, typecheck, 브라우저 테스트 전부 통과
