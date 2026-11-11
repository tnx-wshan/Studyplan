<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 홈스터디 작업 규칙 (이 저장소에서 일하는 에이전트용)

먼저 읽을 문서: `SPEC.md`(무엇을 만드는 앱인지, 구조), `TASKS.md`(한 일과 남은 일), `PLAN.md`(단계별 상세 기록).

### 사용자와 소통
- 사용자는 한국어를 쓴다. 답변, 화면 문구, 코드 주석, 문서는 한국어로 쓴다. 커밋 메시지는 영어.
- 화면 문구는 중·고등학생이 읽는 말투(해요체). 누아르 테마 문구는 짧고 건조한 평서체.
- 게임 요소는 유치하지 않게: 림버스 컴퍼니처럼 어른스러운 분위기가 기본(`noir`), 귀여운 테마(`cute`)는 선택.

### 명령
```
npm run dev          # 개발 서버 (비밀번호는 .env.local의 APP_PASSWORD)
npm run dev:admin    # 관리 도구 개발 서버 (포트 3300, ADMIN_PASSWORD)
npm test             # 단위 테스트 (Vitest)
npm run lint && npm run typecheck
npm run build && npm run e2e -- --trace off   # 브라우저 테스트 (가짜 AI, 포트 3210)
```
- 브라우저 테스트는 **빌드한 결과**를 띄운다. 코드를 바꿨으면 반드시 다시 빌드한 뒤 실행한다.
- 서버를 직접 띄웠다면 다시 빌드하기 전에 꼭 끈다(`pkill -f next`). 옛 서버가 남아 있으면 없는 파일을 가리켜 500이 난다.
- 작업을 끝내기 전에 단위 테스트, lint, typecheck, 브라우저 테스트가 모두 통과해야 한다. 테스트를 건너뛰거나 재시도 설정으로 가리지 않는다.

### 꼭 지킬 것
- **비밀 값**: `.env.local`은 커밋하지 않는다. AI 키를 코드, 문서, 테스트, 커밋 메시지에 쓰지 않는다.
- **서버 컴포넌트는 "use client" 파일에서 컴포넌트가 아닌 값(문자열·상수)을 가져오지 않는다.** 가져오면 값이 '클라이언트 참조'가 되어 첫 방문 때 React 오류 #418이 난다. 함께 쓰는 값은 `src/lib/theme.ts`처럼 일반 모듈에 둔다.
- **`next.config.ts`의 `cacheComponents`, `partialPrefetching`을 켜지 않는다.** 로그인 직후 화면이 멈춘다.
- 인증 게이트는 `src/proxy.ts`(이 Next 버전에서는 middleware 대신 proxy). 페이지 파일(`page.tsx`)은 기본 내보내기 외의 이름을 내보내면 안 된다.
- 학생 데이터는 기기 안 IndexedDB(Dexie, `src/lib/db`)에 있다. 표 구조를 바꾸면 `src/lib/db/index.ts`에 **새 버전**을 추가한다(기존 버전은 고치지 않는다). 백업/복원(`settings`)에도 새 표를 넣는다.
- AI 호출은 `src/lib/ai/service.ts`를 거친다: 제한 시간, 예비 모델 전환(`withFallback`), 하루 사용량(`withQuota`)을 빠뜨리지 않는다. 새 AI 기능은 가짜 AI(`AI_PROVIDER=mock`)에서도 동작해야 한다.
- 화면은 휴대폰 폭(390px) 기준. 색은 `globals.css`의 토큰만 쓰고, 두 테마(`noir`/`cute`)와 밝은/어두운 화면 모두 확인한다. 접근성(이름 있는 버튼, 대비)을 지킨다.
- 날짜는 `src/lib/date.ts`의 `toDateKey()`(기기 시간대)로 다룬다. 서버의 하루 사용량만 서울 기준.
- 서버 DB(`src/lib/server/db.ts`, node:sqlite)의 구조를 바꾸면 `MIGRATIONS`에 새 항목을 덧붙인다. 관리 화면·API는 관리 서버(`ADMIN_SERVER=1`)에서만 열리게 `src/proxy.ts`가 막는다. 관리 API는 `admin()`(`src/lib/server/admin-api.ts`)으로 감싼다.
- 학습 탭 문제는 저장 전에 `sanitizeSteps`(`src/lib/learn/check.ts`)로 검사한다.

