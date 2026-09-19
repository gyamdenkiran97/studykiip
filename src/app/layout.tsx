import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Only the optical-size axis is requested: the design keeps SOFT and WONK at
 * their defaults, and every extra axis makes the variable font file bigger for
 * no visible difference.
 */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  // Axes and a fixed weight list are mutually exclusive: keeping the variable
  // weight axis plus optical size is what the design actually uses.
  axes: ["opsz"],
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Kwidus21 — a department store for things worth keeping",
    template: "%s | Kwidus21",
  },
  description:
    "Eleven departments under one roof: fashion, electronics, beauty, home, furniture, sport, accessories and more.",
  openGraph: {
    type: "website",
    siteName: "Kwidus21",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FBF9F5",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!font-sans !rounded-[3px] !border-line !bg-surface !text-ink",
          }}
        />
      </body>
    </html>
  );
}
