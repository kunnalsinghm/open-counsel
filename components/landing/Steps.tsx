import Link from "next/link";

const steps = [
  { title: "Enter your rank and category", text: "Add your exam rank, category and the branches and institute types you care about." },
  { title: "Review your sorted list", text: "See Dream, Target and Safe colleges, then drag them into your preferred order." },
  { title: "Check and export", text: "Run through the warnings, then download your final list." },
];

export default function Steps() {
  return (
    <section className="bg-brand-900 py-14 text-white sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready in three steps</h2>
          <p className="mt-4 max-w-sm text-brand-200">No sign-up needed to try it. Start with the free simulator.</p>
          <Link href="/profile?demo=1" className="btn mt-6 bg-white px-6 py-3 text-base text-brand-900 hover:bg-brand-100 focus-visible:ring-brand-300">
            Try the free simulator
          </Link>
        </div>
        <ol className="space-y-4 lg:col-span-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold">{i + 1}</span>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-brand-200">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
