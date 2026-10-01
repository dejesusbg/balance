import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { t } from "@/i18n";
import { AppDataProvider } from "@/components/AppData";
import { BottomNav } from "@/components/BottomNav";
import { FeedbackProvider } from "@/components/Feedback";
import { QuickAddProvider } from "@/components/quick-add/QuickAdd";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

// Self-hosted at build time, so it works offline.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.description,
  appleWebApp: { capable: true, title: t.app.name, statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#820ad1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={hanken.variable}>
      <body>
        <AppDataProvider>
          <FeedbackProvider>
            <QuickAddProvider>
              <main className="app-main">{children}</main>
              <BottomNav />
            </QuickAddProvider>
          </FeedbackProvider>
        </AppDataProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
