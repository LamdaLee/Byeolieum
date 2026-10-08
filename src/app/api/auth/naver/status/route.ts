import { connection } from "next/server";
import { naverConfig } from "@/lib/naver-server";
export async function GET() {
  await connection();
  return Response.json(
    { enabled: naverConfig().enabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}
