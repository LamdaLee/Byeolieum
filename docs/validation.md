# 검증 기록 v0.3

2026-10-08. Node.js 24.19.0 / npm 11.9.0 / Next.js 16.4.0.

- `npm run lint`: 오류·경고 없음.
- `npm test`: 단위 테스트 13개 통과. 선택 원본과 요구사항 반영, 기존 기록 자동 보완, 위치 자료 검증, AI 입출력 원본 근거 검사, 보관함 직렬화·제한·손상 자료 거부·완료 조건·실험 도움 프롬프트.
- `npm run build`: TypeScript 포함 프로덕션 빌드 통과.
- 프로덕션 Chromium 검사 25개 통과. 카드 CRUD/텍스트 안전성, 선택 연결, 드래그/키보드 이동, 위치 저장, 자동 AI 호출 없음, 후보 근거/선택, 한 질문씩 진행/복원, 프롬프트 생성/편집/복사, 원본 삭제, 초기화/손상 기록, 50개 카드 페이지 처리, 느린 AI와 취소된 응답, 모바일, HTTP 입력/출처/본문 크기/키 없음 검사.
- 보관함/실험 브라우저 검사 8개 통과. 320px·390px·1280px에서 기존 편집 프롬프트 유지, 독립 스냅샷, 수정본/별도 저장, 실험 완료 조건, 과제 변경 시 재확인, 기록 복원, 불러오기, 삭제 확인, JSON 내려받기, API 요청 없음, 가로 넘침 없음. 추가로 손상 보관함 보존, 저장 차단, 용량 부족, 미저장 카드 편집 보호, 30개 제한 및 갱신 검사.
- v0.2에서 모의 OpenAI 공급자를 연결한 실제 서버 경로 검사 5개 통과. 해당 서버 코드는 이번 변경에서 수정하지 않았다. 모델·JSON schema 요청 형식, 성공 결과, 존재하지 않는 원본 거부, 공급자 한도 안내, 분당 제한과 자동 재시도 없음.

## 성능 관찰

데스크톱 1440×1000, 모바일 390×844. 이 환경에서 실제 드래그 중 프레임 간격 p95 **16.7ms**, CDP 4배 CPU 감속 시 선택 상태가 다음 프레임에 반영되는 시간 **6.2ms**. 테스트 예산은 각각 50ms/100ms 이하. 성능 값은 이 실행 환경의 관찰이며 모든 기기/네트워크의 보장은 아니다.

직접 제작한 작업실/보관함 JS 청크는 gzip 약 **17.1KB**(React/Next 런타임 제외). 대형 그래프 라이브러리, AI SDK, 외부 글꼴 없이 구현했다. 드래그 중 DOM 좌표만 RAF 갱신, 시작할 때만 크기 측정, 놓을 때 상태/저장 갱신. 위치는 퍼센트로 저장. 한 화면 6개로 DOM 수를 제한하고 저장은 250ms 지연 병합한다.

## 범위와 한계

AI 후보 성공 UI와 서버 공급자 처리는 **가짜 응답을 사용한 검사**다. 실제 OpenAI 인증·모델 응답·요금은 키가 없어 검사하지 못했다. 키가 없는 실제 서버의 503 안내는 HTTP로 검증했다. 클립보드 성공/실패는 브라우저 인터페이스를 대체해 검사했다. 교육 효과/기기 동기화/결제는 범위 밖.

[데스크톱](screenshots/desktop.png), [모바일](screenshots/mobile.png), [AI 후보 화면 — 모의 응답](screenshots/ai-candidates.png), [결과 JSON](screenshots/checks.json).

[보관함 데스크톱](screenshots/library-desktop.png), [보관함 모바일](screenshots/library-mobile.png). 보관함은 브라우저 저장이며 서버 DB/계정 동기화는 없다. JSON 내려받기는 제공하나 파일 가져오기 UI는 아직 없다. ‘직접 확인 완료’는 사용자 체크와 관찰 기록에 근거하며 앱이 외부에서 코드를 실행하거나 성공을 검증하지는 않는다.

보관함/실험 재실행:

```bash
npm run build
npm start -- --port 3217
# 별도 터미널에서 아래 명령 실행
BYEOLIEUM_TEST_URL=http://127.0.0.1:3217 python tests/library-browser.py
```

## 브라우저 재실행

```bash
npm run build
npm start -- --port 3206
```

Python playwright 및 Chromium 설치 환경의 별도 터미널에서:

```bash
BYEOLIEUM_TEST_URL=http://127.0.0.1:3206 python tests/browser-smoke.py
```

Chromium 경로가 다르면 `BYEOLIEUM_CHROMIUM`을 지정한다. 이 검사는 키 없는 서버를 기준으로 한다.

## 공급자 계약 재실행 — 네트워크 호출 없음

아래 fixture는 테스트 프로세스에서만 고정 OpenAI endpoint를 가로챈다. 앱 코드나 운영 환경에서 import하지 않는다.

```bash
# 반복할 때 이전에 시작한 테스트 서버를 종료하고 요청 로그를 비운다.
rm -f /tmp/byeolieum-mock-openai-calls.jsonl
BYEOLIEUM_AI_API_KEY=mock-key-for-tests NODE_OPTIONS='--import ./tests/mock-openai.mjs' npm start -- --port 3210
```

별도 터미널:

```bash
python tests/api-smoke.py
```

운영 기능에 모의 응답 옵션/키를 넣지 않는다. 실제 운영은 Vercel의 서버 환경변수로 OpenAI 키를 공급한다. 클라우드 개발 환경에서 실제 호출할 경우 Node.js 24의 `NODE_USE_ENV_PROXY=1`로 상속된 HTTP(S) 프록시를 사용하며 TLS 검증을 유지한다.

## 계정 저장 / 세 소셜 로그인

2026-10-08 검증: `npm test` 22개, lint, Production 빌드. 로컬 PostgreSQL 17에서 계정별 RLS, revision 충돌, 익명 RPC 차단, 네이버 비공개 테이블 접근 차단, 일회용 세션 소비와 만료를 검사했습니다.

브라우저 계정 검사는 모의 Supabase 공개 URL로 빌드 후 실행합니다(실제 키 불필요).

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.test NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture npm run build
npm start -- --port 3219
# 별도 터미널
BYEOLIEUM_TEST_URL=http://127.0.0.1:3219 python tests/cloud-browser.py
```

게스트 가져오기, 원본 보존, 두 기기 복원, 충돌 시 자동 덮어쓰기 차단, 저장 실패/재시도, 로그아웃, 손상 보관함 보존, Google/Kakao PKCE 요청과 Naver 세션 교환/만료를 검사합니다. `tests/naver-bridge.test.mjs`는 실제 SDK를 사용하되 외부 HTTP를 fixture로 대체해 새 회원의 signup 인증과 기존 회원 magiclink 인증, UUID 재사용, 암호화된 전달의 일회용 소비를 검사합니다. 실제 제공자 동의 화면과 운영 Supabase 로그인은 키/제공자/SQL 등록 뒤 별도로 확인해야 합니다.

`tests/cloud-rls-bootstrap.sql`, `tests/cloud-rls.sql`, `tests/naver-rls.sql`은 격리된 로컬 PostgreSQL 테스트용입니다. 운영에는 `supabase/migrations/`의 두 SQL만 순서대로 실행합니다.
