# 홈스터디 명세 (SPEC)

중·고등학생이 스스로 공부 계획을 세우고, 복습하고, AI에게 묻고, 꾸준히 하도록 돕는 휴대폰용 웹앱(PWA).
단계별 상세 기록은 `PLAN.md`, 한 일과 남은 일은 `TASKS.md`, 작업 규칙은 `AGENTS.md`에 있다.

## 1. 확정된 방향

| 항목 | 결정 |
| --- | --- |
| 이름 | 홈스터디 (HomeStudy) |
| 형태 | 설치할 수 있는 웹앱(PWA), 휴대폰 화면 기준, 오프라인에서도 열림 |
| 사용자 | 여러 학생이 같은 비밀번호로 사용. 학생 화면 + 관리자용 관리 도구(다른 포트) |
| 로그인 | 비밀번호 하나 (`APP_PASSWORD`). 계정·회원가입 없음 |
| 과목 | 국어·영어·수학·사회·과학, 한국 교육과정 (중1~고3) |
| 데이터 | 학생 데이터는 기기 안(IndexedDB). 서버 DB(Node 내장 SQLite, `.data/homestudy.db`)에는 함께 쓰는 것만: 사용자 요약·관리자 명령, 자료 모음, 학습 과정. Supabase는 나중에 |
| AI | Gemini·Claude·OpenAI 중 하나를 환경 변수로 선택. 지금은 Gemini 사용 |
| 분위기 | 기본은 어른스러운 `noir`(림버스 컴퍼니 느낌), 귀여운 `cute`를 고를 수 있음 |
| 배포 | 아직 하지 않음 |

## 2. 기술 구성

- Next.js 16.4.5 (App Router, Turbopack), React 19, TypeScript, Tailwind v4
- 기기 저장: Dexie 4 (IndexedDB, 현재 5번째 버전) + `useLiveQuery`
- 서버 저장: `node:sqlite` (Node 22.13 이상, 설치할 패키지 없음, WAL 모드로 앱 서버와 관리 서버가 같은 파일을 씀)
- AI: Vercel AI SDK v7 (`ai`, `@ai-sdk/google|anthropic|openai`), zod로 답 형식 지정
- 알림: Web Push (`web-push`), 서버 시작 때 스케줄러 실행 (`src/instrumentation.ts`)
- 테스트: Vitest(단위 205개), Playwright(브라우저 21개, 가짜 AI, 앱 서버 3210 + 관리 서버 3211)

### 폴더

