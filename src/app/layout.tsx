import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ermak Tennis",
  description: "Клубная платформа для матчей, рейтинга и турниров",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
