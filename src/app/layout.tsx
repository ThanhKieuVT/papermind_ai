import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: { default: "PaperMind AI", template: "%s · PaperMind AI" },
  description: "Discover, read, understand, compare and study scientific papers.",
};

// Self-hosted at build time by next/font (no runtime request to Google).
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans", display: "swap" });

// Applies the saved theme before first paint to avoid a flash of the wrong theme.
const themeScript = `try{if(localStorage.getItem("papermind:theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
