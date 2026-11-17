import { BarChart3, Layers, ShieldAlert, Bot, Download } from "lucide-react";

const items = [
  { icon: BarChart3, title: "Historical cutoff analysis", text: "Uses JoSAA Round 1 to 6 data from 2023 and 2024, not guesswork.", span: "lg:col-span-2" },
  { icon: Layers, title: "Dream, Target, Safe", text: "A fixed rule sorts every option. The same rank always gives the same answer.", span: "" },
  { icon: ShieldAlert, title: "Mistake checker", text: "Flags common choice-list errors before you lock your list.", span: "" },
  { icon: Bot, title: "A grounded AI assistant", text: "It answers from the data and never guesses a cutoff.", span: "lg:col-span-2" },
  { icon: Download, title: "Export in one click", text: "Download your list as CSV or PDF to keep or share.", span: "lg:col-span-3" },
];

export default function Features() {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Everything you need to fill choices with confidence
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, text, span }) => (
            <div key={title} className={`card p-6 transition hover:border-brand-200 hover:shadow-md ${span}`}>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 max-w-md text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
