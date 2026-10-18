import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const suppressExtensionWarningsScript = `
  const originalError = console.error;
  console.error = function(...args) {
    if (typeof args[0] === "string" && args[0].includes("bis_skin_checked")) return;
    originalError.apply(console, args);
  };
`;

export const metadata: Metadata = {
  title: "Trivia Quest",
  description: "Admin-driven animated trivia game built with Next.js.",
  icons: {
    icon: "/favicon2.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <Script id="suppress-extension-warnings" strategy="beforeInteractive">
          {suppressExtensionWarningsScript}
        </Script>
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans`} suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-center" visibleToasts={1} gap={4} />
      </body>
    </html>
  );
}
