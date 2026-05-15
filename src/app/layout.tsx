import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "装修设计 Agent",
  description: "上传户型图，生成装修设计 brief"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
