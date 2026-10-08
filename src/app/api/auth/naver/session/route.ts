import { NextRequest, NextResponse } from "next/server";
import {
  naverConfig,
  consumeNaver,
  cookieOptions,
  HANDOFF_COOKIE,
} from "@/lib/naver-server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const config = naverConfig();
  if (request.headers.get("origin") !== config.origin)
    return NextResponse.json(
      { error: "로그인 요청을 확인하지 못했어요." },
      { status: 403 },
    );
  let session: { access_token: string; refresh_token: string } | null = null;
  const handoff = request.cookies.get(HANDOFF_COOKIE)?.value;
  if (config.enabled && handoff) {
    try {
      session = await consumeNaver(handoff);
    } catch {
      /* Generic response only. */
    }
  }
  const response = NextResponse.json(
    session ?? {
      error: "로그인 연결이 만료됐어요. 네이버 로그인을 다시 시작해 주세요.",
    },
    { status: session ? 200 : 401 },
  );
  response.cookies.set(HANDOFF_COOKIE, "", cookieOptions(config.origin, 0));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
