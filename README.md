# 홈스터디

펫과 함께 성장하는 중·고등학생 자기주도 학습 웹앱(PWA)입니다. 전체 계획은 [PLAN.md](./PLAN.md)를 보세요.

## 실행 방법

```bash
npm install
cp .env.example .env.local   # APP_PASSWORD, SESSION_SECRET 값을 채웁니다
npm run dev                  # http://localhost:3000
```

- `.env.local`은 저장소에 올라가지 않습니다. 비밀번호를 바꾸면 기존 로그인은 모두 풀립니다.
- 알림: 처음 켤 때 VAPID 키가 `.data/push.json`에 자동으로 만들어져요. 직접 정하려면 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- AI 기능: `AI_PROVIDER`(gemini · claude · openai)와 그 회사의 키 하나를 넣으세요. 키 없이 화면만 보려면 `AI_PROVIDER=mock`.
- 홈 화면 설치와 오프라인 지원(서비스 워커)은 `npm run build && npm start`로 실행한 경우에만 동작합니다.

## 검사

```bash
npm test          # 단위 테스트 (Vitest)
npm run typecheck
npm run lint
npm run build
```

## 구조

| 경로 | 내용 |
|---|---|
| `src/proxy.ts`, `src/lib/auth.ts` | 비밀번호 잠금 (서명된 쿠키 세션) |
| `src/lib/db/` | 기기 저장소(IndexedDB, Dexie) 스키마, 프로필, 백업 |
| `src/lib/db/study.ts` | 할 일, 시험 계획, 집중 기록, 카드, 오답, 과목, 퀘스트 저장 |
| `src/lib/study/` | 간격 반복(SM-2), 시험 D-day 역산, 오답 재풀이 간격, 집중 타이머 상태 기계 |
| `src/lib/game/` | 레벨·경험치, 펫 성장·기분, 연속 학습일, 일일 퀘스트 |
| `src/lib/ai/` | AI 회사 선택, 지시문, 응답 형식, 튜터·자료·퀴즈 생성, 하루 사용량, 가짜 AI |
| `src/app/api/ai/` | AI 서버 API (status, tutor, material, quiz) |
| `src/lib/db/ai.ts` | 튜터 대화, 자료, 퀴즈 저장과 오답노트·카드 연동 |
| `src/data/methods.ts`, `src/data/diagnosis.ts` | 학습법 15가지와 상황별 추천, 공부 습관 진단 문항·채점 |
| `src/lib/study/report.ts`, `period.ts` | 주간·월간 리포트 집계, ISO 주 계산 |
| `src/lib/db/coaching.ts` | 진단, 학습법 실습 기록, 회고, AI 코칭 저장 |
| `src/lib/game/achievements.ts`, `companion.ts`, `src/data/shop.ts` | 주간·시험 퀘스트, 업적, 테마별 동료 이름·문구, 꾸미기 아이템 |
| `src/lib/db/game.ts` | 퀘스트 보상, 업적 기록, 칭호, 상점 구매·착용, 테마 |
| `src/lib/push/` | 알림 시각 계산, 구독 저장·발송·스케줄러 (`src/instrumentation.ts`에서 시작) |
| `src/data/curriculum.ts` | 국·영·수·사·과 교육과정 기본 데이터 (중1~고3) |
| `src/components/` | 게임 UI 컴포넌트, 펫 SVG, 앱 셸 |
| `src/app/` | 화면 (홈, 플래너·시험 계획, 타이머, 복습·카드·오답노트, AI 학습실·튜터·문제 만들기·퀴즈, 학습법·실습·진단, 성장·리포트·회고, 설정·과목 관리, 로그인, 첫 실행) |
| `public/sw.js` | 서비스 워커 |
