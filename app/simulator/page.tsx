"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, TrendingUp } from "lucide-react";
import type { ChoiceListItem, StudentProfileInput } from "@/lib/types";
import type { RoundOutcome } from "@/lib/simulation";

interface Rule {
  topic: string;
  title: string;
  body: string;
  officialUrl: string | null;
}

const OUTCOME_STYLES: Record<string, string> = {
  Strong: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Possible: "bg-amber-50 border-amber-200 text-amber-700",
  Risky: "bg-purple-50 border-purple-200 text-purple-700",
  Unlikely: "bg-slate-100 border-slate-200 text-slate-500",
};

const DECISION_CONSEQUENCES: Record<string, string> = {
  FREEZE:
    "You'd exit the counseling process entirely and lock in this seat - no more rounds, no chance at a better later option.",
  FLOAT:
    "You'd keep this seat as a guaranteed backup while staying in the running for anything better among your remaining choices, at any institute.",
  SLIDE:
    "You'd keep this seat as a guaranteed backup while staying in the running only for a better branch at this SAME institute - not other institutes.",
};

export default function SimulatorPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfileInput | null>(null);
  const [items, setItems] = useState<ChoiceListItem[]>([]);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [selectedDecision, setSelectedDecision] = useState<"FREEZE" | "FLOAT" | "SLIDE" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");

  useEffect(() => {
    const p = sessionStorage.getItem("opencounsel:profile");
    const r = sessionStorage.getItem("opencounsel:results");
    if (!p || !r) {
      router.push("/profile");
      return;
    }
    const parsedProfile = JSON.parse(p) as StudentProfileInput;
    const parsedResults = JSON.parse(r);
    const parsedItems: ChoiceListItem[] = parsedResults.items ?? [];
    setProfile(parsedProfile);
    setItems(parsedItems);

    async function load() {
      try {
        const [simRes, rulesRes] = await Promise.all([
          fetch("/api/simulate-rounds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: parsedProfile, items: parsedItems }),
          }),
          fetch(`/api/rules?exam=${parsedProfile.examSystemCode}`),
        ]);

        if (!simRes.ok) {
          const err = await simRes.json();
          setError(err.error ?? "Could not run simulation.");
          setLoading(false);
          return;
        }

        const simData = await simRes.json();
        const rulesData = await rulesRes.json();
        setOutcomes(simData.outcomes ?? []);
        setDisclaimer(simData.disclaimer ?? "");
        setRules(rulesData.rules ?? []);
        setSelectedRound(1);
      } catch {
        setError("Network error - please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) return <div className="p-8 text-center text-slate-500">Simulating...</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  const current = outcomes.find((o) => o.round === selectedRound);
  const decisionRule = selectedDecision ? rules.find((r) => r.topic === selectedDecision) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Multi-Round Simulator</h1>
      <p className="mt-2 flex items-start gap-2 rounded-md bg-slate-100 p-3 text-xs text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        {disclaimer}
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {outcomes.map((o) => (
          <button
            key={o.round}
            onClick={() => {
              setSelectedRound(o.round);
              setSelectedDecision(null);
            }}
            className={`shrink-0 rounded-md border px-4 py-2 text-sm font-medium ${
              selectedRound === o.round
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            Round {o.round}
          </button>
        ))}
      </div>

      {current && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-slate-800">Round {current.round} - Likely Outcome</h2>
          </div>

          <div className={`mt-3 rounded-md border p-3 text-sm ${OUTCOME_STYLES[current.outcomeLabel]}`}>
            <span className="font-semibold">{current.outcomeLabel}</span> - {current.explanation}
          </div>

          {current.likelyPreferenceNumber && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                If this were your allotment, what would you do?
              </p>
              <div className="flex gap-2">
                {(["FREEZE", "FLOAT", "SLIDE"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDecision(d)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                      selectedDecision === d
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {selectedDecision && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{decisionRule?.title ?? selectedDecision}</p>
                  <p className="mt-1 text-slate-600">{decisionRule?.body}</p>
                  <p className="mt-2 rounded-md bg-white p-2 text-xs text-slate-500">
                    <span className="font-semibold">What happens next: </span>
                    {DECISION_CONSEQUENCES[selectedDecision]}
                  </p>
                  {decisionRule?.officialUrl && (
                    <a
                      href={decisionRule.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-brand-600 underline"
                    >
                      Official source
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}