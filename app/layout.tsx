import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans, Libre_Baskerville } from "next/font/google";
import { AuthHeader } from "@/components/AuthHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  weight: "700",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TableTime · Family Meal Planning",
  description:
    "Organiza el meal plan semanal de tu familia con calendario visual, recetas compartidas y lista de la compra inteligente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${libreBaskerville.variable} antialiased`}
      >
        <div className="relative min-h-screen">
          <AuthHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
