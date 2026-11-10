import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "OquLens — Data-Driven Curriculum",
  description:
    "Платформа для методистов: анализ результатов СОР по разделам, трудные темы, честное сравнение учебников и рекомендации по учебным часам.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
