import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Invoice System",
  description: "Proforma Invoice Generator with role-based access control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
