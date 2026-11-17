"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { Sparkles, Play } from "lucide-react";

const bands = [
  { label: "Dream", note: "Your rank is just outside last year's closing ranks", tone: "border-purple-200 bg-purple-50 text-purple-800", dot: "bg-purple-500" },
  { label: "Target", note: "Your rank sits inside the historical range", tone: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  { label: "Safe", note: "Your rank is comfortably better than past cutoffs", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
];

export default function Hero() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-white to-slate-50">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-300/40 blur-3xl"
          animate={{ x: [-60, 60, -60], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(#c7d2fe_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
        />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-24 lg:grid-cols-2">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-brand-100"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> 100% free for students
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            >
              Build a college choice list you can trust
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600"
            >
              Enter your rank, category and preferences. See Dream, Target and Safe colleges based on historical
              counseling data.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link href="/profile" className="btn-primary px-6 py-3 text-base">
                Build my choice list
              </Link>
              <Link href="/profile?demo=1" className="btn-ghost px-6 py-3 text-base">
                <Play className="h-4 w-4" aria-hidden /> Try the free simulator
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="card p-5 shadow-2xl shadow-brand-900/10 sm:p-7"
          >
            <p className="text-sm font-medium text-slate-500">How your list is sorted (illustration)</p>
            <ul className="mt-4 space-y-3">
              {bands.map((b, i) => (
                <motion.li
                  key={b.label}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + i * 0.35 }}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${b.tone}`}
                >
                  <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${b.dot}`} aria-hidden />
                  <span>
                    <span className="block text-base font-bold">{b.label}</span>
                    <span className="block text-sm opacity-80">{b.note}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              className="mt-4 text-xs text-slate-500"
            >
              Based on historical cutoff data (JoSAA Rounds 1 to 6, 2023 to 2024). Estimates, not guarantees of admission.
            </motion.p>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
