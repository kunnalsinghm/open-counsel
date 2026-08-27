import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const TRUST_POINTS = [
  "Historical cutoff analysis (JoSAA Round 1–6, 2023–2024)",
  "Deterministic Dream / Target / Safe classification",
  "Choice-list mistake checker (linter)",
  "Grounded AI counseling assistant — never guesses cutoffs",
  "One-click CSV / PDF export",
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          100% free for students
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Build Your Smarter College Choice List
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Enter your rank, category and preferences. See Dream, Target and Safe colleges
          based on historical counseling data.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/profile"
            className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-brand-700"
          >
            Build My Choice List
          </Link>
          <Link
            href="/profile?demo=1"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            Try Free Simulator
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-2">
        {TRUST_POINTS.map((point) => (
          <div key={point} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span className="text-sm text-slate-700">{point}</span>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-slate-500">
        Independent educational decision-support tool. Not affiliated with or endorsed by
        any counseling authority. Recommendations are estimates based on historical data,
        not guarantees of admission.
      </p>
    </div>
  );
}
