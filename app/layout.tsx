import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/contexts/AppContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Z.Electronic ERP",
  description: "نظام إدارة الموارد المؤسسية - Z.Electronic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* suppressHydrationWarning on body too: browser extensions (e.g. Bitdefender) inject
          attributes like bis_skin_checked / bis_register onto <body> before React hydrates,
          which otherwise triggers a hydration-mismatch warning that is not from our code. */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#1a1a1a] text-white`}
      >
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
