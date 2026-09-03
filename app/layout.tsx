import type { Metadata } from "next";
import Link from "next/link";
import AuthStatus from "@/components/AuthStatus";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCounsel â€” Free Admission Choice-Filling Simulator",
  description:
    "Build a smarter JoSAA/CSAB/NEET/State CET choice list based on historical cutoff data. 100% free, independent educational tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">
              OpenCounsel
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/profile">Build My List</Link>
              <Link href="/compare">Compare Colleges</Link>
              <Link href="/contact">Contact</Link>
              <AuthStatus />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
            <p className="mb-3 font-medium text-slate-700">
              Independent educational decision-support tool. Not affiliated with or
              endorsed by JoSAA, CSAB, MCC, NTA, or any state counseling authority.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/disclaimer">Disclaimer</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}