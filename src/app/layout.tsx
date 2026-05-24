import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "装它 - deck it",
  description: "装它 - deck it，让装修从想法到方案更简单"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
