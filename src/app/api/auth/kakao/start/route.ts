import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  kakaoConfig,
  nonce,
  cookieOptions,
  STATE_COOKIE,
} from "@/lib/kakao-server";
export async function GET() {
  await connection();
  const config = kakaoConfig();
  if (!config.enabled)
    return NextResponse.redirect(`${config.origin}/?login_error=kakao`);
  // Reverse proxies may rewrite Host. Keep the callback fixed to the configured
  // origin without redirecting this endpoint back to itself.
  const state = nonce(),
    url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId!,
    redirect_uri: `${config.origin}/api/auth/kakao/callback`,
    state,
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, cookieOptions(config.origin, 600));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
