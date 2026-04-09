import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import AuthProvider from "@/providers/AuthProvider";

export const metadata: Metadata = {
  title: "Anti-Gravity — Pre-Market Dashboard",
  description:
    "A visually stunning pre-market stock dashboard with live data, glassmorphism UI, and interactive charts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
