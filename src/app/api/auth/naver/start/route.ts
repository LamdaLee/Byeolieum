import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  naverConfig,
  nonce,
  cookieOptions,
  STATE_COOKIE,
} from "@/lib/naver-server";
export async function GET() {
  await connection();
  const config = naverConfig();
  if (!config.enabled)
    return NextResponse.redirect(`${config.origin}/?login_error=naver`);
  // Reverse proxies may rewrite Host. Keep the callback fixed to the configured
  // origin without redirecting this endpoint back to itself.
  const state = nonce(),
    url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId!,
    redirect_uri: `${config.origin}/api/auth/naver/callback`,
    state,
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, cookieOptions(config.origin, 600));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
