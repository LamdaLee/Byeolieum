# 별이음 · ByeolIeum

흩어진 생각을 이어, 나만의 그림으로.

생각 카드를 연결해 아이디어를 구체화하고, AI 구현을 위한 프롬프트를 만드는 체험형 웹앱 프로토타입입니다. 브랜드 주소: https://byeolieum.com (이 저장소 작업만으로 배포나 DNS 연결이 완료되지는 않습니다).

## 실행

Node.js 22.13 이상(개발 검증: 24.19), npm이 필요합니다.

```bash
npm ci
npm run dev
```

터미널에 표시된 주소(기본 http://localhost:3000)를 로컬 브라우저에서 엽니다.

```bash
npm run lint
npm test
npm run build
npm start
```

클라우드의 기본 npm 캐시 경로가 쓰기 불가라면 `npm ci --cache /tmp/byeolieum-npm-cache`를 사용합니다. 환경변수나 API 키는 필요 없습니다. Next.js 16.4, React 19.3, TypeScript, Tailwind CSS 4를 사용합니다. 한글 시스템 글꼴과 직접 작성한 SVG 로고를 사용하며 외부 폰트를 요청하지 않습니다.

## 체험

‘예제로 체험하기’ → 다음 → 카드 2~5개 선택 → 다음 → 질문 답 확인 → 프롬프트 생성 → 수정·복사. 직접 카드 작성·수정·삭제도 가능합니다.

이 브라우저에 단일 프로젝트를 저장합니다. 로그인·기기 동기화·AI API·결제·자동 코딩은 없습니다. 복사한 프롬프트를 외부 AI에 전달하는 것은 사용자 선택입니다. 민감한 실제 자료 대신 예시 자료로 체험하세요. 다른 탭의 동시 편집은 지원하지 않습니다. 브라우저 저장을 지우면 기록이 사라집니다.

## 문서

- [기능 명세](docs/product-spec.md)
- [사용자 흐름](docs/user-flow.md)
- [검증 기록](docs/validation.md)

## 배포

Vercel에서 이 저장소의 작업 브랜치를 가져오고 프레임워크는 Next.js, 빌드는 `npm run build`로 설정합니다. 별도 환경변수 없이 배포할 수 있습니다. 임시 주소에서 확인 후 byeolieum.com을 등록하고 Vercel이 안내한 DNS 레코드를 도메인 관리 화면에 설정하세요.
