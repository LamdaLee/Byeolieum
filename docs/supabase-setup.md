# 계정 저장과 소셜 로그인 설정

구글·카카오·네이버로 로그인하고 현재 작업, 아이디어 보관함, 실험 기록을 계정에 저장합니다. 가입 없이 쓰던 브라우저 원본은 유지하며, 로그아웃하면 그 작업으로 돌아옵니다. Supabase SDK는 계정 패널을 열거나 OAuth 콜백이 도착했을 때만 불러옵니다.

## 1. Vercel 환경변수

Production에 아래 두 항목을 등록하고 재배포합니다. 클라이언트 공개 설정이므로 빌드 때 반영됩니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 프로젝트 Publishable key. 기존 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 이름도 지원합니다.

Service role/secret key는 이 환경변수에 넣지 않습니다. 구글·카카오 Client Secret은 Supabase 제공자 설정에만 넣습니다.

## 2. 데이터베이스

Supabase SQL Editor에서 [마이그레이션](../supabase/migrations/202610080001_idea_spaces.sql) 전체를 한 번 실행합니다. 트랜잭션 안에서 테이블, RLS 정책, 저장 RPC를 함께 생성합니다.

- `idea_spaces`: 사용자 UUID별 작업 공간 1개. 최대 30개 아이디어를 포함한 JSON 문서와 변경 revision.
- 사용자 JWT의 `auth.uid()`가 행의 `user_id`와 같아야 읽기/쓰기가 가능합니다. 익명 사용자는 접근할 수 없습니다.
- `save_idea_space`는 이전 revision과 일치할 때만 저장합니다. 두 기기에서 동시에 수정하면 오래된 변경을 덮어쓰는 대신 충돌을 안내합니다.
- 브라우저는 공개 키와 로그인한 사용자 JWT를 사용합니다. Service role이 필요하지 않습니다.

## 3. Supabase Redirect URLs

Authentication → URL Configuration:

- Site URL: `https://byeolieum.com`
- Redirect URLs: `https://byeolieum.com`, `https://byeolieum.com/**`
- 로컬 검사 시 `http://localhost:3000`, `http://localhost:3000/**`를 별도 추가합니다.

Vercel Preview에서 실제 로그인을 검사하려면 해당 Preview URL을 별도 허용해야 합니다. OAuth는 PKCE를 사용하고 Supabase SDK가 앱으로 돌아온 `?code=`를 세션으로 교환합니다.

## 4. Google

1. Google Cloud Console에서 OAuth 동의 화면과 Web application OAuth Client를 만듭니다.
2. Authorized JavaScript origins: `https://byeolieum.com`.
3. Authorized redirect URI: **Supabase 제공자 화면에 나온 `https://<project-ref>.supabase.co/auth/v1/callback`**. 앱 도메인과 구분합니다.
4. Supabase → Authentication → Sign In / Providers → Google에서 Client ID와 Client Secret을 등록하고 활성화합니다.
5. Google 앱이 테스트 상태라면 사용할 계정을 테스트 사용자로 등록하고, 공개 운영 전 동의 화면을 배포 상태에 맞게 설정합니다.

## 5. Kakao

1. Kakao Developers에서 앱을 만들고 Web 플랫폼에 `https://byeolieum.com`을 등록합니다.
2. 카카오 로그인 활성화, Redirect URI에 **같은 Supabase `/auth/v1/callback` 주소**를 등록합니다.
3. Supabase Kakao 제공자가 요구하는 동의 항목을 앱에 설정합니다. 이메일 동의 권한은 카카오 앱의 제공 가능 범위를 확인합니다.
4. Client Secret을 활성화하고, Supabase Kakao 제공자 설정에 REST API 키(Client ID)와 Client Secret을 등록해 활성화합니다.

앱의 로그인 버튼은 `/auth/v1/settings`에서 확인한 활성화 상태를 사용합니다. 제공자 설정 전에는 해당 버튼이 ‘연결 준비 중’으로 표시됩니다. API 호출을 위한 access token이나 Client Secret을 앱 코드에 직접 넣지 않습니다.

## 6. Naver

네이버는 별도 서버 OAuth 연결을 사용해 Supabase 세션을 발급합니다.

