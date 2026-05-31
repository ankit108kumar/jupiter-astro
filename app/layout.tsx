import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/navBar";
import Footer from "@/components/footer";

// Configure your custom Nocturn font
const nocturn = localFont({
  src: [
    {
      path: "../public/fonts/Nocturn-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Nocturn-semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Nocturn-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-nocturn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jupiter Astro | Best Online Astrology Consultation",
  description: "Get accurate birth chart analysis, yearly forecasts (Varshphal), career guidance, and personalized Lal Kitab remedies from expert astrologers.",
  icons: {
    icon: "/logos/logo.png" // Changed from "./" to "/"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nocturn.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 pt-30">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer/>
      </body>
    </html>
  );
}