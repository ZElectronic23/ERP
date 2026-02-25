import type { Metadata } from "next";
import { Cairo, Alata } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: '--font-cairo',
});

const alata = Alata({
  weight: '400',
  subsets: ["latin"],
  variable: '--font-alata',
});

export const metadata: Metadata = {
  title: "Z.Electronic ERP",
  description: "نظام إدارة موارد المؤسسات",
  icons: {
    icon: '/assets/images/LOGO ICO.png',
    shortcut: '/assets/images/LOGO ICO.png',
    apple: '/assets/images/LOGO ICO.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
        <link href="https://fonts.googleapis.com/css2?family=Alata&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${cairo.variable} ${alata.variable} font-sans`}
        style={{
          backgroundImage: "url('/assets/images/BG.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}