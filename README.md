# 별이음 · ByeolIeum

흩어진 생각을 이어, 나만의 그림으로. https://byeolieum.com

생각 카드를 캔버스에 놓고 연결해 아이디어를 구체화하고, AI 구현을 위한 프롬프트를 만드는 체험형 웹앱입니다.

## 실행

Node.js 22.13 이상(검증: 24.19), npm.

```bash
npm ci
npm run dev
```

기본 주소 http://localhost:3000. 클라우드 npm 캐시가 쓰기 불가이면 `npm ci --cache /tmp/byeolieum-npm-cache`를 사용합니다.

```bash
npm run lint
npm test
npm run build
npm start
```

Next.js 16.4, React 19.3, TypeScript, Tailwind CSS 4. 그래프 라이브러리·AI SDK·외부 폰트 없이 SVG, CSS, native fetch를 사용합니다.

## 체험

예제로 체험 → 카드 2~5개 선택 → AI 제안 또는 직접 아이디어 정하기 → 질문 5개에 하나씩 답하기 → 제작 프롬프트 편집·복사.

데스크톱: ⠿ 핸들 드래그 또는 방향키로 이동. 모바일: 카드 선택으로 연결. 50개까지 저장하며 화면에는 6개씩 표시합니다. 드래그 중에는 프레임당 좌표만 갱신하고, 놓을 때 React 상태와 저장 자료를 갱신합니다. 저장은 250ms 지연 병합하며 페이지 종료 시 현재 상태를 저장합니다.

단일 프로젝트는 이 브라우저에만 저장합니다. 기존 v0.1 기록을 유지하고 새 필드를 자동 보완합니다. 로그인·기기 동기화·결제·자동 코딩은 없습니다. 다른 탭의 동시 편집은 지원하지 않습니다.

## OpenAI 설정 — 선택 기능

키 없이 카드 조합, 직접 구체화, 제작 프롬프트 생성, 외부 AI용 연결 프롬프트 복사가 가능합니다.

Vercel → 프로젝트 byeolieum → Settings → Environment Variables:

- `BYEOLIEUM_AI_API_KEY`: OpenAI 프로젝트 API 키. Production에 등록하고 재배포합니다.
- `BYEOLIEUM_AI_MODEL`: 선택. 기본 `gpt-4.1-mini`. Chat Completions와 strict JSON schema를 지원하는 모델을 사용합니다.

로컬에서는 `.env.local`에 같은 이름을 설정하고 서버를 재시작합니다. 관리형 클라우드의 Node.js 24에서는 `NODE_USE_ENV_PROXY=1`을 설정해 환경 프록시를 사용합니다. 키를 Git이나 채팅에 공유하지 마세요. `NEXT_PUBLIC_` 접두사는 사용하지 않습니다.

`GET /api/ideas`는 연결 여부만 반환합니다. `POST /api/ideas`는 사용자가 버튼을 눌렀을 때 선택한 카드만 서버를 거쳐 OpenAI로 보냅니다. 이름·대상·목표·기능·검증 기준과 원본 카드 ID가 포함된 후보 3개를 검증 후 표시합니다. 자동 AI 호출·자동 재시도는 없습니다. 요청 중 카드가 바뀌면 이전 응답을 폐기합니다. 취소 시 이미 시작한 공급자 처리 비용이 발생했을 수 있습니다.

20초 공급자 타임아웃, 8KB 요청 제한, 카드 2~5개 제한, 같은 출처 확인, 실행 인스턴스의 IP별 분당 3회 제한이 있습니다. 메모리 기반 제한은 분산 서버 전체의 엄격한 비용 제한이 아닙니다. OpenAI 프로젝트의 사용량·예산 알림을 설정하고 공개 운영 시 영속적인 quota/사용자 인증을 검토하세요. 앱 DB에는 카드를 서버 저장하지 않지만 AI 기능을 사용하면 OpenAI의 데이터 정책이 적용됩니다.

## 문서

- [기능 명세](docs/product-spec.md)
- [흐름](docs/user-flow.md)
- [검증](docs/validation.md)

GitHub main과 Vercel Production이 연결되어 있습니다. 코드 push 뒤 Vercel 배포 상태를 확인하세요. API 키 설정은 클라우드 개발 환경 설정과 Vercel 운영 설정이 별개입니다.
