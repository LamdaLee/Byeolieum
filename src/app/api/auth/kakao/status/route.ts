import { connection } from "next/server";
import { kakaoConfig } from "@/lib/kakao-server";
export async function GET() {
  await connection();
  return Response.json(
    { enabled: kakaoConfig().enabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}
