import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Budgetkompis",
  description: "Mobilvänlig hushållsbudget för exakt två personer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
