import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProtoShelf — 在线原型库",
  description: "团队的在线交互原型目录",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full"><TooltipProvider>{children}</TooltipProvider></body>
    </html>
  );
}
