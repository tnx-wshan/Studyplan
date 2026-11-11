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

### Git
- 지정된 작업 브랜치에서만 커밋·푸시한다. PR은 사용자가 요청할 때만 만든다.
- 이 파일 맨 위 Next.js 블록은 `next dev`가 다시 써넣으므로 지우지 않는다.
