import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppQueryProvider } from "@/lib/query-client";
import { ToastProvider } from "@packages/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "School Portal",
  description: "BD English-Medium School Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppQueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppQueryProvider>
      </body>
    </html>
  );
}
