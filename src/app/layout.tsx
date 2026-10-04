import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Digital Hera — Gestão Operacional",
  description: "Plataforma interna de gestão operacional de equipes",
  applicationName: "Digital Hera",
  appleWebApp: {
    capable: true,
    title: "Digital Hera",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakarta.variable} antialiased`}>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
