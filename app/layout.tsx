import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GraduationCap } from "lucide-react";
import AuthStatus from "@/components/AuthStatus";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "OpenCounsel — Free Admission Choice-Filling Simulator",
  description:
    "Build a smarter JoSAA/CSAB/NEET/State CET choice list based on historical cutoff data. 100% free, independent educational tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${font.className} flex min-h-screen flex-col`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <GraduationCap className="h-5 w-5" aria-hidden />
              </span>
              OpenCounsel
            </Link>
            <nav className="flex items-center gap-3 text-sm font-medium text-slate-600 sm:gap-5">
              <Link href="/profile" className="transition hover:text-brand-700">Build My List</Link>
              <Link href="/compare" className="transition hover:text-brand-700">Compare<span className="hidden sm:inline"> Colleges</span></Link>
              <Link href="/contact" className="hidden transition hover:text-brand-700 sm:inline">Contact</Link>
              <AuthStatus />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
            <p className="mb-4 max-w-3xl font-medium text-slate-700">
              Independent educational decision-support tool. Not affiliated with or
              endorsed by JoSAA, CSAB, MCC, NTA, or any state counseling authority.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/terms" className="transition hover:text-brand-700">Terms</Link>
              <Link href="/privacy" className="transition hover:text-brand-700">Privacy</Link>
              <Link href="/disclaimer" className="transition hover:text-brand-700">Disclaimer</Link>
              <Link href="/contact" className="transition hover:text-brand-700">Contact</Link>
            </div>
            <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              Developed and maintained by{" "}
              <a
                href="https://www.linkedin.com/in/vidhi-sharma-prof/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 transition hover:text-brand-700"
              >
                Vidhi Sharma
              </a>{" "}
              and{" "}
              <a
                href="https://www.linkedin.com/in/kunal-sm-41a055285/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 transition hover:text-brand-700"
              >
                Kunal.sm
              </a>
            </p>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
