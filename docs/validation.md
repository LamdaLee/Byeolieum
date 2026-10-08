# 검증 기록

2026-10-08, Node.js 24.19.0 / npm 11.9.0 / Next.js 16.4.0.

- `npm run lint`: 오류·경고 없음.
- `npm test`: 데이터/프롬프트 단위 테스트 4개 통과.
- `npm run build`: TypeScript 검사 포함 프로덕션 빌드 통과.
- 프로덕션 서버 대상 Chromium 브라우저 검사 17개 통과: 카드 입력·수정·삭제, 텍스트 안전 처리, 선택 범위, 원본 포함 여부, 단계 이동, 부분/완성 저장 복원, 프롬프트 재생성, 복사 성공·실패, 초기화, 손상된 저장 데이터, 저장 불가, 모바일 네 단계 완주, 가로 넘침, JavaScript 오류.
- 복사 성공/실패 검사는 브라우저 clipboard 인터페이스를 대체해 검증했다. 모든 운영 브라우저의 클립보드 권한을 보장하는 검사는 아니다.
- 데스크톱 1440×1000, 모바일 390×844. [PC 화면](screenshots/desktop.png), [모바일 화면](screenshots/mobile.png), [체크 결과](screenshots/checks.json).

브라우저 검사 재실행(별도 터미널에서 프로덕션 서버 실행):

```bash
npm run build
npm start -- --port 3201
```

Python `playwright` 패키지와 Chromium이 설치된 환경에서:

```bash
BYEOLIEUM_TEST_URL=http://127.0.0.1:3201 python tests/browser-smoke.py
```

Chromium 경로가 다르면 `BYEOLIEUM_CHROMIUM`을 지정한다. 스크립트는 localhost 프로덕션을 기본으로 검사하며 스크린샷과 결과 JSON을 갱신한다. 외부 AI 구현, 실제 사용자 학습 효과, 서버 저장, 결제, 운영 배포는 검사 범위 밖이다.

## 카드 조합 이후 흐름 개선
선택한 원본 카드 재확인, 세 질문 묶음, 프롬프트 출처 요약을 추가했다. 단계 제목 초점과 작업 패널 위치를 분리하고 모션 감소 설정을 반영했다. 모바일에서 단계 이동 뒤 패널 상단이 20px 위치에 나타나는지, 구체화 화면을 건너뛰지 않는지 검사했다.
