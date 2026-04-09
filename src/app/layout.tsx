import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Gabon COD Platform - SaaS Fulfillment",
  description: "Professional COD (Cash on Delivery) fulfillment platform for African and MENA markets. Manage orders, inventory, delivery agents, and finances.",
  keywords: ["COD", "fulfillment", "e-commerce", "Africa", "delivery", "logistics"],
  authors: [{ name: "Gabon COD Platform" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} bg-background text-foreground font-sora antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
