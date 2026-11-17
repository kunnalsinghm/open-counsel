import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Steps from "@/components/landing/Steps";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Steps />
      <p className="mx-auto max-w-2xl px-4 py-10 text-center text-xs leading-relaxed text-slate-500">
        Independent educational decision-support tool. Not affiliated with or endorsed by any counseling authority.
        Recommendations are estimates based on historical data, not guarantees of admission.
      </p>
    </>
  );
}
