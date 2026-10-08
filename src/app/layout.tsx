import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "별이음 · ByeolIeum",
  description:
    "흩어진 생각을 이어, 나만의 그림으로. 아이디어를 보관하고 AI 제작 프롬프트와 작은 실험, 결과 기록으로 이어 가세요.",
  metadataBase: new URL("https://byeolieum.com"),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
