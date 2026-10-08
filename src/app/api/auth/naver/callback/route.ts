import { NextRequest, NextResponse } from "next/server";
import {
  naverConfig,
  completeNaver,
  cookieOptions,
  STATE_COOKIE,
  HANDOFF_COOKIE,
} from "@/lib/naver-server";
import { equalState } from "@/lib/naver-crypto";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const config = naverConfig(),
    code = request.nextUrl.searchParams.get("code"),
    state = request.nextUrl.searchParams.get("state");
  let handoff: string | null = null;
  if (
    config.enabled &&
    code &&
    code.length <= 2048 &&
    equalState(request.cookies.get(STATE_COOKIE)?.value, state) &&
    !request.nextUrl.searchParams.has("error")
  ) {
    try {
      handoff = await completeNaver(code, state!);
    } catch {
      /* Never log auth codes, provider tokens or sessions. */
    }
  }
  const response = NextResponse.redirect(
    `${config.origin}/?${handoff ? "naver_login=ready" : "login_error=naver"}`,
  );
  response.cookies.set(STATE_COOKIE, "", cookieOptions(config.origin, 0));
  response.cookies.set(
    HANDOFF_COOKIE,
    handoff ?? "",
    cookieOptions(config.origin, handoff ? 60 : 0),
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