1. 네이버 Developers에 서비스 URL `https://byeolieum.com`, Callback URL **`https://byeolieum.com/api/auth/naver/callback`**을 등록합니다. 회원 식별 ID를 사용하고 닉네임은 선택 항목입니다. 이메일을 통한 계정 연결은 하지 않습니다.
2. Vercel Production 서버 환경변수에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`를 등록합니다. 새 Supabase secret key는 `SUPABASE_SECRET_KEY` 이름도 지원합니다. 이 키들은 **NEXT_PUBLIC_ 접두사를 붙이지 않습니다**. 기본 공식 도메인을 변경할 때만 `AUTH_SITE_URL`을 설정합니다.
3. 첫 번째 마이그레이션 다음 [네이버 마이그레이션](../supabase/migrations/202610080002_naver_bridge.sql)을 Supabase SQL Editor에서 실행합니다.
4. 환경변수 변경 후 재배포합니다. Supabase의 Email 인증은 활성화 상태로 유지합니다. 사용자에게 인증 메일은 보내지 않으며 서버의 Admin API가 일회용 인증 링크를 생성하고 교환합니다.

서버는 네이버 회원 ID를 검증하고 비공개 매핑 테이블로 같은 Supabase UUID를 재사용합니다. 서비스 키로 유도한 내부 이메일은 화면에 표시하지 않습니다. 기존 구글·카카오 계정과 자동 합쳐지지 않으므로 같은 제공자로 계속 접속합니다. 저장소 접근은 세 제공자 모두 사용자 세션과 동일한 RLS를 사용합니다.

OAuth state 검증 후 세션은 암호화한 60초 일회용 레코드에 저장합니다. HttpOnly 쿠키로 전달한 nonce를 같은 출처의 POST로 교환하며 URL에는 토큰을 넣지 않습니다. 비공개 매핑/전달 테이블과 소비 RPC는 service_role만 접근할 수 있습니다. 네이버 앱이 개발 상태면 테스트 계정만 로그인할 수 있으므로 공개 운영 전 네이버 검수를 완료합니다.

## 사용자 흐름

로그인 · 계정 → 구글/카카오/네이버 → 앱으로 복귀 → 계정 기록 이어 하기 또는 브라우저 기록 가져오기.

계정에 기록이 없으면 브라우저의 현재 작업과 보관함을 저장합니다. 이미 기록이 있으면 클라우드 현재 작업을 유지하면서 브라우저 보관함과 이름 있는 미보관 초안을 합칩니다. 같은 ID의 다른 내용은 별도 사본으로 보존하고, 30개 한도를 넘으면 가져오기를 중단합니다. 이름 없는 초안은 원래 브라우저에 유지합니다.

계정 모드에서 변경 후 1초 뒤 자동 저장합니다. 저장 중 추가 변경은 다음 저장으로 이어집니다. 실패하면 자동 재시도를 중단하고 명시적인 다시 저장을 제공합니다. 충돌이면 현재 기록을 파일로 보관하고 최신 계정 기록을 확인합니다. ‘연결 다시 확인’은 게스트 모드에서만 제공해 오래된 작업을 새 revision으로 덮어쓰지 않습니다.

계정 모드의 미저장 편집 내용은 메모리에만 있습니다. ‘클라우드 저장 완료’를 확인한 뒤 페이지를 닫습니다. 장애 중에는 ‘현재 기록 파일 내려받기’로 현재 작업까지 보관할 수 있습니다. JSON 파일 가져오기 UI와 계정 삭제 UI는 후속 범위입니다. 같은 로그인 제공자로 접속해 같은 계정인지 확인합니다.

## 검증 범위

브라우저 자동 검사는 소셜 인증과 Supabase 응답을 대체하는 테스트 fixture를 사용합니다. 실제 Google/Kakao/Naver 동의 화면과 실프로젝트 인증은 제공자 등록 후 확인해야 합니다. RLS와 revision 충돌은 실제 로컬 PostgreSQL 17에서 별도 검사합니다. `tests/cloud-rls-bootstrap.sql`은 로컬 테스트 컨테이너 전용이며 실프로젝트에 실행하지 않습니다.

## 로그인 연결 문제 확인

- Google/Kakao가 ‘연결 준비 중’이면 Authentication → Sign In / Providers에서 해당 제공자를 Enabled로 켜고 Client ID/Secret을 등록합니다. Vercel에 Supabase 키만 등록하는 것으로 제공자가 켜지지는 않습니다. 이미 활성화했다면 Vercel의 공개 Supabase URL/키가 같은 프로젝트인지 확인합니다.
- Naver 시작 경로는 프록시의 Host 헤더와 공식 도메인을 비교해 자기 자신으로 리디렉션하지 않습니다. 콜백은 `AUTH_SITE_URL`(기본 https://byeolieum.com)의 고정 주소를 사용합니다. 로그인은 이 공식 도메인에서 시작합니다. 도메인 설정에서 www로 강제 이동한다면 AUTH_SITE_URL과 네이버 등록 콜백을 실제 최종 도메인으로 함께 변경합니다.