```
src/proxy.ts                로그인 게이트 (서명된 쿠키 확인)
src/app/login, onboarding   로그인, 첫 실행 설정
src/app/(app)/              로그인 뒤 화면 (AppShell: 위 막대 + 아래 메뉴 6개)
src/app/admin/              관리 도구 화면 (관리 서버에서만 열림)
src/app/api/auth|ai|push    서버 API
src/app/api/learn|bank|user 학습 과정·자료 모음·동기화 API
src/app/api/admin/          관리 API
src/components/             화면 부품 (ui.tsx, kit.tsx, game/, planner/, ai/, methods/)
src/lib/db/                 표 정의(types.ts), DB(index.ts), 기능별 저장 함수 (learn.ts 학습 진도, sync.ts 동기화·명령 적용)
src/lib/server/             서버 DB(db.ts), 사용자(users.ts), 자료 모음(bank.ts), 학습 과정(learn.ts), 관리 API 공통
src/lib/learn/              학습 탭 공용: 형식(types.ts), 채점(check.ts), 진행 순서(engine.ts)
src/lib/sync/types.ts       기기 ↔ 서버 동기화 형식과 명령 종류
src/lib/ai/                 provider(회사 선택) · service(호출) · usage(하루 사용량) · client(화면 쪽)
src/lib/game/               경험치·레벨·연속일·퀘스트·업적·상점
src/lib/study/              시험 계획 배분, 간격 복습, 타이머, 기억 지도, 성적 추이
src/lib/push/               알림 구독 저장과 예약
src/data/                   학습법, 진단 문항, 이야기(story.ts), 학습 탭 예제(learn/samples.ts) 등 고정 내용
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
| `ADMIN_PASSWORD` | 관리 도구 비밀번호 |
| `ADMIN_PORT` | 관리 서버 포트 (기본 3300, `npm run admin`) |
| `AI_LIMIT_UNIT` | 관리 도구의 AI 유닛 만들기 하루 횟수 (기본 50) |
| `HOMESTUDY_DB_NAME` | 서버 DB 파일 이름 (기본 `homestudy.db`) |

## 3. 화면과 기능 (모두 구현됨)

| 메뉴 | 주소 | 내용 |
| --- | --- | --- |
| 홈 | `/` | 동료(펫) 카드, 복귀 환영, 빠른 시작, 오늘의 학습 목표, 주간 목표, 퀘스트, 오늘 할 일, 오늘의 학습법, 공부 잔디 |
| 학습 | `/learn` | 듀오링고식 코스: 학년·과목 고르기 → 섹션(목차)별 유닛 길 → 유닛 `/learn/lesson`(핵심 정리 → 객관식·주관식·빈칸 채우기·낱말 퍼즐, 틀린 문제는 끝에 한 번 더, 수학은 수식 도구), 하루 목표 5분 |
| 플래너 | `/planner` | 일간·주간 할 일(추가, 고치기, 실제 공부 시간), 시험 D-day 역산 계획 `/planner/exam`, 고정 루틴 `/planner/routines`, 시험 결과 기록 |
| 타이머 | `/timer` | 뽀모도로·자유 집중, 끝나면 경험치와 할 일별 실제 시간 기록 |
| 복습 | `/review` | 암기 카드(간격 복습) `/review/cards`, 오답노트(사진 포함, 고치기, 다시 풀기) `/review/wrong`, 기억 지도와 7일 복습 예보 `/review/map` |
| AI 학습실 | `/ai` | 튜터(실시간 답, 사진 질문) `/ai/tutor`, 자료·문제 만들기(웹 검색 선택) `/ai/create`, 퀴즈 풀기와 피드백 `/ai/quiz`, 모두의 자료실 `/ai/library` |
| 학습법 | `/methods` | 학습법 안내, 학습 유형 진단, 연습 기록 |
| 성장 | `/growth` | 통계, 주간 리포트와 AI 코칭 `/growth/report`, 업적 `/growth/badges`, 성적 변화 `/growth/exams` |
| 동료 | `/companion` | 동료 성장 단계, 상점(코인), 칭호, 이야기 기록 `/companion/records` |
| 설정 | `/settings` | 이름·학년·하루 새 카드 수·테마, 과목 관리, 알림, 백업/복원(사진 포함) |

### 게임 요소
경험치와 레벨, 코인, 연속 학습일(보호권으로 하루 메움), 일간·주간·시험 퀘스트, 업적과 칭호, 상점, 오래 쉬었다 돌아오면 가벼운 복귀 퀘스트, 레벨이 오르면 열리는 이야기(본편 12편 + 외전 3편, 테마별 문체).

### 학습 탭 (듀오링고식)
- 코스 = 학년 × 과목, 섹션 = 교육과정 대표 단원(목차), 유닛 = 2~3분. 내용은 서버 DB(`learn_sections`, `learn_units`)에 있고, 받은 것은 기기(localStorage)에 저장해 오프라인에서도 이어서 한다.
- 단계 종류(`src/lib/learn/types.ts`): `summary`(핵심 정리), `choice`, `short`(정답 여러 개, 수식 표기 차이 무시), `blank`(문장의 `[[정답]]`이 빈칸, 낱말 상자에서 고름), `puzzle`(뜻풀이 + 글자 조각).
- 아직 끝내지 않은 첫 유닛이 '지금 할 유닛', 그 뒤는 잠김. 처음 끝내면 10 + 처음 맞힌 문제당 2 XP, 다시 하면 5 XP. 공부 시간은 단계당 최대 90초로 센다.
- 예제 유닛 3개(중1 수학)는 서버 DB를 처음 만들 때 들어간다(`src/lib/server/seed.ts`). 대량 데이터는 관리 도구(JSON 붙여넣기 또는 AI로 만들기)로 채운다.

### 자료 모음 (AI 학습실 결과 수집)
- 자료 정리·문제 만들기 결과를 서버 DB `bank_items`에 쌓는다. 같은 요청(학년·과목·주제, 띄어쓰기·문장 부호 무시 / 사진·PDF는 내용이 같으면)은 AI를 부르지 않고 쌓인 것을 준다 → 사용 횟수도 쓰지 않는다.
- 모두의 자료실 `/ai/library`: AI 없이 다른 학생이 만든 정리와 문제를 가져와 푼다.
- 관리 도구에서 고치거나 숨긴다(숨기면 같은 요청에 AI가 새로 만든다). 비슷한 주제끼리 '겹치는 자료'로 묶어 보여주고, 섹션을 고르면 어울리는 자료를 골라 AI가 겹치는 내용을 합쳐 유닛 초안을 만든다.

### 그림 (문제·설명)
- 그림은 서버 DB `media` 표에 저장하고 `/api/media?id=`로 보여준다(같은 그림은 한 번만 저장). 문제·정리 글에는 마크다운 그림 `![설명](/api/media?id=…)`으로 들어가고, 마크다운으로 그리는 모든 화면(학습 탭, AI 퀴즈, 오답노트, 자료실)에서 보인다. 흰 바탕(`--figure-bg`)에 그려서 어두운 테마에서도 보인다. 서비스 워커가 한 번 본 그림을 저장해 오프라인에서도 보인다. 암기 카드는 글자만 보여주므로 `[그림: 설명]`으로 바꾼다.
- AI 문제: 퀴즈·유닛 만들기 응답의 `figure`에 AI가 SVG 그림(도형, 그래프, 수직선, 표, 실험 장치 등)을 그린다(`FIGURE_RULES`, `src/lib/ai/prompts.ts`). 서버가 스크립트·이벤트·외부 링크를 지운 뒤(`src/lib/server/svg.ts`) 저장해서 문제 글 끝에 붙인다. 그림 칸이 없는 응답도 받는다.
- 관리 도구: 정리·문제·해설 칸(`ImageTextArea`)에 그림을 붙여넣기(Ctrl+V), 끌어다 놓기, '그림 넣기' 단추로 넣는다(PNG·JPG·WEBP·GIF·SVG, 5MB 이하, 큰 사진은 줄여서 올림). 넣은 그림은 칸 아래에 작게 보인다.
- `/api/media`는 학생 서버(앱 비밀번호)와 관리 서버(관리자 로그인) 둘 다에서 열린다.

### 관리 도구
- 같은 빌드를 `ADMIN_SERVER=1`로 다른 포트에 띄운 서버(`npm run admin`, 기본 3300)에서만 열린다. 이 서버는 `/admin`만 보여주고 `ADMIN_PASSWORD`로 로그인한다(12시간, 10분에 5번까지). 학생 서버에서 `/admin`·`/api/admin`은 404.
- 사용자: 기기가 앱을 열 때와 5분마다 요약(레벨·경험치·코인·연속 기록·학습 진도·학습 시간)을 `/api/user/sync`로 보낸다. 관리자는 이용 정지(학생 화면 잠김, AI·학습·자료실 요청 403), 메모, 경험치(레벨)·코인·보호권·이름 고치기, 유닛 완료 표시·진도 지우기를 한다. 고친 값은 '명령'으로 쌓였다가 기기가 다음 동기화 때 적용하고, 적용된 명령은 다시 보내지 않는다.
- 자료 모음: 목록·검색·고치기(객관식 정답이 보기에 없으면 저장 안 됨)·숨기기·지우기, 겹치는 자료 묶음.
- 학습 과정: 섹션 만들기·교육과정 목차로 채우기·순서·이름·지우기, 유닛 편집(단계별 화면 편집 또는 JSON), 초안/공개, AI로 유닛 만들기.
- 미리 풀기: 유닛 편집 화면의 "▶ 학생 화면으로 풀어 보기". 저장 전 내용으로 학생 학습 탭과 같은 부품(`src/components/learn/LessonPlayer.tsx`)을 휴대폰 크기 창에 띄워 끝까지 풀어 본다. 테마(누아르, 귀여운 밝게·어둡게)를 바꿔 볼 수 있고, 진도·경험치는 기록하지 않는다.
- 일괄 넣기 `/admin/learn/import`: 다른 AI 에이전트로 만든 유닛 JSON(코스 하나 또는 배열, ```json 감싸기 허용, 여러 파일)을 검사한 뒤 넣는다. 섹션은 이름으로 찾고 없으면 만든다. 단계에 `figure`(SVG)가 있으면 그림으로 저장한다. 문제 있는 유닛과 같은 섹션의 같은 이름 유닛은 건너뛴다. 기본은 초안, 선택하면 바로 공개. 학년·과목·섹션을 고르면 에이전트용 지시문(`src/data/learn/agentPrompt.ts`)을 만들어 복사할 수 있다(이미 있는 유닛 이름을 넣어 겹치지 않게). 형식 읽기 `src/lib/learn/import.ts`, 넣기 `src/lib/server/learn-import.ts`. 다른 AI가 자주 내는 실수를 고쳐 읽는다: 그림 속 큰따옴표, `\(`·`\dots` 같은 JSON에서 안 되는 백슬래시, `\( \)`·`\[ \]` 수식 표기(→ `$`·`$$`). 고칠 수 없으면 깨진 줄·칸과 근처 글을 보여준다. 그림이 깨진(태그가 닫히지 않음, `</svg>` 없음 등) 유닛은 이유와 함께 건너뛴다.

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

표: `profile`(한 줄, id `me`), `subjects`, `tasks`, `exams`, `studySessions`, `decks`, `cards`, `wrongNotes`, `images`, `xpEvents`, `quizzes`, `materials`, `methodLogs`, `coachReports`, `routines`, `learnProgress`(유닛 진도), `learnLogs`(학습 기록).

서버 DB(`src/lib/server/db.ts`, `PRAGMA user_version`으로 버전 관리, 지금 3번째 버전): `users`, `user_commands`, `bank_items`, `learn_sections`, `learn_units`, `media`(그림). 구조를 바꿀 때는 `MIGRATIONS`에 새 항목을 덧붙인다(기존 항목은 고치지 않는다).
정확한 필드는 `src/lib/db/types.ts`, 버전 이력은 `src/lib/db/index.ts`.

## 5. 품질 기준

- 휴대폰 폭에서 가로 스크롤 없음, 두 테마와 밝은/어두운 화면 모두 정상
- 브라우저 콘솔 오류 0 (브라우저 테스트가 확인), 접근성 검사(axe) 위반 0
- 단위 테스트, lint, typecheck, 브라우저 테스트 전부 통과