### Git과 작업 흐름
- **기준 브랜치는 `main`이다.** `main`은 언제나 단위·lint·typecheck·브라우저 테스트가 모두 통과하는 상태로 둔다. `main`에 직접 커밋·푸시하지 않는다.
- **작업은 작업 브랜치에서 한다.** 세션에 지정된 작업 브랜치가 있으면 그 브랜치를, 없으면 `main`에서 새 브랜치를 만든다. 시작하기 전에 `main` 최신을 받아 그 위에서 시작한다(`git fetch origin main` 후 `main`에서 갈라지거나, 이미 있는 브랜치면 `main`을 합친다).
- **한 브랜치에는 한 가지 일만.** '기능 다듬기'와 '공부 콘텐츠 추가'는 서로 다른 브랜치·PR로 나눈다. 그래야 콘텐츠만 따로 검토하고 되돌릴 수 있다.
- **합치기 전에**: `main`이 그사이 앞서 나갔으면 `main`을 작업 브랜치에 합친 뒤 모든 테스트를 다시 돌린다. 다른 세션이 같은 파일을 고쳤으면 충돌은 양쪽 수정을 모두 살리는 쪽으로 푼다. `TASKS.md`(한 일·남은 일·테스트 수)와 관련 문서(`SPEC.md`, `PLAN.md`)를 고친다.
- **`main`에는 PR로만 합친다.** 작업이 끝나면 사용자에게 PR을 만들지 묻고, 사용자가 요청할 때만 만든다. PR 설명에는 바꾼 것, 확인한 테스트, 사용자가 직접 해야 할 일(서버 재시작, `.env.local` 값 등)을 적는다. 합치기(merge)는 사용자가 한다.
- 합쳐진 PR의 브랜치는 다시 쓰지 않는다. 이어서 할 일은 최신 `main`에서 새로 시작한다.
- 커밋 메시지는 영어, 무엇을 왜 바꿨는지 쓴다. 비밀 값은 넣지 않는다.
- 이 파일 맨 위 Next.js 블록은 `next dev`가 다시 써넣으므로 지우지 않는다.

### 공부 콘텐츠를 넣을 때
- 학습 탭 내용(섹션·유닛)은 **서버 DB**에 있다. 코드의 예제(`src/data/learn/samples.ts`)는 **새로 만든 DB에만** 한 번 들어가므로, 이미 쓰고 있는 DB에는 반영되지 않는다. 기존 DB에 넣으려면 관리 도구의 **일괄 넣기**(`/admin/learn/import`, 에이전트용 지시문도 여기서 만든다)나 유닛 JSON 편집, AI로 유닛 만들기를 쓰고, 코드로 꼭 넣어야 하면 `MIGRATIONS`에 새 항목으로 추가한다.
- 넣는 유닛은 `sanitizeSteps`를 통과해야 한다(객관식 정답이 보기에 있음, 빈칸 `[[ ]]` 있음, 퍼즐 낱말 2~10글자). 한 유닛은 2~3분(핵심 정리 1~2개 + 문제 5~7개), 다섯 가지 단계 종류를 골고루 쓴다.
- 수식은 `$...$`로 쓰고, JSON으로 넣을 때는 백슬래시를 두 번 쓴다(`"\\times"`). 한 번만 쓰면 저장할 때 보정하지만 처음부터 바르게 쓴다.
- 섹션은 교육과정 대표 단원(`src/data/curriculum.ts`)을 따른다. 내용이 교육과정과 맞는지, 학년 수준에 맞는지 확인한다.
- 그림은 서버에 저장하고 글에 `![설명](/api/media?id=…)`로 넣는다(관리 도구에서 붙여넣기, 코드로는 `saveMedia`/`figureMarkdown`, `src/lib/server/media.ts`). 외부 주소의 그림을 직접 쓰지 않는다(오프라인·저작권). 설명(alt)을 쓴다. 교과서·문제집 그림은 저작권을 확인한 것만 넣는다.
