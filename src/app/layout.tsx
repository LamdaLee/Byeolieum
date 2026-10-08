import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "별이음 · ByeolIeum",
  description:
    "흩어진 생각을 이어, 나만의 그림으로. 생각 카드를 조합하고 AI 제작 프롬프트를 완성하세요.",
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
